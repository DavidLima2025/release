import { Suspense, lazy, useState } from "react";
import { reportsAsItems } from "../lib/reportItems";

const CrimeMap = lazy(() => import("../views/CrimeMap"));
import { Binoculars, Camera, ScanText, Siren, Star, Users, Download, Map as MapIcon, Clock3, Edit3, FileText, FolderInput, FolderLock, Image as ImageIcon, Link2, Loader2, MapPin, MessageCircle, Paperclip, Share2, Trash2, Upload, UserRound } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Select } from "./ui/input";
import { Badge } from "./ui/badge";
import type { AppData } from "../hooks/useAppData";
import type { InvestigationsApi } from "../hooks/useInvestigations";
import type { Author } from "../lib/domain";
import { EXTRA_FIELDS, PHOTO_CATEGORIES, formatBytes, type AuthorFile } from "../lib/domain";
import { BoAuthorModal } from "./BoAuthorModal";
import { formatBR, formatDateTimeBR } from "../lib/dates";
import { stageOf } from "../lib/investigation";
import { RoleSelect } from "./RoleTools";
import type { ReportImage } from "../lib/report/model";
import { buildFichaInput, fichaFacts, fileSlug } from "../lib/fichaInput";

const riskTone = (risk: string) => (risk === "Alto" ? "late" : risk === "Médio" ? "risk" : "done") as any;

function ageOf(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const b = new Date(`${iso.slice(0, 10)}T12:00:00`); const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a -= 1;
  return a >= 0 && a < 120 ? `${a} anos` : "";
}

type Props = {
  author: Author | null; data: AppData; api?: InvestigationsApi;
  onClose: () => void; onEdit?: (a: Author) => void; onMove?: (a: Author) => void; onShareMessage?: (a: Author) => void;
  onOpenInvestigation?: (id: string) => void;
  onOpenAuthor?: (a: Author) => void;
};

/** Ficha detalhada do alvo, com geração do PDF e compartilhamento. */
export function TargetFichaModal({ author, data, api, onClose, onEdit, onMove, onShareMessage, onOpenInvestigation, onOpenAuthor }: Props) {
  const [busy, setBusy] = useState<"" | "share" | "download">("");
  const [histView, setHistView] = useState<"linha" | "tabela">("linha");
  const [mapOpen, setMapOpen] = useState(false);
  const [boFile, setBoFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState<AuthorFile | null>(null);
  const [reading, setReading] = useState(false);
  const [linkInv, setLinkInv] = useState({ id: "", role: "Associado" });
  if (!author) return null;
  const a = data.authors.find((x) => x.id === author.id) || author;
  const { allPhotos, photos, photosOf, extraFilled, reports, folder, canInv, linked, allItems, history, companions } = fichaFacts(a, data, api);
  const available = canInv ? api!.investigations.filter((i) => (i.status === "Em andamento" || i.status === "Suspensa") && !linked.some((x) => x.inv!.id === i.id)) : [];

  /** PDF de REDS enviado pela ficha: abre o cadastro pelo BO (dados, local, quem estava junto). Outros arquivos: só anexa. */
  async function isRedsPdf(f: File) {
    if (!/pdf/i.test(f.type || f.name)) return false;
    try {
      const [{ extractPdfItems }, lib] = await Promise.all([import("../lib/pdf"), import("../lib/boletim")]);
      return lib.isBoletim(lib.parseBoletim(await extractPdfItems(f)));
    } catch { return false; }
  }
  async function uploadReport(f: File) {
    setReading(true);
    const bo = await isRedsPdf(f);
    setReading(false);
    if (bo) { setReplacing(null); setBoFile(f); }
    else await data.uploadAuthorFile(a, f, "report");
  }
  /** BO já anexado que não foi lido: lê agora e troca o arquivo antigo pelo cadastrado com os dados. */
  async function rereadReport(r: AuthorFile) {
    setReading(true);
    try {
      const blob = await fetch(data.getIntelFileUrl(r.filePath)).then((x) => x.blob());
      const f = new File([blob], r.fileName, { type: "application/pdf" });
      if (await isRedsPdf(f)) { setReplacing(r); setBoFile(f); }
      else window.alert("Não reconheci um BO do REDS neste PDF (precisa ter texto selecionável).");
    } catch { window.alert("Não foi possível abrir o arquivo."); }
    finally { setReading(false); }
  }

  async function buildPdf() {
    const [{ renderFicha }, input] = await Promise.all([import("../lib/report/ficha"), buildFichaInput(a, data, api)]);
    const bytes = await renderFicha(input);
    return new File([bytes as BlobPart], `FICHA_${fileSlug(a.name)}.pdf`, { type: "application/pdf" });
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
    <>
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
              {onShareMessage && <Button size="sm" variant="gold" onClick={() => onShareMessage(a)}><MessageCircle />Mensagem com foto</Button>}
              <Button size="sm" onClick={downloadPdf} disabled={Boolean(busy)}>{busy === "download" ? <Loader2 className="animate-spin" /> : <Download />}Baixar PDF</Button>
              {onEdit && <Button size="sm" onClick={() => onEdit(a)}><Edit3 />Editar</Button>}
              {onMove && <Button size="sm" onClick={() => onMove(a)}><FolderInput />Mover</Button>}
              {api && <Button size="sm" onClick={() => setMapOpen(true)}><MapIcon />Ver no mapa</Button>}
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
          {extraFilled.length > 0 ? (
            <div className="rounded-sm border border-pm-line bg-white p-3">
              <p className="pm-label">Dados adicionais</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {extraFilled.map(([k, label]) => (
                  <div key={k} className={`rounded-sm bg-pm-cream/60 px-3 py-2 ${(a.extra[k] || "").length > 80 ? "sm:col-span-2" : ""}`}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-pm-muted">{label}</p><p className="whitespace-pre-wrap font-semibold">{a.extra[k]}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : onEdit ? (
            <button type="button" onClick={() => onEdit(a)} className="rounded-sm border border-dashed border-pm-line px-3 py-2 text-left text-xs text-pm-muted hover:border-pm-gold">+ Dados adicionais (características, tatuagens, telefones, veículos, facção…) — clique para preencher</button>
          ) : null}
          {a.notes && (
            <details className="group rounded-sm border border-pm-line bg-pm-cream/60 px-3 py-2">
              <summary className="cursor-pointer list-none text-[10px] font-bold uppercase tracking-wider text-pm-muted"><span className="mr-1 inline-block transition group-open:rotate-90">▸</span>Observações e vínculos <span className="font-normal normal-case">({a.notes.split("\n").filter(Boolean).length} linha(s) — clique para abrir)</span></summary>
              <p className="mt-2 whitespace-pre-wrap text-sm font-semibold">{a.notes}</p>
            </details>
          )}
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
                <RoleSelect className="h-9 w-44" value={linkInv.role} onChange={(e) => setLinkInv({ ...linkInv, role: e.target.value })} />
                <Button size="sm" variant="primary" className="!h-9" disabled={!linkInv.id} onClick={async () => { const inv = api!.investigations.find((i) => i.id === linkInv.id); if (inv && await api!.addTarget(inv, a.id, linkInv.role)) { data.reload(); setLinkInv({ id: "", role: linkInv.role }); } }}><Link2 />Vincular</Button>
              </div>
            )}
          </div>
        )}

        {companions.length > 0 && (
          <div className="rounded-sm border border-pm-line bg-white p-3">
            <p className="pm-label flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-pm-gold-dark" />Envolvidos juntos ({companions.length})</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {companions.map((c) => {
                const ph = data.authorPhotos.find((p) => p.authorId === c.author.id);
                return (
                  <button key={c.author.id} type="button" onClick={() => onOpenAuthor?.(c.author)} className="flex gap-2.5 rounded-sm border border-pm-line p-2 text-left hover:border-pm-gold">
                    <div className="grid h-16 w-12 shrink-0 place-items-center overflow-hidden rounded-sm bg-pm-sand">
                      {ph ? <img src={data.getIntelFileUrl(ph.filePath)} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6 text-pm-muted" />}
                    </div>
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="truncate text-sm font-black uppercase">{c.author.name}</p>
                      {c.author.alias && <p className="truncate text-pm-muted">Vulgo: {c.author.alias}</p>}
                      <div className="mt-1 flex flex-wrap gap-1">
                        <Badge tone={c.arrestedTogether ? "late" : "default"}>{c.arrestedTogether ? "Preso/conduzido junto" : "Mesmo BO"}</Badge>
                        <Badge tone="gold">{c.occurrences.length}× juntos</Badge>
                      </div>
                      <p className="mt-1 truncate text-pm-muted">{c.occurrences.map((o) => `REDS ${o.reds}${o.date ? ` (${formatBR(o.date)})` : ""}`).join(" · ")}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="overflow-x-auto rounded-sm border border-pm-line bg-white p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="pm-label !mb-0 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-pm-gold-dark" />Histórico de BOs ({history.length}){history.length >= 3 && <Badge tone="late" className="ml-1">Reincidente</Badge>}</p>
              <div className="ml-auto flex rounded-sm border border-pm-line text-[11px] font-bold uppercase">
                {(["linha", "tabela"] as const).map((v) => <button key={v} type="button" onClick={() => setHistView(v)} className={`px-2.5 py-1 ${histView === v ? "bg-pm-black text-white" : "hover:bg-pm-cream"}`}>{v === "linha" ? "Linha do tempo" : "Tabela"}</button>)}
              </div>
            </div>
            {histView === "linha" ? <Timeline history={history} companions={companions} createdAt={a.createdAt} photos={photos.map((p) => p.createdAt)} /> : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-pm-muted"><th className="py-1 pr-3">Data</th><th className="py-1 pr-3">Natureza</th><th className="py-1 pr-3">Papel</th><th className="py-1 pr-3">REDS</th><th className="py-1">Local</th></tr></thead>
                <tbody>{history.map((o) => (
                  <tr key={o.reds} className="border-t border-pm-line align-top">
                    <td className="whitespace-nowrap py-1.5 pr-3">{o.date ? formatBR(o.date) : "—"}{o.time ? ` ${o.time}` : ""}</td>
                    <td className="py-1.5 pr-3 font-semibold">{o.crime || "—"}</td>
                    <td className="py-1.5 pr-3">{o.role || "—"}</td>
                    <td className="whitespace-nowrap py-1.5 pr-3">{o.reds}</td>
                    <td className="py-1.5">{o.place || "—"}{o.inv ? <span className="block text-xs text-pm-muted">{o.inv}</span> : null}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-center justify-between"><p className="pm-heading flex items-center gap-2"><ImageIcon className="h-4 w-4 text-pm-gold-dark" />Fotos do alvo ({photos.length})</p>
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm bg-pm-black px-3 text-xs font-bold uppercase text-white hover:bg-pm-ink"><Camera className="h-3.5 w-3.5" />Subir foto<input type="file" accept="image/*" className="hidden" onChange={(e) => { data.uploadAuthorFile(a, e.target.files?.[0], "photo"); e.target.value = ""; }} /></label>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((p, i) => (
                <div key={p.id} className={`group relative aspect-[3/4] overflow-hidden rounded-sm bg-pm-sand ${i === 0 ? "ring-2 ring-pm-gold" : ""}`}>
                  <a href={data.getIntelFileUrl(p.filePath)} target="_blank" rel="noreferrer" title="Abrir a foto"><img src={data.getIntelFileUrl(p.filePath)} alt={p.fileName} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" /></a>
                  {i === 0 && photos.length > 1 && <span className="absolute left-1 top-1 rounded-sm bg-pm-gold px-1.5 py-0.5 text-[10px] font-black uppercase text-pm-black">Capa</span>}
                  <div className="absolute inset-x-0 bottom-0 flex gap-1 bg-pm-black/75 p-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
                    {i !== 0 && <button type="button" onClick={() => data.setCoverPhoto(p)} className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-sm bg-pm-gold px-1 py-1 text-[9px] font-black uppercase text-pm-black hover:bg-pm-gold-light" title="Usar esta foto como capa do alvo"><Star className="h-3 w-3" />Tornar capa</button>}
                    <button type="button" onClick={() => { if (window.confirm("Excluir esta foto do card?")) data.deleteAuthorPhoto(p); }} className={`grid place-items-center rounded-sm px-1.5 py-1 text-white hover:bg-status-late ${i === 0 ? "ml-auto" : ""}`} aria-label="Excluir foto" title="Excluir foto"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
              {!photos.length && <p className="col-span-full text-sm text-pm-muted">Nenhuma foto.</p>}
            </div>
          </div>
          <div>
            <div className="mb-3 flex items-center justify-between"><p className="pm-heading flex items-center gap-2"><Paperclip className="h-4 w-4 text-pm-gold-dark" />Relatórios e BOs ({reports.length})</p>
              <label className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-pm-line bg-white px-3 text-xs font-bold uppercase hover:border-pm-gold ${reading ? "pointer-events-none opacity-60" : ""}`} title="PDF do REDS é lido: os dados do alvo, o local e quem estava junto são cadastrados">
                {reading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}{reading ? "Lendo…" : "Subir"}
                <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadReport(f); }} />
              </label>
            </div>
            <div className="space-y-1.5">
              {reports.map((r) => {
                const pdf = /pdf/i.test(r.mimeType || r.fileName);
                const read = Boolean(r.reds || /REDS/i.test(r.description));
                return (
                  <div key={r.id} className="flex items-center gap-1 rounded-sm border border-pm-line bg-white pr-1 text-sm hover:border-pm-gold">
                    <a href={data.getIntelFileUrl(r.filePath)} target="_blank" rel="noreferrer" className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
                      <FileText className="h-4 w-4 shrink-0 text-pm-gold-dark" />
                      <span className="min-w-0"><span className="block truncate">{r.fileName}</span>{r.description ? <span className="block truncate text-xs text-pm-muted">{r.description}</span> : pdf ? <span className="block text-xs text-[#8a6200]">BO ainda não lido</span> : null}</span>
                      <span className="ml-auto shrink-0 text-xs text-pm-muted">{formatBytes(r.fileSize)}</span>
                    </a>
                    {pdf && !read && <Button size="sm" variant="gold" disabled={reading} onClick={() => rereadReport(r)} title="Ler o REDS e cadastrar os dados"><ScanText />Ler BO</Button>}
                    <button type="button" onClick={() => { if (window.confirm(`Excluir ${r.fileName} do card?`)) data.deleteAuthorReport(r); }} className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-pm-muted hover:bg-red-50 hover:text-status-late" aria-label="Excluir arquivo" title="Excluir"><Trash2 className="h-4 w-4" /></button>
                  </div>
                );
              })}
              {!reports.length && <p className="text-sm text-pm-muted">Nenhum arquivo.</p>}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {PHOTO_CATEGORIES.filter(([c]) => c !== "perfil").map(([cat, label]) => {
            const list = photosOf(cat);
            return (
              <div key={cat}>
                <div className="mb-3 flex items-center justify-between gap-2"><p className="pm-heading flex items-center gap-2">{cat === "ocorrencia" ? <Siren className="h-4 w-4 text-pm-gold-dark" /> : <Binoculars className="h-4 w-4 text-pm-gold-dark" />}{label} ({list.length})</p>
                  <label className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-pm-line bg-white px-3 text-xs font-bold uppercase hover:border-pm-gold"><Camera className="h-3.5 w-3.5" />Subir
                    <input type="file" accept="image/*" multiple className="hidden" onChange={async (e) => {
                      const files = Array.from(e.target.files || []); e.target.value = "";
                      if (!files.length) return;
                      const caption = window.prompt(cat === "ocorrencia" ? "Legenda (opcional): ex. REDS nº, data, material apreendido" : "Legenda (opcional): ex. data, local, o que foi observado") || "";
                      for (const f of files) await data.uploadAuthorFile(a, f, "photo", { category: cat, description: caption.trim() || undefined, silent: files.length > 1 });
                    }} />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {list.map((p) => (
                    <figure key={p.id} className="group relative">
                      <a href={data.getIntelFileUrl(p.filePath)} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-sm bg-pm-sand"><img src={data.getIntelFileUrl(p.filePath)} alt={p.description || p.fileName} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" /></a>
                      <button type="button" onClick={() => { if (window.confirm("Excluir esta foto?")) data.deleteAuthorPhoto(p); }} className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-sm bg-pm-black/70 text-white opacity-100 hover:bg-status-late sm:opacity-0 sm:group-hover:opacity-100" aria-label="Excluir foto"><Trash2 className="h-3 w-3" /></button>
                      <figcaption className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-pm-muted">{p.description || formatDateTimeBR(p.createdAt)}</figcaption>
                    </figure>
                  ))}
                  {!list.length && <p className="col-span-full text-sm text-pm-muted">Nenhuma foto.</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {mapOpen && (
        <Modal open={mapOpen} onClose={() => setMapOpen(false)} size="xl" eyebrow={`Mapa · ${a.name}`} title="Fatos do alvo no mapa">
          <Suspense fallback={<div className="flex items-center gap-2 py-16 text-pm-muted"><Loader2 className="h-5 w-5 animate-spin" />Carregando o mapa…</div>}>
            <CrimeMap data={data} api={api!} height="60vh"
              items={[...allItems.filter((i) => i.authorIds.includes(a.id)), ...reportsAsItems(data.authorReports.filter((r) => r.authorId === a.id || (r.reds && history.some((h) => h.reds === r.reds))))]} />
          </Suspense>
          <p className="mt-2 text-xs text-pm-muted">Inclui os BOs anexados ao card e os das investigações. Fatos sem local: aba <b>Localizar</b> (lê a coordenada do PDF do REDS ou marque no mapa). Marque a residência para ver a distância casa → fato.</p>
        </Modal>
      )}
    </Modal>
    <BoAuthorModal open={Boolean(boFile)} initialFile={boFile} data={data} api={api} onClose={() => { setBoFile(null); setReplacing(null); }}
      onDone={async (ids) => { if (replacing && ids.includes(a.id)) await data.deleteAuthorReport(replacing, { silent: true }); setReplacing(null); }} />
    </>
  );
}

type HistoryRow = { reds: string; date: string; time: string; role: string; crime: string; place: string; inv: string };

const days = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86400000);
const span = (d: number) => (d >= 365 ? `${(d / 365).toFixed(1).replace(".", ",")} ano(s)` : d >= 60 ? `${Math.round(d / 30)} meses` : `${d} dia(s)`);

/** Linha do tempo do alvo: BOs em ordem, intervalo entre eles e quem estava junto. */
function Timeline({ history, companions, createdAt, photos }: { history: HistoryRow[]; companions: ReturnType<typeof companionsOf>; createdAt: string; photos: string[] }) {
  const dated = history.filter((h) => h.date).sort((x, y) => `${x.date} ${x.time}`.localeCompare(`${y.date} ${y.time}`));
  const undated = history.filter((h) => !h.date);
  const gaps = dated.slice(1).map((h, i) => days(dated[i].date, h.date));
  const avg = gaps.length ? Math.round(gaps.reduce((s, g) => s + g, 0) / gaps.length) : 0;
  const today = new Date().toISOString().slice(0, 10);
  const sinceLast = dated.length ? days(dated[dated.length - 1].date, today) : 0;
  const withWhom = (reds: string) => companions.filter((c) => c.occurrences.some((o) => o.reds === reds)).map((c) => c.author.name);
  const arrested = (role: string) => /PRES|CONDUZ|AUTUAD|FLAGRANTE/i.test(role);
  return (
    <div>
      {dated.length > 0 && (
        <div className="mb-3 grid gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-sm bg-pm-cream px-2 py-1.5"><b className="block text-base">{dated.length}</b>BOs com data</div>
          <div className="rounded-sm bg-pm-cream px-2 py-1.5"><b className="block text-base">{formatBR(dated[0].date)}</b>primeiro registro</div>
          <div className="rounded-sm bg-pm-cream px-2 py-1.5"><b className="block text-base">{avg ? span(avg) : "—"}</b>intervalo médio entre BOs</div>
          <div className={`rounded-sm px-2 py-1.5 ${sinceLast <= 30 ? "bg-red-50 text-status-late" : "bg-pm-cream"}`}><b className="block text-base">{span(Math.max(0, sinceLast))}</b>desde o último BO</div>
        </div>
      )}
      <ol className="relative ml-2 border-l-2 border-pm-gold/50">
        {dated.map((h, i) => {
          const gap = i > 0 ? days(dated[i - 1].date, h.date) : null;
          const people = withWhom(h.reds);
          return (
            <li key={h.reds} className="relative mb-3 pl-5">
              {gap !== null && <span className="mb-1 block text-[11px] font-bold uppercase text-pm-muted">+ {span(gap)} depois</span>}
              <span className={`absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-white ${arrested(h.role) ? "bg-status-late" : "bg-pm-gold"}`} style={gap !== null ? { top: "1.6rem" } : undefined} />
              <p className="text-sm"><b>{formatBR(h.date)}{h.time ? ` ${h.time}` : ""}</b> — <b className="uppercase">{h.crime || "BO"}</b>{h.role ? <span className="text-pm-muted"> · {h.role}</span> : null}{arrested(h.role) && <Badge tone="late" className="ml-1">preso/conduzido</Badge>}</p>
              <p className="text-xs text-pm-muted">REDS {h.reds}{h.place ? ` · ${h.place}` : ""}{h.inv ? ` · ${h.inv}` : ""}</p>
              {people.length > 0 && <p className="text-xs"><Users className="mr-1 inline h-3 w-3 text-pm-gold-dark" />Junto com: {people.join(", ")}</p>}
            </li>
          );
        })}
        {undated.length > 0 && (
          <li className="relative mb-2 pl-5">
            <span className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-white bg-pm-line" />
            <p className="text-sm font-bold">Sem data ({undated.length})</p>
            <p className="text-xs text-pm-muted">{undated.map((h) => `REDS ${h.reds}`).join(" · ")}</p>
          </li>
        )}
        <li className="relative pl-5">
          <span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full bg-pm-black" />
          <p className="text-xs text-pm-muted"><Clock3 className="mr-1 inline h-3 w-3" />Card criado em {formatDateTimeBR(createdAt)}{photos.length ? ` · ${photos.length} foto(s)` : ""}.</p>
        </li>
      </ol>
    </div>
  );
}
