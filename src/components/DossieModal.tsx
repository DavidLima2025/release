import { useEffect, useState } from "react";
import { Download, FileText, Loader2, Share2 } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import type { AppData } from "../hooks/useAppData";
import type { InvestigationsApi } from "../hooks/useInvestigations";
import type { Investigation, InvestigationLink, InvestigationTarget } from "../lib/investigation";
import type { ReportImage } from "../lib/report/model";
import { buildFichaInput, cropPortrait, fileSlug } from "../lib/fichaInput";
import { redsCount } from "../lib/companions";
import { groupKeyOf } from "../lib/orgBoard";
import { formatBR } from "../lib/dates";

type Props = { open: boolean; onClose: () => void; data: AppData; api: InvestigationsApi; inv: Investigation; targets: InvestigationTarget[]; links: InvestigationLink[] };

/** PDF da investigação: organograma + relação de alvos e vínculos + qualificação (ficha) de cada alvo. */
export function DossieModal({ open, onClose, data, api, inv, targets, links }: Props) {
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [gallery, setGallery] = useState(false);
  const [progress, setProgress] = useState("");
  useEffect(() => { if (open) setChosen(new Set(targets.map((t) => t.id))); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const authorOf = (t: InvestigationTarget) => data.authors.find((a) => a.id === t.authorId);
  const ordered = [...targets].sort((a, b) => a.position - b.position);
  const userName = (id: string) => { const u = data.users.find((x) => x.id === id); return u ? u.warName || u.name : ""; };

  async function build() {
    const { loadImage } = await import("../hooks/useInvestigations");
    const [{ renderDossie }, { renderFicha }] = await Promise.all([import("../lib/report/dossie"), import("../lib/report/ficha")]);
    setProgress("Montando o organograma…");
    const people = new Map<string, any>();
    const boardPeople = new Map<string, any>();
    for (const t of ordered) {
      const a = authorOf(t); if (!a) continue;
      const ph = data.authorPhotos.find((p) => p.authorId === a.id && (p.category || "perfil") === "perfil");
      const img = ph ? await cropPortrait((await loadImage(data.getIntelFileUrl(ph.filePath))) as ReportImage | undefined) : undefined;
      const parent = targets.find((x) => x.id === t.parentId);
      const bos = redsCount(a.id, data.authors, data.authorReports, api.items).length;
      people.set(t.id, {
        name: a.name, alias: a.alias, role: t.role, status: a.status, document: a.document, photo: img,
        parent: parent ? authorOf(parent)?.name || "" : "", bos,
        group: groupKeyOf(t, inv.orgGroups).slice(2), area: t.area,
        evidence: t.evidence.map((e) => ({ source: e.source, note: e.note, date: e.date ? formatBR(e.date) : "" })),
      });
      boardPeople.set(t.id, { name: a.name, alias: a.alias, photo: img?.dataUrl, role: t.role, area: t.area, evidence: t.evidence.length, bos });
    }
    const { renderBoardImage } = await import("../lib/boardImage");
    const orgImage = await renderBoardImage(targets, links, inv.orgGroups, boardPeople).catch((e) => { console.error(e); return undefined; });
    const fichas: Uint8Array[] = [];
    const list = ordered.filter((t) => chosen.has(t.id));
    for (const [i, t] of list.entries()) {
      const a = authorOf(t); if (!a) continue;
      setProgress(`Qualificação ${i + 1} de ${list.length}: ${a.name}`);
      fichas.push(await renderFicha(await buildFichaInput(a, data, api, { gallery, extraPhotos: gallery })));
    }
    setProgress("Juntando o PDF…");
    const bytes = await renderDossie({
      code: inv.code, title: inv.title, status: inv.status, responsible: userName(inv.responsibleId), objective: inv.objective,
      targets, links, people, fichas, orgImage,
      logo: (await loadImage("/pmmg-logo.png", true)) as ReportImage | undefined,
      generatedBy: data.currentUser?.warName || data.currentUser?.name || "",
      generatedAt: new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
    });
    return new File([bytes as BlobPart], `DOSSIE_${inv.code || "INV"}_${fileSlug(inv.title)}.pdf`, { type: "application/pdf" });
  }

  const download = (file: File) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a"); link.href = url; link.download = file.name; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  async function run(mode: "download" | "share") {
    setProgress("Preparando…");
    try {
      const file = await build();
      if (mode === "share" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Dossiê ${inv.code}`, text: `*RESERVADO* — Dossiê ${inv.code} — ${inv.title}. Difusão restrita.` });
      } else {
        download(file);
        if (mode === "share") window.alert("Este aparelho não envia arquivo direto para o WhatsApp. O PDF foi baixado: no WhatsApp, use o clipe 📎 para anexar.");
      }
      await data.addAudit("Dossiê gerado", `Gerou o PDF do organograma e qualificações da investigação ${inv.code} (${list().length} fichas).`);
      onClose();
    } catch (error: any) {
      if (error?.name !== "AbortError") { console.error(error); window.alert("Não foi possível gerar o PDF."); }
    } finally { setProgress(""); }
  }
  const list = () => ordered.filter((t) => chosen.has(t.id));
  const toggle = (id: string) => setChosen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <Modal open={open} onClose={() => !progress && onClose()} size="md" eyebrow="Organograma e qualificações" title={<span className="inline-flex items-center gap-2"><FileText className="h-5 w-5 text-pm-gold-light" />Dossiê em PDF</span>}>
      <div className="space-y-4 text-sm">
        <p className="text-pm-muted">O PDF traz: <b>1)</b> o organograma por núcleos, com fotos e setas de comando; <b>2)</b> a relação de alvos (função, núcleo, área de atuação), dos vínculos e dos indícios; <b>3)</b> no final, a ficha de qualificação de cada alvo marcado abaixo.</p>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <p className="pm-label">Qualificações ({chosen.size} de {targets.length})</p>
            <button type="button" className="text-xs font-bold text-pm-gold-dark underline" onClick={() => setChosen(chosen.size === targets.length ? new Set() : new Set(targets.map((t) => t.id)))}>{chosen.size === targets.length ? "Desmarcar todos" : "Marcar todos"}</button>
          </div>
          <div className="max-h-64 space-y-1 overflow-auto rounded-sm border border-pm-line p-1">
            {ordered.map((t) => (
              <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-pm-sand/50">
                <input type="checkbox" className="h-4 w-4 accent-[#7A6C45]" checked={chosen.has(t.id)} onChange={() => toggle(t.id)} />
                <span className="min-w-0 flex-1 truncate font-semibold uppercase">{authorOf(t)?.name || "?"}</span>
                <span className="text-xs text-pm-muted">{t.role}</span>
              </label>
            ))}
          </div>
        </div>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#7A6C45]" checked={gallery} onChange={(e) => setGallery(e.target.checked)} />
          <span>Incluir fotos extras, de ocorrências e de levantamentos nas fichas <span className="block text-xs text-pm-muted">Deixa o PDF bem maior; desmarcado vai só a foto principal.</span></span></label>
        {progress && <p className="flex items-center gap-2 rounded-sm bg-pm-sand/60 px-3 py-2 font-semibold"><Loader2 className="h-4 w-4 animate-spin" />{progress}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" className="flex-1" disabled={Boolean(progress) || !targets.length} onClick={() => run("download")}><Download />Baixar PDF</Button>
          <Button variant="gold" className="flex-1" disabled={Boolean(progress) || !targets.length} onClick={() => run("share")}><Share2 />Enviar (WhatsApp)</Button>
        </div>
      </div>
    </Modal>
  );
}
