import { useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, Download, Filter, Home, Layers, Loader2, LocateFixed, MapPin, Move, ScanText, Search, Trash2, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import type { AppData } from "../hooks/useAppData";
import type { InvestigationsApi } from "../hooks/useInvestigations";
import type { Author } from "../lib/domain";
import type { Investigation, InvestigationItem } from "../lib/investigation";
import { formatBR } from "../lib/dates";
import {
  LatLng, canterCircle, centroid, convexHull, distance, formatCoord, formatDistance, geocodeAddress, geographicProfile, geometricMedian,
  googleMapsUrl, hotspots, meanNearestNeighbor, parseCoordinates, polygonArea, streetViewUrl,
} from "../lib/geo";
import { createHeatLayer } from "../lib/heatLayer";

// ---------- Tipos e utilidades ----------
type Event = {
  id: string; item: InvestigationItem; inv?: Investigation; lat: number; lng: number; crime: string; date: string; time: string;
  hour: number | null; weekday: number | null; authorIds: string[]; place: string; reference: string;
};
type Base = "satelite" | "hibrido" | "ruas" | "claro";
type LayerKey = "pontos" | "calor" | "areas" | "centro" | "perfil" | "canter" | "sequencia" | "residencias" | "hotspots";
type Placing = { kind: "item"; item: InvestigationItem } | { kind: "home"; author: Author } | null;

const LAYERS: [LayerKey, string, string][] = [
  ["pontos", "Fatos", "Cada ocorrência no local exato."],
  ["calor", "Mapa de calor", "Densidade de fatos (Kernel): onde mais acontece."],
  ["hotspots", "Pontos quentes", "Locais com 2+ fatos num raio de ~300 m."],
  ["areas", "Área de atuação", "Polígono que envolve os fatos de cada autor."],
  ["centro", "Centro de gravidade", "Centro médio e centro de menor distância dos fatos."],
  ["canter", "Círculo de Canter", "Círculo pelos dois fatos mais distantes: a base do autor tende a estar dentro."],
  ["perfil", "Perfil geográfico", "Triangulação (Rossmo): áreas mais prováveis da base/residência do autor."],
  ["sequencia", "Sequência no tempo", "Liga os fatos em ordem cronológica (deslocamento)."],
  ["residencias", "Residências × fatos", "Linhas da residência do alvo até cada fato, com a distância."],
];
const BAND = [["Madrugada (0–6h)", 0, 6], ["Manhã (6–12h)", 6, 12], ["Tarde (12–18h)", 12, 18], ["Noite (18–24h)", 18, 24]] as const;
const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const COLORS = ["#C8102E", "#1F6FB2", "#2E8B57", "#D98E04", "#7B3FA0", "#0F9DA8", "#B5541B", "#5B6B2E", "#D6457A", "#3D3D3D"];
const esc = (t: string) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const BASES: Record<Base, { label: string; layers: () => L.Layer[] }> = {
  satelite: { label: "Satélite", layers: () => [L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 19, attribution: "Imagens © Esri" })] },
  hibrido: { label: "Híbrido", layers: () => [
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 19, attribution: "Imagens © Esri" }),
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 19 }),
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 20, maxNativeZoom: 19 }),
  ] },
  ruas: { label: "Ruas", layers: () => [L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, maxNativeZoom: 19, attribution: "© OpenStreetMap" })] },
  claro: { label: "Claro", layers: () => [L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 20, attribution: "© OpenStreetMap © CARTO" })] },
};

function crimeOf(item: InvestigationItem) {
  if (item.crime) return item.crime.toUpperCase();
  if (item.kind === "Boletim de ocorrência") return (item.title.split(" — ")[0] || "OCORRÊNCIA").toUpperCase();
  return item.kind.toUpperCase();
}

type Props = {
  data: AppData;
  api: InvestigationsApi;
  /** Fontes a considerar (de uma investigação ou de todas). */
  items: InvestigationItem[];
  /** No mapa geral, permite filtrar por investigação. */
  investigations?: Investigation[];
  height?: string;
};

export default function CrimeMap({ data, api, items, investigations, height = "70vh" }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<L.Layer[]>([]);
  const overlayRef = useRef<L.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);
  const [base, setBase] = useState<Base>("hibrido");
  const [layers, setLayers] = useState<Set<LayerKey>>(new Set(["pontos", "calor", "residencias"]));
  const [colorBy, setColorBy] = useState<"crime" | "autor">("autor");
  const [fCrimes, setFCrimes] = useState<Set<string>>(new Set());
  const [fAuthors, setFAuthors] = useState<Set<string>>(new Set());
  const [fInv, setFInv] = useState<Set<string>>(new Set());
  const [fWeek, setFWeek] = useState<Set<number>>(new Set());
  const [fBand, setFBand] = useState<Set<number>>(new Set());
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [placing, setPlacing] = useState<Placing>(null);
  const [moving, setMoving] = useState(false);
  const [busy, setBusy] = useState("");
  const [panel, setPanel] = useState<"filtros" | "camadas" | "localizar">("filtros");
  const [pasteFor, setPasteFor] = useState<Record<string, string>>({});
  const [search, setSearch] = useState<{ id: string; results: (LatLng & { label: string })[] } | null>(null);
  const [fitKey, setFitKey] = useState(0);

  const authorById = useMemo(() => new Map(data.authors.map((a) => [a.id, a])), [data.authors]);
  const invById = useMemo(() => new Map((investigations || api.investigations).map((i) => [i.id, i])), [investigations, api.investigations]);

  // Um mesmo REDS em duas investigações vira um fato só (autores somados).
  const allEvents = useMemo<Event[]>(() => {
    const byRef = new Map<string, Event>();
    for (const item of items) {
      if (item.lat == null || item.lng == null) continue;
      const key = item.reference ? `ref:${item.reference}` : item.id;
      const date = item.itemDate || "";
      const hour = /^\d{1,2}:\d{2}/.test(item.eventTime) ? Number(item.eventTime.split(":")[0]) : null;
      const prev = byRef.get(key);
      if (prev) { prev.authorIds = [...new Set([...prev.authorIds, ...item.authorIds])]; continue; }
      byRef.set(key, {
        id: item.id, item, inv: invById.get(item.investigationId), lat: item.lat, lng: item.lng, crime: crimeOf(item), date, time: item.eventTime,
        hour, weekday: date ? new Date(`${date}T12:00:00`).getDay() : null, authorIds: [...item.authorIds], place: item.place, reference: item.reference,
      });
    }
    return [...byRef.values()];
  }, [items, invById]);

  const missing = items.filter((i) => (i.lat == null || i.lng == null) && (i.kind === "Boletim de ocorrência" || i.place || i.reference));
  const crimes = useMemo(() => [...new Set(allEvents.map((e) => e.crime))].sort(), [allEvents]);
  const authorsInScope = useMemo(() => {
    const ids = new Set(items.flatMap((i) => i.authorIds));
    return data.authors.filter((a) => ids.has(a.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, data.authors]);

  const events = useMemo(() => allEvents.filter((e) =>
    (!fCrimes.size || fCrimes.has(e.crime))
    && (!fAuthors.size || e.authorIds.some((id) => fAuthors.has(id)))
    && (!fInv.size || (e.inv && fInv.has(e.inv.id)))
    && (!fWeek.size || (e.weekday !== null && fWeek.has(e.weekday)))
    && (!fBand.size || (e.hour !== null && [...fBand].some((b) => e.hour! >= BAND[b][1] && e.hour! < BAND[b][2])))
    && (!from || (e.date && e.date >= from))
    && (!to || (e.date && e.date <= to)),
  ), [allEvents, fCrimes, fAuthors, fInv, fWeek, fBand, from, to]);

  // Autores com fatos no filtro atual (para as camadas por autor).
  const authorGroups = useMemo(() => {
    const ids = fAuthors.size ? [...fAuthors] : [...new Set(events.flatMap((e) => e.authorIds))];
    return ids.map((id, i) => ({ author: authorById.get(id), color: COLORS[i % COLORS.length], events: events.filter((e) => e.authorIds.includes(id)) }))
      .filter((g) => g.author && g.events.length);
  }, [events, fAuthors, authorById]);
  const colorOfAuthor = (id: string) => authorGroups.find((g) => g.author!.id === id)?.color || "#6B655A";
  const colorOfCrime = (c: string) => COLORS[Math.max(0, crimes.indexOf(c)) % COLORS.length];
  const colorOf = (e: Event) => (colorBy === "crime" ? colorOfCrime(e.crime) : e.authorIds.length ? colorOfAuthor(e.authorIds[0]) : "#3D3D3D");

  // ---------- Mapa ----------
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return undefined;
    const map = L.map(mapEl.current, { zoomControl: true, preferCanvas: true, attributionControl: true }).setView([-19.9191, -43.9386], 13);
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
    overlayRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setReady(true);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(mapEl.current);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    baseRef.current.forEach((l) => map.removeLayer(l));
    baseRef.current = BASES[base].layers();
    baseRef.current.forEach((l) => { l.addTo(map); (l as any).bringToBack?.(); });
  }, [base, ready]);

  // Enquadra os fatos quando o filtro muda ou ao abrir.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !events.length) return;
    const pts = events.map((e) => [e.lat, e.lng] as [number, number]);
    authorGroups.forEach((g) => { if (layers.has("residencias") && g.author!.homeLat != null) pts.push([g.author!.homeLat!, g.author!.homeLng!]); });
    map.fitBounds(L.latLngBounds(pts).pad(0.25), { maxZoom: 17 });
  }, [ready, fitKey, fCrimes, fAuthors, fInv, from, to]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clique no mapa no modo "marcar".
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    map.getContainer().style.cursor = placing ? "crosshair" : "";
    if (!placing) return undefined;
    const onClick = (ev: L.LeafletMouseEvent) => place(placing, { lat: ev.latlng.lat, lng: ev.latlng.lng }, "Mapa");
    map.on("click", onClick);
    return () => { map.off("click", onClick); };
  }, [placing]); // eslint-disable-line react-hooks/exhaustive-deps

  async function place(target: NonNullable<Placing>, point: LatLng, source: string) {
    if (target.kind === "item") await api.setItemLocation(target.item, { lat: point.lat, lng: point.lng, geoSource: source });
    else await data.setAuthorHome(target.author, point);
    setPlacing(null);
  }

  // Desenho das camadas.
  useEffect(() => {
    const map = mapRef.current;
    const group = overlayRef.current;
    if (!map || !group) return;
    group.clearLayers();
    const renderer = L.canvas({ padding: 0.3 });
    const pts = events.map((e) => ({ lat: e.lat, lng: e.lng }));

    if (layers.has("calor") && events.length) group.addLayer(createHeatLayer(L, events.map((e) => [e.lat, e.lng, 1]), { radiusMeters: 220 }));

    if (layers.has("perfil")) {
      const groupsForProfile = authorGroups.length === 1 || fAuthors.size ? authorGroups.map((g) => g.events) : [events];
      for (const evs of groupsForProfile) {
        const cells = geographicProfile(evs.map((e) => ({ lat: e.lat, lng: e.lng })));
        for (const c of cells) {
          if (c.value < 0.55) continue;
          const t = (c.value - 0.55) / 0.45;
          group.addLayer(L.rectangle([[c.bounds[0].lat, c.bounds[0].lng], [c.bounds[1].lat, c.bounds[1].lng]], {
            renderer, stroke: false, fillColor: t > 0.85 ? "#7a0019" : t > 0.6 ? "#c51b7d" : t > 0.3 ? "#de77ae" : "#f1b6da", fillOpacity: 0.18 + t * 0.4, interactive: false,
          }));
        }
      }
    }

    if (layers.has("areas")) {
      for (const g of authorGroups) {
        const hull = convexHull(g.events.map((e) => ({ lat: e.lat, lng: e.lng })));
        if (hull.length >= 3) {
          group.addLayer(L.polygon(hull.map((p) => [p.lat, p.lng]), { color: g.color, weight: 2, dashArray: "6 4", fillOpacity: 0.08 })
            .bindTooltip(`${esc(g.author!.name)} — área ${(polygonArea(hull) / 1e6).toFixed(2)} km²`, { sticky: true }));
        }
      }
      if (!authorGroups.length && pts.length >= 3) {
        const hull = convexHull(pts);
        group.addLayer(L.polygon(hull.map((p) => [p.lat, p.lng]), { color: "#7A6C45", weight: 2, dashArray: "6 4", fillOpacity: 0.06 }));
      }
    }

    if (layers.has("canter")) {
      const sets = authorGroups.length ? authorGroups.map((g) => ({ color: g.color, pts: g.events.map((e) => ({ lat: e.lat, lng: e.lng })), name: g.author!.name })) : [{ color: "#7A6C45", pts, name: "todos os fatos" }];
      for (const s of sets) {
        const c = canterCircle(s.pts);
        if (c) group.addLayer(L.circle([c.center.lat, c.center.lng], { radius: c.radius, color: s.color, weight: 1.5, fillOpacity: 0.04, dashArray: "2 6", renderer })
          .bindTooltip(`Círculo de Canter — ${esc(s.name)} (raio ${formatDistance(c.radius)})`, { sticky: true }));
      }
    }

    if (layers.has("hotspots")) {
      hotspots(events, 300).slice(0, 10).forEach((h, i) => {
        group.addLayer(L.circle([h.center.lat, h.center.lng], { radius: 220, color: "#b2182b", weight: 2, fillColor: "#b2182b", fillOpacity: 0.12, renderer })
          .bindTooltip(`Ponto quente ${i + 1}: ${h.items.length} fatos`, { permanent: i < 3, direction: "top" }));
      });
    }

    if (layers.has("sequencia") && events.length > 1) {
      const seq = [...events].filter((e) => e.date).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
      group.addLayer(L.polyline(seq.map((e) => [e.lat, e.lng]), { color: "#0B0B0C", weight: 2, opacity: 0.7, dashArray: "8 6" }));
      seq.forEach((e, i) => group.addLayer(L.marker([e.lat, e.lng], {
        interactive: false, icon: L.divIcon({ className: "", iconSize: [20, 20], iconAnchor: [-6, 22], html: `<div style="background:#0B0B0C;color:#CFC29B;font:800 11px/20px Raleway,system-ui;min-width:20px;height:20px;padding:0 4px;border-radius:2px;text-align:center">${i + 1}</div>` }),
      })));
    }

    if (layers.has("residencias")) {
      for (const g of authorGroups) {
        const a = g.author!;
        if (a.homeLat == null || a.homeLng == null) continue;
        const home = { lat: a.homeLat, lng: a.homeLng };
        for (const e of g.events) {
          const d = distance(home, e);
          group.addLayer(L.polyline([[home.lat, home.lng], [e.lat, e.lng]], { color: g.color, weight: 1.5, opacity: 0.8 })
            .bindTooltip(`${esc(a.name)} → ${esc(e.crime)} ${e.date ? formatBR(e.date) : ""}: ${formatDistance(d)}`, { sticky: true }));
        }
        const m = L.marker([home.lat, home.lng], {
          draggable: moving,
          icon: L.divIcon({ className: "", iconSize: [26, 26], iconAnchor: [13, 13], html: `<div title="Residência" style="width:26px;height:26px;border-radius:3px;background:${g.color};border:2px solid #fff;box-shadow:0 1px 4px #0006;display:grid;place-items:center;color:#fff;font:900 14px/1 system-ui">⌂</div>` }),
        }).bindPopup(`<b>Residência</b><br>${esc(a.name)}${a.alias ? ` ("${esc(a.alias)}")` : ""}<br>${esc([a.address, a.neighborhood, a.city].filter(Boolean).join(" — "))}<br><small>${formatCoord(home)}</small><br><a href="${googleMapsUrl(home)}" target="_blank" rel="noreferrer">Google Maps</a> · <a href="${streetViewUrl(home)}" target="_blank" rel="noreferrer">Street View</a>`);
        if (moving) m.on("dragend", () => { const p = m.getLatLng(); data.setAuthorHome(a, { lat: p.lat, lng: p.lng }); });
        group.addLayer(m);
      }
    }

    if (layers.has("centro") && pts.length >= 2) {
      const sets = authorGroups.length ? authorGroups.map((g) => ({ color: g.color, pts: g.events.map((e) => ({ lat: e.lat, lng: e.lng })), name: g.author!.name })) : [{ color: "#0B0B0C", pts, name: "todos os fatos" }];
      for (const s of sets) {
        const c = centroid(s.pts); const m = geometricMedian(s.pts);
        if (c) group.addLayer(L.circleMarker([c.lat, c.lng], { radius: 6, color: "#fff", weight: 2, fillColor: s.color, fillOpacity: 1, renderer }).bindTooltip(`Centro médio — ${esc(s.name)}`));
        if (m && s.pts.length >= 3) group.addLayer(L.marker([m.lat, m.lng], {
          icon: L.divIcon({ className: "", iconSize: [22, 22], iconAnchor: [11, 11], html: `<div style="width:22px;height:22px;border:3px solid ${s.color};border-radius:50%;background:#fff8;box-shadow:0 0 0 2px #fff"></div>` }),
        }).bindPopup(`<b>Centro de menor distância</b><br>${esc(s.name)}<br><small>${formatCoord(m)}</small><br><a href="${googleMapsUrl(m)}" target="_blank" rel="noreferrer">Google Maps</a>`));
      }
    }

    if (layers.has("pontos")) {
      for (const e of events) {
        const names = e.authorIds.map((id) => authorById.get(id)?.name).filter(Boolean) as string[];
        const popup = `<div style="min-width:220px;font:13px/1.35 Raleway,system-ui">
          <div style="font-weight:900;text-transform:uppercase">${esc(e.crime)}</div>
          <div>${e.date ? formatBR(e.date) : "sem data"}${e.time ? ` às ${esc(e.time)}` : ""}${e.weekday !== null ? ` (${WEEK[e.weekday]})` : ""}</div>
          ${e.place ? `<div>${esc(e.place)}</div>` : ""}
          ${e.reference ? `<div>REDS ${esc(e.reference)}</div>` : ""}
          ${names.length ? `<div style="margin-top:4px"><b>Autores:</b> ${names.map(esc).join(", ")}</div>` : ""}
          ${e.inv ? `<div style="color:#6B655A">${esc(e.inv.code)} — ${esc(e.inv.title)}</div>` : ""}
          <div style="color:#6B655A;font-size:11px;margin-top:4px">${formatCoord(e)} · origem: ${esc(e.item.geoSource || "—")}</div>
          <div style="margin-top:4px"><a href="${googleMapsUrl(e)}" target="_blank" rel="noreferrer">Google Maps</a> · <a href="${streetViewUrl(e)}" target="_blank" rel="noreferrer">Street View</a></div></div>`;
        if (moving) {
          const m = L.marker([e.lat, e.lng], { draggable: true, icon: L.divIcon({ className: "", iconSize: [18, 18], iconAnchor: [9, 9], html: `<div style="width:18px;height:18px;border-radius:50%;background:${colorOf(e)};border:3px solid #fff;box-shadow:0 0 0 2px #0B0B0C"></div>` }) });
          m.on("dragend", () => { const p = m.getLatLng(); api.setItemLocation(e.item, { lat: p.lat, lng: p.lng, geoSource: "Mapa" }); });
          group.addLayer(m.bindPopup(popup));
        } else {
          group.addLayer(L.circleMarker([e.lat, e.lng], { renderer, radius: 8, color: "#fff", weight: 2, fillColor: colorOf(e), fillOpacity: 0.95 }).bindPopup(popup));
        }
      }
    }
  }, [events, layers, authorGroups, colorBy, moving, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Ações de localização ----------
  async function readFromReds(list: InvestigationItem[]) {
    const [{ extractPdfItems }, lib] = await Promise.all([import("../lib/pdf"), import("../lib/boletim")]);
    let found = 0; let read = 0;
    for (const [i, item] of list.entries()) {
      if (!item.filePath || !/pdf/i.test(item.mimeType || item.fileName)) continue;
      setBusy(`Lendo REDS ${i + 1} de ${list.length}…`);
      try {
        const url = await api.itemFileUrl(item);
        if (!url) continue;
        const blob = await fetch(url).then((r) => r.blob());
        const bo = lib.parseBoletim(await extractPdfItems(new File([blob], item.fileName || "bo.pdf", { type: "application/pdf" })));
        if (!lib.isBoletim(bo)) continue;
        read += 1;
        const geo = lib.boletimGeo(bo);
        if (geo.lat != null) found += 1;
        await api.setItemLocation(item, { ...geo, place: item.place || geo.place, eventTime: item.eventTime || geo.eventTime, crime: item.crime || geo.crime }, true);
      } catch (error) { console.error(error); }
    }
    setBusy("");
    setFitKey((k) => k + 1);
    window.alert(`${read} REDS lido(s); ${found} com coordenadas no próprio boletim.${read > found ? " Os demais: marque no mapa (clique no local) ou cole a coordenada." : ""}`);
  }

  async function searchAddress(id: string, query: string) {
    if (!query.trim()) return;
    setBusy("Buscando endereço…");
    try {
      const results = await geocodeAddress(query);
      setSearch({ id, results });
      if (results[0]) mapRef.current?.setView([results[0].lat, results[0].lng], 18);
    } catch { window.alert("Não foi possível buscar o endereço agora."); }
    finally { setBusy(""); }
  }

  function pasteLocation(target: NonNullable<Placing>, key: string) {
    const p = parseCoordinates(pasteFor[key] || "");
    if (!p) { window.alert("Não reconheci a coordenada. Exemplos: -19.917578, -43.938611 · 19°55'03\"S 43°56'19\"W · link do Google Maps com @-19.91,-43.93"); return; }
    place(target, p, "Coordenada");
    setPasteFor((m) => ({ ...m, [key]: "" }));
    mapRef.current?.setView([p.lat, p.lng], 18);
  }

  // ---------- Exportação ----------
  function download(name: string, content: string, type: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    data.addAudit("Mapa exportado", `Exportou ${events.length} fato(s) em ${name.split(".").pop()?.toUpperCase()}.`);
  }
  const names = (e: Event) => e.authorIds.map((id) => authorById.get(id)?.name).filter(Boolean).join("; ");
  const exportKml = () => download("mapa-criminal.kml", `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Mapa criminal — SI 6ª CIA (RESERVADO)</name>
${events.map((e) => `<Placemark><name>${esc(e.crime)} ${e.date ? formatBR(e.date) : ""}</name><description>${esc([e.reference && `REDS ${e.reference}`, e.time && `Hora ${e.time}`, e.place, names(e) && `Autores: ${names(e)}`].filter(Boolean).join("\n"))}</description><Point><coordinates>${e.lng},${e.lat},0</coordinates></Point></Placemark>`).join("\n")}
${authorGroups.filter((g) => g.author!.homeLat != null).map((g) => `<Placemark><name>Residência — ${esc(g.author!.name)}</name><Point><coordinates>${g.author!.homeLng},${g.author!.homeLat},0</coordinates></Point></Placemark>`).join("\n")}
</Document></kml>`, "application/vnd.google-earth.kml+xml");
  const exportCsv = () => download("mapa-criminal.csv", `﻿${[["crime", "data", "hora", "dia", "latitude", "longitude", "origem", "endereco", "reds", "autores", "investigacao"],
    ...events.map((e) => [e.crime, e.date, e.time, e.weekday !== null ? WEEK[e.weekday] : "", e.lat.toFixed(6), e.lng.toFixed(6), e.item.geoSource, e.place, e.reference, names(e), e.inv?.code || ""])]
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\n")}`, "text/csv");

  // ---------- Estatísticas ----------
  const stats = useMemo(() => {
    const pts = events.map((e) => ({ lat: e.lat, lng: e.lng }));
    const byWeek = WEEK.map((_, d) => events.filter((e) => e.weekday === d).length);
    const byBand = BAND.map(([, a, b]) => events.filter((e) => e.hour !== null && e.hour >= a && e.hour < b).length);
    const byHour = Array.from({ length: 24 }, (_, h) => events.filter((e) => e.hour === h).length);
    const byCrime = crimes.map((c) => [c, events.filter((e) => e.crime === c).length] as const).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
    const hull = convexHull(pts);
    const median = geometricMedian(pts);
    const profile = geographicProfile(pts);
    const top = [...profile].sort((a, b) => b.value - a.value)[0];
    const perAuthor = authorGroups.map((g) => {
      const a = g.author!;
      const ap = g.events.map((e) => ({ lat: e.lat, lng: e.lng }));
      const home = a.homeLat != null ? { lat: a.homeLat, lng: a.homeLng! } : null;
      const dists = home ? ap.map((p) => distance(home, p)) : [];
      const h = convexHull(ap);
      return { a, color: g.color, n: g.events.length, area: polygonArea(h), median: geometricMedian(ap), avgHome: dists.length ? dists.reduce((s, d) => s + d, 0) / dists.length : null, minHome: dists.length ? Math.min(...dists) : null, maxHome: dists.length ? Math.max(...dists) : null };
    });
    return { byWeek, byBand, byHour, byCrime, area: polygonArea(hull), nn: meanNearestNeighbor(pts), median, top: top && top.value ? top.center : null, perAuthor, hot: hotspots(events, 300).slice(0, 5) };
  }, [events, crimes, authorGroups]);

  const toggle = <T,>(set: Set<T>, value: T, setter: (s: Set<T>) => void) => { const n = new Set(set); n.has(value) ? n.delete(value) : n.add(value); setter(n); };
  const chip = (active: boolean) => `rounded-sm border px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${active ? "border-pm-black bg-pm-black text-white" : "border-pm-line bg-white text-pm-ink hover:border-pm-gold"}`;
  const filtersOn = fCrimes.size + fAuthors.size + fInv.size + fWeek.size + fBand.size + (from ? 1 : 0) + (to ? 1 : 0);
  const homesMissing = authorGroups.filter((g) => g.author!.homeLat == null);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        {/* Painel lateral */}
        <aside className="space-y-3">
          <div className="grid grid-cols-3 gap-1 rounded-sm border border-pm-line bg-white p-1">
            {([["filtros", "Filtros", Filter], ["camadas", "Análises", Layers], ["localizar", `Localizar${missing.length ? ` (${missing.length})` : ""}`, MapPin]] as const).map(([k, label, Icon]) => (
              <button key={k} type="button" onClick={() => setPanel(k)} className={`flex items-center justify-center gap-1 rounded-sm px-2 py-2 text-[11px] font-black uppercase ${panel === k ? "bg-pm-black text-white" : "text-pm-ink hover:bg-pm-cream"}`}><Icon className="h-3.5 w-3.5" />{label}</button>
            ))}
          </div>

          {panel === "filtros" && (
            <div className="space-y-4 rounded-sm border border-pm-line bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="pm-label !mb-0">{events.length} de {allEvents.length} fato(s) no mapa</p>
                {filtersOn > 0 && <button type="button" className="text-xs font-bold text-pm-gold-dark" onClick={() => { setFCrimes(new Set()); setFAuthors(new Set()); setFInv(new Set()); setFWeek(new Set()); setFBand(new Set()); setFrom(""); setTo(""); }}>Limpar ({filtersOn})</button>}
              </div>
              {investigations && investigations.length > 1 && (
                <div><p className="pm-label">Investigação</p><div className="flex flex-wrap gap-1">{investigations.filter((inv) => items.some((i) => i.investigationId === inv.id && i.lat != null)).map((inv) => <button key={inv.id} type="button" className={chip(fInv.has(inv.id))} onClick={() => toggle(fInv, inv.id, setFInv)} title={inv.title}>{inv.code}</button>)}</div></div>
              )}
              <div><p className="pm-label">Crime</p><div className="flex flex-wrap gap-1">{crimes.length ? crimes.map((c) => <button key={c} type="button" className={chip(fCrimes.has(c))} onClick={() => toggle(fCrimes, c, setFCrimes)}><span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: colorOfCrime(c) }} />{c}</button>) : <span className="text-xs text-pm-muted">—</span>}</div></div>
              <div><p className="pm-label">Autor</p>
                <div className="max-h-44 space-y-1 overflow-auto">{authorsInScope.length ? authorsInScope.map((a) => (
                  <label key={a.id} className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#7A6C45]" checked={fAuthors.has(a.id)} onChange={() => toggle(fAuthors, a.id, setFAuthors)} /><span className="truncate">{a.name}{a.alias ? ` ("${a.alias}")` : ""}</span></label>
                )) : <span className="text-xs text-pm-muted">Vincule autores às fontes para filtrar.</span>}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label><span className="pm-label">De</span><Input type="date" className="h-9" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
                <label><span className="pm-label">Até</span><Input type="date" className="h-9" value={to} onChange={(e) => setTo(e.target.value)} /></label>
              </div>
              <div><p className="pm-label">Dia da semana</p><div className="flex flex-wrap gap-1">{WEEK.map((d, i) => <button key={d} type="button" className={chip(fWeek.has(i))} onClick={() => toggle(fWeek, i, setFWeek)}>{d}</button>)}</div></div>
              <div><p className="pm-label">Horário</p><div className="flex flex-wrap gap-1">{BAND.map(([label], i) => <button key={label} type="button" className={chip(fBand.has(i))} onClick={() => toggle(fBand, i, setFBand)}>{label}</button>)}</div></div>
              <div><p className="pm-label">Cor dos pontos</p>
                <Select className="h-9" value={colorBy} onChange={(e) => setColorBy(e.target.value as "crime" | "autor")}><option value="autor">Por autor</option><option value="crime">Por crime</option></Select>
              </div>
            </div>
          )}

          {panel === "camadas" && (
            <div className="space-y-2 rounded-sm border border-pm-line bg-white p-3">
              <p className="pm-label">Mapa base</p>
              <div className="grid grid-cols-4 gap-1">{(Object.keys(BASES) as Base[]).map((b) => <button key={b} type="button" className={chip(base === b)} onClick={() => setBase(b)}>{BASES[b].label}</button>)}</div>
              <p className="pm-label pt-2">Camadas de análise</p>
              {LAYERS.map(([key, label, hint]) => (
                <label key={key} className="flex cursor-pointer items-start gap-2 rounded-sm px-1 py-1 hover:bg-pm-cream">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#7A6C45]" checked={layers.has(key)} onChange={() => toggle(layers, key, setLayers)} />
                  <span><b className="block text-sm">{label}</b><span className="text-xs text-pm-muted">{hint}</span></span>
                </label>
              ))}
              <p className="pt-1 text-[11px] text-pm-muted">Perfil geográfico e círculo de Canter precisam de 3+ fatos do mesmo autor (filtre por autor para o resultado individual).</p>
            </div>
          )}

          {panel === "localizar" && (
            <div className="space-y-3 rounded-sm border border-pm-line bg-white p-3 text-sm">
              <p className="text-xs text-pm-muted"><b>Mais preciso → menos preciso:</b> 1) coordenada do REDS (lida sozinha); 2) clicar no ponto exato no satélite; 3) colar coordenada/link do Google Maps; 4) busca por endereço (só ponto de partida — confira e arraste).</p>
              {missing.some((i) => i.filePath) && <Button size="sm" variant="gold" className="w-full" disabled={Boolean(busy)} onClick={() => readFromReds(missing.filter((i) => i.filePath))}><ScanText />Ler coordenadas dos PDFs do REDS</Button>}
              {missing.length === 0 && <p className="rounded-sm bg-status-done/10 px-2 py-1.5 text-xs font-semibold text-status-done">Todas as fontes com local já estão no mapa.</p>}
              {missing.map((item) => {
                const target: Placing = { kind: "item", item };
                const active = placing?.kind === "item" && placing.item.id === item.id;
                return (
                  <div key={item.id} className={`rounded-sm border p-2 ${active ? "border-pm-gold bg-pm-gold/10" : "border-pm-line"}`}>
                    <p className="text-xs font-black uppercase">{crimeOf(item)}{item.itemDate ? ` · ${formatBR(item.itemDate)}` : ""}</p>
                    <p className="truncate text-xs text-pm-muted">{item.place || item.title}{item.reference ? ` · REDS ${item.reference}` : ""}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Button size="sm" variant={active ? "primary" : "outline"} onClick={() => setPlacing(active ? null : target)}><Crosshair />{active ? "Clique no mapa…" : "Marcar"}</Button>
                      {(item.place || item.title) && <Button size="sm" onClick={() => searchAddress(item.id, item.place || item.title.split(" — ").slice(1).join(" "))} disabled={Boolean(busy)}><Search />Endereço</Button>}
                    </div>
                    <div className="mt-1.5 flex gap-1">
                      <Input className="h-8 text-xs" placeholder="Colar coordenada ou link" value={pasteFor[item.id] || ""} onChange={(e) => setPasteFor((m) => ({ ...m, [item.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && pasteLocation(target, item.id)} />
                      <Button size="sm" onClick={() => pasteLocation(target, item.id)}>OK</Button>
                    </div>
                    {search?.id === item.id && (
                      <div className="mt-1.5 space-y-1">
                        {search.results.length === 0 && <p className="text-xs text-status-late">Endereço não encontrado. Marque no mapa.</p>}
                        {search.results.map((r, i) => (
                          <button key={i} type="button" className="block w-full rounded-sm bg-pm-cream px-2 py-1 text-left text-[11px] hover:bg-pm-gold/20" onClick={() => { place(target, r, "Endereço"); setSearch(null); }}>{r.label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {authorGroups.length > 0 && (
                <div className="border-t border-pm-line pt-3">
                  <p className="pm-label">Residência dos autores</p>
                  {authorGroups.map((g) => {
                    const a = g.author!;
                    const target: Placing = { kind: "home", author: a };
                    const active = placing?.kind === "home" && placing.author.id === a.id;
                    const key = `home-${a.id}`;
                    return (
                      <div key={a.id} className={`mb-1.5 rounded-sm border p-2 ${active ? "border-pm-gold bg-pm-gold/10" : "border-pm-line"}`}>
                        <p className="flex items-center gap-1.5 text-xs font-black uppercase"><span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />{a.name}</p>
                        <p className="truncate text-xs text-pm-muted">{[a.address, a.neighborhood, a.city].filter(Boolean).join(" — ") || "Sem endereço no card"}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {a.homeLat != null ? <Badge tone="done">No mapa</Badge> : <Badge>Sem local</Badge>}
                          <Button size="sm" variant={active ? "primary" : "outline"} onClick={() => setPlacing(active ? null : target)}><Home />{active ? "Clique no mapa…" : a.homeLat != null ? "Mudar" : "Marcar"}</Button>
                          {a.address && <Button size="sm" onClick={() => searchAddress(key, [a.address, a.neighborhood, a.city].filter(Boolean).join(", "))}><Search /></Button>}
                          {a.homeLat != null && <Button size="sm" variant="danger" onClick={() => data.setAuthorHome(a, null)} aria-label="Remover residência"><Trash2 /></Button>}
                        </div>
                        <div className="mt-1.5 flex gap-1">
                          <Input className="h-8 text-xs" placeholder="Colar coordenada ou link" value={pasteFor[key] || ""} onChange={(e) => setPasteFor((m) => ({ ...m, [key]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && pasteLocation(target, key)} />
                          <Button size="sm" onClick={() => pasteLocation(target, key)}>OK</Button>
                        </div>
                        {search?.id === key && search.results.map((r, i) => (
                          <button key={i} type="button" className="mt-1 block w-full rounded-sm bg-pm-cream px-2 py-1 text-left text-[11px] hover:bg-pm-gold/20" onClick={() => { place(target, r, "Endereço"); setSearch(null); }}>{r.label}</button>
                        ))}
                      </div>
                    );
                  })}
                  {homesMissing.length > 0 && <p className="text-[11px] text-pm-muted">Com a residência marcada, o mapa mostra a distância casa → fato e a camada “Residências × fatos”.</p>}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Mapa */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {placing && (
              <span className="inline-flex items-center gap-2 rounded-sm bg-pm-gold px-3 py-1.5 text-sm font-bold text-pm-black">
                <Crosshair className="h-4 w-4" />Clique no ponto exato {placing.kind === "home" ? `da residência de ${placing.author.name}` : "do fato"}
                <button type="button" onClick={() => setPlacing(null)} aria-label="Cancelar"><X className="h-4 w-4" /></button>
              </span>
            )}
            {busy && <span className="inline-flex items-center gap-2 text-sm text-pm-muted"><Loader2 className="h-4 w-4 animate-spin" />{busy}</span>}
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Button size="sm" variant={moving ? "primary" : "outline"} onClick={() => setMoving((v) => !v)} title="Arrastar pontos e residências para corrigir"><Move />{moving ? "Concluir ajuste" : "Ajustar posições"}</Button>
              <Button size="sm" onClick={() => setFitKey((k) => k + 1)}><LocateFixed />Enquadrar</Button>
              <Button size="sm" onClick={exportKml} disabled={!events.length} title="Abre no Google Earth e no Google My Maps"><Download />KML</Button>
              <Button size="sm" onClick={exportCsv} disabled={!events.length}><Download />CSV</Button>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-sm border border-pm-line bg-pm-sand" style={{ height }}>
            <div ref={mapEl} className="h-full w-full" />
            {!allEvents.length && !placing && (
              <div className="pointer-events-none absolute inset-x-0 top-4 z-[500] mx-auto w-fit max-w-[90%] rounded-sm bg-pm-black/85 px-4 py-2 text-center text-sm text-white">
                Nenhum fato localizado ainda. Use a aba <b>Localizar</b>: o sistema lê a coordenada do REDS ou você marca no mapa.
              </div>
            )}
            {layers.has("calor") && events.length > 0 && (
              <div className="pointer-events-none absolute bottom-6 right-2 z-[500] rounded-sm bg-white/90 px-2 py-1 text-[10px] font-bold uppercase">
                Densidade <span className="ml-1 inline-block h-2 w-24 rounded-full align-middle" style={{ background: "linear-gradient(90deg,#2b83ba,#5ec2a6,#fee08b,#f46d43,#b2182b)" }} />
              </div>
            )}
          </div>
          <p className="text-[11px] text-pm-muted">Imagens de satélite: Esri · Ruas: OpenStreetMap. Cada ponto tem link para o Google Maps e o Street View. Material de uso reservado.</p>
        </div>
      </div>

      {/* Conhecimento produzido */}
      {events.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-sm border border-pm-line bg-white p-4">
            <p className="pm-eyebrow mb-2">Quando acontece</p>
            <p className="pm-label">Dia da semana</p>
            <Bars values={stats.byWeek} labels={WEEK} />
            <p className="pm-label mt-3">Hora do fato</p>
            <Bars values={stats.byHour} labels={stats.byHour.map((_, h) => (h % 3 === 0 ? `${h}h` : ""))} />
            <p className="mt-2 text-xs text-pm-muted">{(() => {
              const d = stats.byWeek.indexOf(Math.max(...stats.byWeek)); const b = stats.byBand.indexOf(Math.max(...stats.byBand));
              return `Maior incidência: ${WEEK[d]}${Math.max(...stats.byBand) ? ` · ${BAND[b][0].toLowerCase()}` : ""}.`;
            })()}</p>
          </div>
          <div className="rounded-sm border border-pm-line bg-white p-4">
            <p className="pm-eyebrow mb-2">Onde acontece</p>
            <div className="space-y-1 text-sm">
              {stats.byCrime.map(([c, n]) => <p key={c} className="flex justify-between gap-2"><span className="inline-flex items-center gap-1.5 truncate"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOfCrime(c) }} />{c}</span><b>{n}</b></p>)}
              <p className="flex justify-between border-t border-pm-line pt-1"><span>Área de atuação (todos)</span><b>{(stats.area / 1e6).toFixed(2)} km²</b></p>
              <p className="flex justify-between"><span>Distância média ao fato mais próximo</span><b>{formatDistance(stats.nn)}</b></p>
              {stats.median && <p className="flex justify-between gap-2"><span>Centro de menor distância</span><a className="font-bold text-pm-gold-dark underline" href={googleMapsUrl(stats.median)} target="_blank" rel="noreferrer">{formatCoord(stats.median)}</a></p>}
              {stats.top && <p className="flex justify-between gap-2"><span>Área prioritária (perfil geográfico)</span><a className="font-bold text-pm-gold-dark underline" href={googleMapsUrl(stats.top)} target="_blank" rel="noreferrer">{formatCoord(stats.top)}</a></p>}
            </div>
            {stats.hot.length > 0 && <>
              <p className="pm-label mt-3">Pontos quentes</p>
              {stats.hot.map((h, i) => (
                <button key={i} type="button" className="block w-full truncate rounded-sm px-1 py-0.5 text-left text-sm hover:bg-pm-cream" onClick={() => mapRef.current?.setView([h.center.lat, h.center.lng], 18)}>
                  <b>{i + 1}.</b> {h.items.length} fatos — {h.items[0].place || formatCoord(h.center)}
                </button>
              ))}
            </>}
          </div>
          <div className="rounded-sm border border-pm-line bg-white p-4">
            <p className="pm-eyebrow mb-2">Por autor</p>
            {stats.perAuthor.length === 0 && <p className="text-sm text-pm-muted">Vincule os autores às fontes (BO) para ver o padrão de cada um.</p>}
            <div className="space-y-2">
              {stats.perAuthor.map((s) => (
                <button key={s.a.id} type="button" onClick={() => setFAuthors(new Set([s.a.id]))} className="block w-full rounded-sm border border-pm-line p-2 text-left text-xs hover:border-pm-gold">
                  <p className="flex items-center gap-1.5 text-sm font-black uppercase"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.a.name}</p>
                  <p>{s.n} fato(s){s.area ? ` · área ${(s.area / 1e6).toFixed(2)} km²` : ""}</p>
                  {s.avgHome !== null ? <p>Casa → fatos: média {formatDistance(s.avgHome)} (mín. {formatDistance(s.minHome!)} · máx. {formatDistance(s.maxHome!)})</p> : <p className="text-pm-muted">Residência não marcada.</p>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Bars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-20 items-end gap-0.5">
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-0.5" title={`${labels[i] || i}: ${v}`}>
          {v > 0 && <span className="text-[9px] font-bold text-pm-muted">{v}</span>}
          <div className="w-full rounded-t-[2px] bg-pm-gold" style={{ height: `${(v / max) * 52}px`, minHeight: v ? 3 : 1, opacity: v ? 1 : 0.25 }} />
          <span className="h-3 text-[9px] text-pm-muted">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}
