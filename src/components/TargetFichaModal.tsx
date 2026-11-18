import { useState } from "react";
import { Camera, Download, Edit3, FileText, FolderInput, FolderLock, Image as ImageIcon, Link2, Loader2, MapPin, MessageCircle, Paperclip, Share2, Trash2, Upload, UserRound } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Select } from "./ui/input";
import { Badge } from "./ui/badge";
import type { AppData } from "../hooks/useAppData";
import type { InvestigationsApi } from "../hooks/useInvestigations";
import type { Author } from "../lib/domain";
import { formatBytes } from "../lib/domain";
import { formatBR, formatDateTimeBR } from "../lib/dates";
import { TARGET_ROLES, stageOf } from "../lib/investigation";
import type { ReportImage } from "../lib/report/model";

const riskTone = (risk: string) => (risk === "Alto" ? "late" : risk === "Médio" ? "risk" : "done") as any;

function ageOf(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const b = new Date(`${iso.slice(0, 10)}T12:00:00`); const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a -= 1;
  return a >= 0 && a < 120 ? `${a} anos` : "";
}

/** Recorta a foto principal em 3:4 (retrato) para a ficha. */
async function cropPortrait(img?: ReportImage): Promise<ReportImage | undefined> {
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

type Props = {
  author: Author | null; data: AppData; api?: InvestigationsApi;
  onClose: () => void; onEdit: (a: Author) => void; onMove: (a: Author) => void; onShareMessage: (a: Author) => void;
  onOpenInvestigation?: (id: string) => void;
};

/** Ficha detalhada do alvo, com geração do PDF e compartilhamento. */
export function TargetFichaModal({ author, data, api, onClose, onEdit, onMove, onShareMessage, onOpenInvestigation }: Props) {
  const [busy, setBusy] = useState<"" | "share" | "download">("");
  const [linkInv, setLinkInv] = useState({ id: "", role: "Associado" });
  if (!author) return null;
  const a = data.authors.find((x) => x.id === author.id) || author;
  const photos = data.authorPhotos.filter((p) => p.authorId === a.id);
  const reports = data.authorReports.filter((r) => r.authorId === a.id);
  const folder = data.authorCategories.find((f) => f.id === a.categoryId)?.name || "Sem pasta";
  const canInv = Boolean(api && data.permissions.investigations);
  const linked = canInv ? api!.targets.filter((t) => t.authorId === a.id).map((t) => ({ t, inv: api!.investigations.find((i) => i.id === t.investigationId) })).filter((x) => x.inv) : [];
  const available = canInv ? api!.investigations.filter((i) => (i.status === "Em andamento" || i.status === "Suspensa") && !linked.some((x) => x.inv!.id === i.id)) : [];
  const occurrences = canInv
    ? [...new Map(api!.items.filter((i) => i.authorIds.includes(a.id) && (i.kind === "Boletim de ocorrência" || i.reference)).map((i) => [i.reference || i.id, i])).values()]
      .sort((x, y) => (y.itemDate || "").localeCompare(x.itemDate || ""))
    : [];

  async function buildPdf() {
    const { loadImage } = await import("../hooks/useInvestigations");
    const [{ renderFicha }, logo, main, ...extra] = await Promise.all([
      import("../lib/report/ficha"),
      loadImage("/pmmg-logo.png", true),
      photos[0] ? loadImage(data.getIntelFileUrl(photos[0].filePath)) : Promise.resolve(undefined),
      ...photos.slice(1, 5).map((p) => loadImage(data.getIntelFileUrl(p.filePath))),
    ]);
    const bytes = await renderFicha({
      name: a.name, alias: a.alias, status: a.status, riskLevel: a.riskLevel, folder,
      birthDate: a.birthDate, motherName: a.motherName, fatherName: a.fatherName, document: a.document,
      address: a.address, neighborhood: a.neighborhood, city: a.city,
      home: a.homeLat != null ? `${a.homeLat.toFixed(6)}, ${a.homeLng!.toFixed(6)}` : undefined,
      crimes: a.crimes, notes: a.notes,
      photo: await cropPortrait(main as ReportImage | undefined), extraPhotos: extra.filter(Boolean) as ReportImage[], logo: logo as ReportImage | undefined,
      investigations: linked.map(({ t, inv }) => ({ code: inv!.code, title: inv!.title, role: t.role })),
      occurrences: occurrences.map((o) => ({
        date: o.itemDate, time: o.eventTime, crime: o.crime || o.title.split(" — ")[0], reference: o.reference, place: o.place,
        inv: api?.investigations.find((i) => i.id === o.investigationId)?.code || "",
      })),
      attachments: reports.map((r) => r.description ? `${r.fileName} — ${r.description}` : r.fileName),
      generatedBy: data.currentUser?.warName || data.currentUser?.name || "",
      generatedAt: new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
    });
    const name = `FICHA_${a.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "")}.pdf`;
    return new File([bytes as BlobPart], name, { type: "application/pdf" });
  }

  function download(file: File) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a"); link.href = url; link.download = file.name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  async function sharePdf() {
    setBusy("share");
    try {
      const file = await buildPdf();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Ficha — ${a.name}`, text: `*RESERVADO* — Ficha de ${a.name}${a.alias ? ` ("${a.alias}")` : ""}. Difusão restrita.` });
        await data.addAudit("Ficha compartilhada", `Compartilhou a ficha em PDF de ${a.name}.`);
      } else {
        download(file);
        await data.addAudit("Ficha gerada", `Baixou a ficha em PDF de ${a.name} para envio.`);
        window.alert("Este aparelho não envia arquivo direto para o WhatsApp. O PDF foi baixado: no WhatsApp (Web ou Desktop), clique no clipe 📎 e anexe o arquivo.");
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") { console.error(error); window.alert("Não foi possível gerar a ficha."); }
    } finally { setBusy(""); }
  }

  async function downloadPdf() {
    setBusy("download");
    try { download(await buildPdf()); await data.addAudit("Ficha gerada", `Baixou a ficha em PDF de ${a.name}.`); }
    catch (error) { console.error(error); window.alert("Não foi possível gerar a ficha."); }
    finally { setBusy(""); }
  }

  const field = (label: string, value: string, wide = false) => (
    <div className={`rounded-sm border border-pm-line bg-pm-cream/60 px-3 py-2 ${wide ? "sm:col-span-2" : ""}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-pm-muted">{label}</p><p className="whitespace-pre-wrap font-semibold">{value || "—"}</p>
    </div>
  );

  return (
    <Modal open={Boolean(author)} onClose={onClose} size="xl" eyebrow={`Ficha do alvo · ${folder}`} title={a.name}>
      <div className="space-y-5">
        <div className="grid gap-5 md:grid-cols-[200px_1fr]">
          <div className="aspect-[3/4] overflow-hidden rounded-sm bg-pm-black">
            {photos[0] ? <img src={data.getIntelFileUrl(photos[0].filePath)} alt={a.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><UserRound className="h-16 w-16 text-white/30" /></div>}
          </div>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-pm-muted">Vulgo: <b className="text-pm-ink">{a.alias || "não informado"}</b></p>
              <div className="mt-1.5 flex flex-wrap gap-1.5"><Badge>{a.status}</Badge><Badge tone={riskTone(a.riskLevel)}>Risco {a.riskLevel.toLowerCase()}</Badge><Badge tone="dark">{folder}</Badge><Badge tone="gold">RESERVADO</Badge></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="gold" onClick={sharePdf} disabled={Boolean(busy)}>{busy === "share" ? <Loader2 className="animate-spin" /> : <Share2 />}Enviar ficha (PDF)</Button>
              <Button size="sm" variant="gold" onClick={() => onShareMessage(a)}><MessageCircle />Mensagem com foto</Button>
              <Button size="sm" onClick={downloadPdf} disabled={Boolean(busy)}>{busy === "download" ? <Loader2 className="animate-spin" /> : <Download />}Baixar PDF</Button>
              <Button size="sm" onClick={() => onEdit(a)}><Edit3 />Editar</Button>
              <Button size="sm" onClick={() => onMove(a)}><FolderInput />Mover</Button>
              <Button size="sm" variant="danger" onClick={async () => { if (await data.deleteAuthor(a)) onClose(); }}><Trash2 />Excluir</Button>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              {field("Nascimento", [a.birthDate ? formatBR(a.birthDate) : "", ageOf(a.birthDate) && `(${ageOf(a.birthDate)})`].filter(Boolean).join(" "))}
              {field("Documentos", a.document)}
              {field("Mãe", a.motherName)}
              {field("Pai", a.fatherName)}
              {field("Endereço", [a.address, a.neighborhood, a.city].filter(Boolean).join(" — "), true)}
            </div>
          </div>
        </div>

        <div className="grid gap-2 text-sm">
          {field("Crimes / modus operandi", a.crimes)}
          {a.notes && field("Observações e vínculos", a.notes)}
          {a.homeLat != null && <p className="flex items-center gap-1.5 text-xs text-pm-muted"><MapPin className="h-3.5 w-3.5 text-pm-gold-dark" />Residência marcada no mapa: {a.homeLat.toFixed(6)}, {a.homeLng!.toFixed(6)}</p>}
          <p className="text-xs text-pm-muted">Card criado em {formatDateTimeBR(a.createdAt)}.</p>
        </div>

        {canInv && (
          <div className="rounded-sm border border-pm-line bg-white p-3">
            <p className="pm-label flex items-center gap-1.5"><FolderLock className="h-3.5 w-3.5 text-pm-gold-dark" />Investigações</p>
            {linked.length === 0 && <p className="text-sm text-pm-muted">Não está em nenhuma investigação.</p>}
            <div className="flex flex-wrap gap-2">
              {linked.map(({ t, inv }) => (
                <button key={t.id} type="button" onClick={() => { onClose(); onOpenInvestigation?.(inv!.id); }} className="rounded-sm border border-pm-line bg-pm-cream px-2.5 py-1.5 text-left text-xs hover:border-pm-gold">
                  <b className="text-pm-gold-dark">{inv!.code}</b> {inv!.title}<span className="block text-pm-muted">{t.role} · etapa {stageOf(inv!.stage).name.toLowerCase()}</span>
                </button>
              ))}
            </div>
            {available.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Select className="h-9 w-64" value={linkInv.id} onChange={(e) => setLinkInv({ ...linkInv, id: e.target.value })}><option value="">Vincular a investigação…</option>{available.map((i) => <option key={i.id} value={i.id}>{i.code} — {i.title}</option>)}</Select>
                <Select className="h-9 w-44" value={linkInv.role} onChange={(e) => setLinkInv({ ...linkInv, role: e.target.value })}>{TARGET_ROLES.map((r) => <option key={r}>{r}</option>)}</Select>
                <Button size="sm" variant="primary" className="!h-9" disabled={!linkInv.id} onClick={async () => { const inv = api!.investigations.find((i) => i.id === linkInv.id); if (inv && await api!.addTarget(inv, a.id, linkInv.role)) { data.reload(); setLinkInv({ id: "", role: linkInv.role }); } }}><Link2 />Vincular</Button>
              </div>
            )}
            {occurrences.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <p className="pm-label">Ocorrências vinculadas ({occurrences.length})</p>
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] uppercase tracking-wider text-pm-muted"><th className="py-1 pr-3">Data</th><th className="py-1 pr-3">Natureza</th><th className="py-1 pr-3">REDS</th><th className="py-1">Local</th></tr></thead>
                  <tbody>{occurrences.map((o) => (
                    <tr key={o.id} className="border-t border-pm-line align-top">
                      <td className="py-1.5 pr-3 whitespace-nowrap">{o.itemDate ? formatBR(o.itemDate) : "—"}{o.eventTime ? ` ${o.eventTime}` : ""}</td>
                      <td className="py-1.5 pr-3 font-semibold">{o.crime || o.title.split(" — ")[0]}</td>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{o.reference || "—"}</td>
                      <td className="py-1.5">{o.place || "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between"><p className="pm-heading flex items-center gap-2"><ImageIcon className="h-4 w-4 text-pm-gold-dark" />Fotos ({photos.length})</p>
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm bg-pm-black px-3 text-xs font-bold uppercase text-white hover:bg-pm-ink"><Camera className="h-3.5 w-3.5" />Subir foto<input type="file" accept="image/*" className="hidden" onChange={(e) => { data.uploadAuthorFile(a, e.target.files?.[0], "photo"); e.target.value = ""; }} /></label>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p) => (
                <a key={p.id} href={data.getIntelFileUrl(p.filePath)} target="_blank" rel="noreferrer" className="aspect-[3/4] overflow-hidden rounded-sm bg-pm-sand"><img src={data.getIntelFileUrl(p.filePath)} alt={p.fileName} loading="lazy" className="h-full w-full object-cover transition hover:scale-105" /></a>
              ))}
              {!photos.length && <p className="col-span-full text-sm text-pm-muted">Nenhuma foto.</p>}
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between"><p className="pm-heading flex items-center gap-2"><Paperclip className="h-4 w-4 text-pm-gold-dark" />Relatórios e BOs ({reports.length})</p>
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-pm-line bg-white px-3 text-xs font-bold uppercase hover:border-pm-gold"><Upload className="h-3.5 w-3.5" />Subir<input type="file" className="hidden" onChange={(e) => { data.uploadAuthorFile(a, e.target.files?.[0], "report"); e.target.value = ""; }} /></label>
            </div>
            <div className="space-y-1.5">
              {reports.map((r) => (
                <a key={r.id} href={data.getIntelFileUrl(r.filePath)} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-2 rounded-sm border border-pm-line bg-white px-3 py-2 text-sm hover:border-pm-gold">
                  <span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-pm-gold-dark" /><span className="min-w-0"><span className="block truncate">{r.fileName}</span>{r.description && <span className="block truncate text-xs text-pm-muted">{r.description}</span>}</span></span><span className="shrink-0 text-xs text-pm-muted">{formatBytes(r.fileSize)}</span>
                </a>
              ))}
              {!reports.length && <p className="text-sm text-pm-muted">Nenhum arquivo.</p>}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
