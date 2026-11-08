import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, MessageCircle, Share2 } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Textarea } from "./ui/input";
import type { AppData } from "../hooks/useAppData";
import type { Author } from "../lib/domain";
import { formatBR } from "../lib/dates";
import { whatsappUrl } from "./IntakeModals";

const PARTS = [
  ["ident", "Nome, vulgo e situação"],
  ["pessoais", "Nascimento e filiação"],
  ["docs", "Documentos (RG/CPF)"],
  ["endereco", "Endereço"],
  ["crimes", "Crimes / modus operandi"],
  ["obs", "Observações"],
  ["foto", "Foto"],
] as const;
type Part = (typeof PARTS)[number][0];

export function buildTargetText(a: Author, parts: Set<Part>, folder: string) {
  const lines = ["*🔒 RESERVADO — SI 6ª CIA*", `*${a.name}*${a.alias ? ` — vulgo "${a.alias}"` : ""}`];
  if (parts.has("ident")) lines.push(`Situação: ${a.status}${a.riskLevel ? ` · risco ${a.riskLevel.toLowerCase()}` : ""}${folder ? ` · ${folder}` : ""}`);
  if (parts.has("pessoais")) {
    if (a.birthDate) lines.push(`Nascimento: ${formatBR(a.birthDate)}`);
    if (a.motherName) lines.push(`Mãe: ${a.motherName}`);
    if (a.fatherName) lines.push(`Pai: ${a.fatherName}`);
  }
  if (parts.has("docs") && a.document) lines.push(`Documentos: ${a.document}`);
  if (parts.has("endereco") && (a.address || a.neighborhood || a.city)) lines.push(`Endereço: ${[a.address, a.neighborhood, a.city].filter(Boolean).join(" — ")}`);
  if (parts.has("crimes") && a.crimes) lines.push(`Crimes/modus: ${a.crimes}`);
  if (parts.has("obs") && a.notes) lines.push(`Obs.: ${a.notes.length > 700 ? `${a.notes.slice(0, 700)}…` : a.notes}`);
  lines.push("_Difusão restrita — não repasse._");
  return lines.join("\n");
}

/** Compartilha a ficha do alvo: com foto pelo menu de compartilhar do celular, ou só o texto no WhatsApp. */
export function ShareTargetModal({ author, data, onClose }: { author: Author | null; data: AppData; onClose: () => void }) {
  const [parts, setParts] = useState<Set<Part>>(new Set(["ident", "pessoais", "docs", "crimes", "foto"]));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const folder = author ? data.authorCategories.find((f) => f.id === author.categoryId)?.name || "" : "";
  const photo = author ? data.authorPhotos.find((p) => p.authorId === author.id) : undefined;
  const auto = useMemo(() => (author ? buildTargetText(author, parts, folder) : ""), [author, parts, folder]);

  useEffect(() => { setText(auto); setMsg(""); }, [auto]);
  useEffect(() => { if (author) setParts(new Set(["ident", "pessoais", "docs", "crimes", "foto"])); }, [author?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!author) return null;
  const canShareFiles = typeof navigator !== "undefined" && "canShare" in navigator;
  const toggle = (p: Part) => setParts((s) => { const n = new Set(s); n.has(p) ? n.delete(p) : n.add(p); return n; });
  const log = (how: string) => data.addAudit("Alvo compartilhado", `Compartilhou a ficha de ${author.name} (${how}).`);

  async function shareWithPhoto() {
    setBusy(true); setMsg("");
    try {
      let files: File[] = [];
      if (parts.has("foto") && photo) {
        const url = data.getIntelFileUrl(photo.filePath);
        const blob = await fetch(url).then((r) => r.blob());
        files = [new File([blob], `${author!.name.replace(/[^\p{L}\p{N} ]+/gu, "").replace(/\s+/g, "_")}.jpg`, { type: blob.type || "image/jpeg" })];
      }
      const payload: ShareData = files.length && navigator.canShare?.({ files }) ? { files, text } : { text };
      await navigator.share(payload);
      await log(files.length ? "foto e texto" : "texto");
      if (files.length && !payload.files) setMsg("Este aparelho não envia foto por aqui; foi só o texto.");
    } catch (error: any) {
      if (error?.name !== "AbortError") setMsg("Não foi possível abrir o compartilhamento. Use “Só texto no WhatsApp”.");
    } finally { setBusy(false); }
  }

  return (
    <Modal open={Boolean(author)} onClose={onClose} size="md" eyebrow="Compartilhar" title={<span className="inline-flex items-center gap-2"><Share2 className="h-5 w-5 text-pm-gold-light" />{author.name}</span>}>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {PARTS.filter(([p]) => p !== "foto" || photo).map(([p, label]) => (
            <label key={p} className={`flex cursor-pointer items-center gap-2 rounded-sm border px-2.5 py-1.5 text-xs font-semibold ${parts.has(p) ? "border-pm-gold bg-pm-gold/15" : "border-pm-line bg-white"}`}>
              <input type="checkbox" className="h-3.5 w-3.5 accent-[#7A6C45]" checked={parts.has(p)} onChange={() => toggle(p)} />{label}
            </label>
          ))}
        </div>
        <div className="flex gap-3">
          {parts.has("foto") && photo && <img src={data.getIntelFileUrl(photo.filePath)} alt="" className="h-32 w-24 shrink-0 rounded-sm border border-pm-line object-cover" />}
          <Textarea rows={9} className="flex-1 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <p className="text-xs text-pm-muted">Confira antes de enviar: só mande para quem precisa saber. O envio fica registrado na auditoria.</p>
        {msg && <p className="text-sm font-semibold text-[#8a6200]">{msg}</p>}
        <div className="flex flex-wrap gap-2">
          {canShareFiles && <Button variant="gold" size="lg" className="flex-1" onClick={shareWithPhoto} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Share2 />}{parts.has("foto") && photo ? "Enviar com foto" : "Compartilhar"}</Button>}
          <Button variant="primary" size="lg" className="flex-1" onClick={() => { window.open(whatsappUrl(text), "_blank", "noopener"); log("texto pelo WhatsApp"); }}><MessageCircle />Só texto no WhatsApp</Button>
          <Button size="lg" onClick={async () => { try { await navigator.clipboard.writeText(text); setMsg("Texto copiado."); } catch { setMsg("Não foi possível copiar."); } }}><Copy />Copiar</Button>
        </div>
        {!canShareFiles && parts.has("foto") && photo && <p className="text-xs text-pm-muted">Para mandar a foto junto, abra o sistema pelo celular (o computador só envia o texto pelo WhatsApp Web).</p>}
      </div>
    </Modal>
  );
}
