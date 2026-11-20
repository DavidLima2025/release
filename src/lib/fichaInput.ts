// Monta os dados da ficha do alvo (tela e PDF). Usado pela ficha individual e pelo dossiê da investigação.
import type { AppData } from "../hooks/useAppData";
import type { InvestigationsApi } from "../hooks/useInvestigations";
import { EXTRA_FIELDS, type Author } from "./domain";
import { formatBR } from "./dates";
import { companionsOf, redsCount } from "./companions";
import type { ReportImage } from "./report/model";
import type { FichaInput } from "./report/ficha";

export function fichaFacts(a: Author, data: AppData, api?: InvestigationsApi) {
  const allPhotos = data.authorPhotos.filter((p) => p.authorId === a.id);
  const photos = allPhotos.filter((p) => (p.category || "perfil") === "perfil");
  const photosOf = (cat: string) => allPhotos.filter((p) => (p.category || "perfil") === cat);
  const extraFilled = EXTRA_FIELDS.filter(([k]) => String(a.extra?.[k] || "").trim());
  const reports = data.authorReports.filter((r) => r.authorId === a.id);
  const folder = data.authorCategories.find((f) => f.id === a.categoryId)?.name || "Sem pasta";
  const canInv = Boolean(api && data.permissions.investigations);
  const linked = canInv ? api!.targets.filter((t) => t.authorId === a.id).map((t) => ({ t, inv: api!.investigations.find((i) => i.id === t.investigationId) })).filter((x) => x.inv) : [];
  const allItems = api?.items || [];
  const fromNotes = (reds: string, text: string) => {
    const m = text.match(new RegExp(`REDS ${reds}[^—\\n]*—\\s*(?:[A-Z]\\d{4,5}\\s*-\\s*)?([^,\\n]+?)(?:,\\s*([^\\n]+?))?\\.(?:\\n|$)`));
    return m ? { crime: m[1].trim(), place: (m[2] || "").trim() } : { crime: "", place: "" };
  };
  const history = redsCount(a.id, data.authors, data.authorReports, allItems).map((h) => {
    const item = allItems.find((i) => i.reference && i.reference.includes(h.reds) && i.authorIds.includes(a.id)) || allItems.find((i) => i.reference && i.reference.includes(h.reds));
    const n = fromNotes(h.reds, a.notes || "");
    const rep = data.authorReports.find((r) => r.reds === h.reds && (r.crime || r.place || r.eventDate));
    return {
      reds: h.reds, date: item?.itemDate || rep?.eventDate || h.date, time: item?.eventTime || rep?.eventTime || "", role: h.role,
      crime: item ? item.crime || item.title.split(" — ")[0] : rep?.crime || n.crime, place: item?.place || rep?.place || n.place,
      inv: item ? api?.investigations.find((i) => i.id === item.investigationId)?.code || "" : "",
    };
  });
  const companions = companionsOf(a.id, data.authors, data.authorReports, allItems);
  return { allPhotos, photos, photosOf, extraFilled, reports, folder, canInv, linked, allItems, history, companions };
}

/** Recorta a foto principal em 3:4 (retrato) para a ficha. */
export async function cropPortrait(img?: ReportImage): Promise<ReportImage | undefined> {
  if (!img) return undefined;
  const el = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = img.dataUrl; });
  const ratio = 3 / 4;
  let sw = el.naturalWidth; let sh = el.naturalHeight;
  if (sw / sh > ratio) sw = sh * ratio; else sh = sw / ratio;
  const sx = (el.naturalWidth - sw) / 2; const sy = Math.max(0, (el.naturalHeight - sh) * 0.3);
  const c = document.createElement("canvas");
  c.width = Math.round(Math.min(600, sw)); c.height = Math.round(c.width / ratio);
  c.getContext("2d")!.drawImage(el, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL("image/jpeg", 0.88);
  return { bytes: Uint8Array.from(atob(dataUrl.split(",")[1]), (ch) => ch.charCodeAt(0)), type: "jpg", dataUrl, width: c.width, height: c.height };
}

export type FichaOptions = { gallery?: boolean; extraPhotos?: boolean; roleInInv?: string; noteInInv?: string };

export async function buildFichaInput(a: Author, data: AppData, api: InvestigationsApi | undefined, opts: FichaOptions = {}): Promise<FichaInput> {
  const { loadImage } = await import("../hooks/useInvestigations");
  const f = fichaFacts(a, data, api);
  const { gallery = true, extraPhotos = true } = opts;
  const [logo, main, ...extra] = await Promise.all([
    loadImage("/pmmg-logo.png", true),
    f.photos[0] ? loadImage(data.getIntelFileUrl(f.photos[0].filePath)) : Promise.resolve(undefined),
    ...(extraPhotos ? f.photos.slice(1, 5) : []).map((p) => loadImage(data.getIntelFileUrl(p.filePath))),
  ]);
  const loadCat = async (cat: string) => {
    const out: { img: ReportImage; caption: string }[] = [];
    if (!gallery) return out;
    for (const p of f.photosOf(cat).slice(0, 8)) { const img = await loadImage(data.getIntelFileUrl(p.filePath)); if (img) out.push({ img: img as ReportImage, caption: p.description || "" }); }
    return out;
  };
  const [occurrencePhotos, surveyPhotos] = await Promise.all([loadCat("ocorrencia"), loadCat("levantamento")]);
  return {
    occurrencePhotos, surveyPhotos,
    name: a.name, alias: a.alias, status: a.status, riskLevel: a.riskLevel, folder: f.folder,
    birthDate: a.birthDate, motherName: a.motherName, fatherName: a.fatherName, document: a.document,
    address: a.address, neighborhood: a.neighborhood, city: a.city,
    home: a.homeLat != null ? `${a.homeLat.toFixed(6)}, ${a.homeLng!.toFixed(6)}` : undefined,
    crimes: a.crimes, notes: opts.noteInInv || "",
    extra: f.extraFilled.map(([k, label]) => ({ label, value: a.extra[k] })),
    photo: await cropPortrait(main as ReportImage | undefined), extraPhotos: extra.filter(Boolean) as ReportImage[], logo: logo as ReportImage | undefined,
    investigations: f.linked.map(({ t, inv }) => ({ code: inv!.code, title: inv!.title, role: t.role })),
    occurrences: f.history.map((o) => ({ date: o.date, time: o.time, crime: [o.crime, o.role && `(${o.role})`].filter(Boolean).join(" "), reference: o.reds, place: o.place, inv: o.inv })),
    companions: f.companions.map((c) => ({
      name: c.author.name, alias: c.author.alias, together: c.arrestedTogether ? "Preso/conduzido junto" : "Envolvido no mesmo BO",
      reds: c.occurrences.map((o) => `${o.reds}${o.date ? ` (${formatBR(o.date)})` : ""}`).join("; "),
    })),
    attachments: f.reports.map((r) => (r.description ? `${r.fileName} — ${r.description}` : r.fileName)),
    generatedBy: data.currentUser?.warName || data.currentUser?.name || "",
    generatedAt: new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
  };
}

export const fileSlug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
