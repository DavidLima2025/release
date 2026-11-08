/** Geometria e análises espaciais do mapa criminal (sem dependências). */

export type LatLng = { lat: number; lng: number };

const valid = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

/** "-19º 55' 3,28"" → -19.9175… (aceita º/°, vírgula decimal e sinal no grau). */
export function dmsToDecimal(deg: string, min: string, sec: string) {
  const d = parseFloat(deg.replace(",", "."));
  const m = parseFloat((min || "0").replace(",", "."));
  const s = parseFloat((sec || "0").replace(",", "."));
  const abs = Math.abs(d) + m / 60 + s / 3600;
  return (deg.trim().startsWith("-") ? -1 : 1) * abs;
}

const DMS = /(-?\d{1,3})\s*[º°ᵒo]\s*(\d{1,2})\s*['’′]\s*(\d{1,2}(?:[.,]\d+)?)\s*(?:["”″]|'')?\s*([NSLOWE])?/gi;

/** Lê as coordenadas do campo LATITUDE/LONGITUDE do REDS (graus, minutos, segundos ou decimal). */
export function coordsFromRedsText(text: string): LatLng | null {
  const start = text.search(/LATITUDE/i);
  const scope = start >= 0 ? text.slice(start, start + 600) : text;
  const dms = [...scope.matchAll(DMS)];
  if (dms.length >= 2) {
    const toNum = (m: RegExpMatchArray) => {
      let v = dmsToDecimal(m[1], m[2], m[3]);
      if (m[4] && /[SOW]/i.test(m[4]) && v > 0) v = -v;
      return v;
    };
    let lat = toNum(dms[0]);
    let lng = toNum(dms[1]);
    // Brasil: hemisfério sul e oeste; o REDS às vezes omite o sinal.
    if (lat > 0 && lng > 0 && lng > 30) { lat = -lat; lng = -lng; }
    if (valid(lat, lng)) return { lat, lng };
  }
  const dec = scope.match(/(-?\d{1,2}[.,]\d{3,})\D{1,40}?(-?\d{1,3}[.,]\d{3,})/);
  if (dec) {
    const lat = parseFloat(dec[1].replace(",", "."));
    const lng = parseFloat(dec[2].replace(",", "."));
    if (valid(lat, lng)) return { lat, lng };
  }
  return null;
}

/**
 * Aceita o que o usuário colar: "-19.917, -43.938", "-19,917 -43,938", graus/min/seg,
 * ou link do Google Maps (…/@-19.917,-43.938,17z, ?q=-19.917,-43.938, !3d-19.9!4d-43.9).
 */
export function parseCoordinates(input: string): LatLng | null {
  const t = (input || "").trim();
  if (!t) return null;
  const g = t.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || t.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || t.match(/[?&](?:q|ll|query|destination)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i);
  if (g) { const lat = +g[1]; const lng = +g[2]; return valid(lat, lng) ? { lat, lng } : null; }
  const dms = [...t.matchAll(DMS)];
  if (dms.length >= 2) return coordsFromRedsText(`LATITUDE ${t}`);
  const nums = t.replace(/(\d),(\d)/g, "$1.$2").match(/-?\d+(?:\.\d+)?/g);
  if (nums && nums.length >= 2) {
    const lat = +nums[0]; const lng = +nums[1];
    if (valid(lat, lng)) return { lat, lng };
  }
  return null;
}

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distância em metros. */
export function distance(a: LatLng, b: LatLng) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const formatDistance = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(m < 10000 ? 2 : 1)} km`);

/** Centro de gravidade (média). */
export function centroid(points: LatLng[]): LatLng | null {
  if (!points.length) return null;
  return { lat: points.reduce((s, p) => s + p.lat, 0) / points.length, lng: points.reduce((s, p) => s + p.lng, 0) / points.length };
}

/** Centro de menor distância (mediana geométrica, Weiszfeld): ponto que minimiza a soma das distâncias até os fatos. */
export function geometricMedian(points: LatLng[]): LatLng | null {
  let cur = centroid(points);
  if (!cur || points.length < 3) return cur;
  for (let i = 0; i < 200; i += 1) {
    let num = { lat: 0, lng: 0 };
    let den = 0;
    for (const p of points) {
      const d = Math.max(distance(cur, p), 0.5);
      num = { lat: num.lat + p.lat / d, lng: num.lng + p.lng / d };
      den += 1 / d;
    }
    const next = { lat: num.lat / den, lng: num.lng / den };
    if (distance(cur, next) < 0.5) return next;
    cur = next;
  }
  return cur;
}

/** Envoltória convexa (área de atuação). */
export function convexHull(points: LatLng[]): LatLng[] {
  const pts = [...new Map(points.map((p) => [`${p.lat.toFixed(6)},${p.lng.toFixed(6)}`, p])).values()].sort((a, b) => a.lng - b.lng || a.lat - b.lat);
  if (pts.length < 3) return pts;
  const cross = (o: LatLng, a: LatLng, b: LatLng) => (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
  const lower: LatLng[] = [];
  for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
  const upper: LatLng[] = [];
  for (const p of [...pts].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Área de um polígono em m² (projeção local). */
export function polygonArea(poly: LatLng[]) {
  if (poly.length < 3) return 0;
  const c = centroid(poly)!;
  const k = Math.cos(rad(c.lat));
  const xy = poly.map((p) => ({ x: rad(p.lng - c.lng) * R * k, y: rad(p.lat - c.lat) * R }));
  let s = 0;
  for (let i = 0; i < xy.length; i += 1) { const a = xy[i]; const b = xy[(i + 1) % xy.length]; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s / 2);
}

/** Círculo de Canter: diâmetro = os dois fatos mais distantes; a base do autor costuma estar dentro (hipótese do "saqueador"). */
export function canterCircle(points: LatLng[]): { center: LatLng; radius: number } | null {
  if (points.length < 2) return null;
  let best = { a: points[0], b: points[1], d: -1 };
  for (let i = 0; i < points.length; i += 1) for (let j = i + 1; j < points.length; j += 1) {
    const d = distance(points[i], points[j]);
    if (d > best.d) best = { a: points[i], b: points[j], d };
  }
  return { center: { lat: (best.a.lat + best.b.lat) / 2, lng: (best.a.lng + best.b.lng) / 2 }, radius: best.d / 2 };
}

/** Distância média ao vizinho mais próximo (dispersão dos fatos). */
export function meanNearestNeighbor(points: LatLng[]) {
  if (points.length < 2) return 0;
  return points.reduce((sum, p, i) => sum + Math.min(...points.filter((_, j) => j !== i).map((q) => distance(p, q))), 0) / points.length;
}

export type GridCell = { center: LatLng; bounds: [LatLng, LatLng]; value: number };

/**
 * Perfil geográfico (fórmula de Rossmo, simplificada): probabilidade de cada célula ser a base do autor,
 * com zona de proteção (o autor evita agir muito perto de casa) e decaimento com a distância.
 */
export function geographicProfile(points: LatLng[], options: { cells?: number; buffer?: number } = {}): GridCell[] {
  if (points.length < 3) return [];
  const n = options.cells || 60;
  const lats = points.map((p) => p.lat); const lngs = points.map((p) => p.lng);
  const padLat = (Math.max(...lats) - Math.min(...lats)) * 0.35 + 0.004;
  const padLng = (Math.max(...lngs) - Math.min(...lngs)) * 0.35 + 0.004;
  const minLat = Math.min(...lats) - padLat; const maxLat = Math.max(...lats) + padLat;
  const minLng = Math.min(...lngs) - padLng; const maxLng = Math.max(...lngs) + padLng;
  const dLat = (maxLat - minLat) / n; const dLng = (maxLng - minLng) / n;
  // Zona de proteção ≈ metade da distância média ao vizinho mais próximo (mínimo 150 m).
  const B = Math.max(150, options.buffer ?? meanNearestNeighbor(points) / 2);
  const f = 1.2; const g = 1.2;
  const cells: GridCell[] = [];
  let max = 0;
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) {
    const center = { lat: minLat + (i + 0.5) * dLat, lng: minLng + (j + 0.5) * dLng };
    let v = 0;
    for (const p of points) {
      // Distância "Manhattan" aproximada em metros, como no modelo original (deslocamento por ruas).
      const d = Math.max(1, Math.abs(rad(center.lat - p.lat) * R) + Math.abs(rad(center.lng - p.lng) * R * Math.cos(rad(center.lat))));
      v += d > B ? 1 / d ** f : B ** (g - f) / (2 * B - d) ** g;
    }
    max = Math.max(max, v);
    cells.push({ center, bounds: [{ lat: center.lat - dLat / 2, lng: center.lng - dLng / 2 }, { lat: center.lat + dLat / 2, lng: center.lng + dLng / 2 }], value: v });
  }
  return cells.map((c) => ({ ...c, value: max ? c.value / max : 0 }));
}

/** Pontos quentes: agrupa fatos em células de `meters` e devolve as mais carregadas. */
export function hotspots<T extends LatLng>(points: T[], meters = 300) {
  const map = new Map<string, T[]>();
  for (const p of points) {
    const key = `${Math.floor(rad(p.lat) * R / meters)}:${Math.floor(rad(p.lng) * R * Math.cos(rad(p.lat)) / meters)}`;
    map.set(key, [...(map.get(key) || []), p]);
  }
  return [...map.values()].filter((g) => g.length > 1).map((g) => ({ center: centroid(g)!, items: g })).sort((a, b) => b.items.length - a.items.length);
}

/** Busca de endereço (OpenStreetMap / Nominatim, gratuito). Serve de ponto de partida: confira no satélite. */
export async function geocodeAddress(query: string): Promise<(LatLng & { label: string })[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const rows = await res.json();
  return (rows || []).map((r: any) => ({ lat: +r.lat, lng: +r.lon, label: r.display_name as string })).filter((r: any) => valid(r.lat, r.lng));
}

export const googleMapsUrl = (p: LatLng) => `https://www.google.com/maps/search/?api=1&query=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
export const streetViewUrl = (p: LatLng) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
export const formatCoord = (p: LatLng) => `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)}`;
