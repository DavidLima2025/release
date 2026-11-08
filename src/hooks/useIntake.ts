import { useCallback, useEffect, useState } from "react";
import { INTEL_BUCKET, supabase } from "../supabase";
import type { AppData } from "./useAppData";
import type { Author } from "../lib/domain";

/** Cadastro externo: links que outro policial usa para enviar alvos, e a caixa de recebidos. */

export type IntakeLink = {
  id: string; token: string; label: string; folderId: string; expiresAt: string; active: boolean;
  uses: number; maxUses: number; createdAt: string;
};
export type IntakeFile = { path: string; name: string; size: number; type: string; kind: "photo" | "doc" };
export type IntakePayload = {
  name: string; alias?: string; birthDate?: string; motherName?: string; fatherName?: string; document?: string;
  address?: string; neighborhood?: string; city?: string; crimes?: string; reds?: string; notes?: string;
};
export type IntakeSubmitter = { name: string; register?: string; unit?: string; phone?: string };
export type IntakeSubmission = {
  id: string; linkId: string; linkLabel: string; submitter: IntakeSubmitter; payload: IntakePayload; files: IntakeFile[];
  status: "Pendente" | "Aprovado" | "Recusado"; authorId: string; reviewNote: string; createdAt: string; reviewedAt: string;
};

export const intakeUrl = (token: string) => `${window.location.origin}/cadastro/${token}`;

const toLink = (r: any): IntakeLink => ({
  id: r.id, token: r.token, label: r.label, folderId: r.folder_id || "", expiresAt: r.expires_at || "", active: r.active,
  uses: r.uses || 0, maxUses: r.max_uses || 0, createdAt: r.created_at,
});
const toSubmission = (r: any): IntakeSubmission => ({
  id: r.id, linkId: r.link_id || "", linkLabel: r.link_label || "", submitter: r.submitter || {}, payload: r.payload || {},
  files: Array.isArray(r.files) ? r.files : [], status: r.status, authorId: r.author_id || "", reviewNote: r.review_note || "",
  createdAt: r.created_at, reviewedAt: r.reviewed_at || "",
});

type Notify = (message: string, tone?: any) => void;

export function useIntake(data: AppData, notify: Notify, enabled = true) {
  const [links, setLinks] = useState<IntakeLink[]>([]);
  const [submissions, setSubmissions] = useState<IntakeSubmission[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  /** true quando o script 04 ainda não foi rodado no Supabase. */
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!enabled || !data.currentUser) return;
    const [l, s] = await Promise.all([
      supabase.from("intake_links").select("*").order("created_at", { ascending: false }),
      supabase.from("intake_submissions").select("*").order("created_at", { ascending: false }).limit(300),
    ]);
    if (l.error || s.error) {
      const msg = `${l.error?.message || ""} ${s.error?.message || ""}`;
      setMissing(/does not exist|schema cache|relation|404/i.test(msg) || Boolean(l.error));
      return;
    }
    setMissing(false);
    setLinks((l.data || []).map(toLink));
    const subs = (s.data || []).map(toSubmission);
    setSubmissions(subs);
    const paths = subs.filter((x) => x.status === "Pendente").flatMap((x) => x.files.map((f) => f.path));
    if (paths.length) {
      const { data: signed } = await supabase.storage.from(INTEL_BUCKET).createSignedUrls(paths, 3600);
      const map: Record<string, string> = {};
      (signed || []).forEach((x: any) => { if (x.signedUrl && x.path) map[x.path] = x.signedUrl; });
      setUrls(map);
    }
  }, [enabled, data.currentUser]);

  useEffect(() => {
    load();
    if (!enabled) return undefined;
    const timer = window.setInterval(load, 60000);
    return () => window.clearInterval(timer);
  }, [load, enabled]);

  async function createLink(label: string, days: number, folderId: string) {
    if (!label.trim()) { notify("Dê um nome ao link (ex.: equipe ou policial).", "error"); return null; }
    const expires_at = days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null;
    const { data: row, error } = await supabase.from("intake_links")
      .insert({ label: label.trim(), active: true, folder_id: folderId || null, expires_at, created_by: data.currentUser?.id || null }).select("*").single();
    if (error) { notify(missing ? "Rode o script 04 no Supabase para ativar os links." : "Erro ao criar o link.", "error"); return null; }
    await data.addAudit("Link externo criado", `Criou o link de cadastro "${label.trim()}"${days ? ` válido por ${days} dias` : ""}.`);
    await load();
    return toLink(row);
  }

  async function setLinkActive(link: IntakeLink, active: boolean) {
    const { error } = await supabase.from("intake_links").update({ active }).eq("id", link.id);
    if (error) return notify("Erro ao atualizar o link.", "error");
    await data.addAudit(active ? "Link externo reativado" : "Link externo desativado", `Link "${link.label}".`);
    load();
  }

  async function deleteLink(link: IntakeLink) {
    if (!window.confirm(`Excluir o link "${link.label}"? Quem tiver o link não conseguirá mais enviar. Os envios já recebidos continuam.`)) return;
    const { error } = await supabase.from("intake_links").delete().eq("id", link.id);
    if (error) return notify("Erro ao excluir o link.", "error");
    await data.addAudit("Link externo excluído", `Link "${link.label}".`);
    load();
  }

  /** Aprova: cria card novo ou junta ao alvo existente, e leva fotos/arquivos para o card. */
  async function approve(sub: IntakeSubmission, target: { mode: "new" | "merge"; authorId?: string; form: any }) {
    let author: { id: string; name: string } | null = null;
    const origin = `Cadastro externo de ${sub.submitter.name}${sub.submitter.unit ? ` (${sub.submitter.unit})` : ""} em ${new Date(sub.createdAt).toLocaleDateString("pt-BR")}`;
    if (target.mode === "merge" && target.authorId) {
      const existing = data.authors.find((a) => a.id === target.authorId);
      if (!existing) { notify("Alvo não encontrado.", "error"); return false; }
      const merged: any = { ...existing };
      (Object.keys(target.form) as (keyof Author)[]).forEach((k) => { if (!merged[k] && target.form[k]) merged[k] = target.form[k]; });
      const extra = (["birthDate", "motherName", "fatherName", "document", "address"] as const)
        .filter((k) => existing[k] && target.form[k] && String(existing[k]).trim().toUpperCase() !== String(target.form[k]).trim().toUpperCase())
        .map((k) => `${({ birthDate: "Nascimento", motherName: "Mãe", fatherName: "Pai", document: "Documento", address: "Endereço" } as any)[k]} informado(a): ${target.form[k]}`);
      merged.notes = [existing.notes, `${origin}.`, ...extra, target.form.notes].filter(Boolean).join("\n");
      if (await data.updateAuthor(existing.id, merged, { silent: true })) author = { id: existing.id, name: existing.name };
    } else {
      author = await data.addAuthor({ ...target.form, notes: [target.form.notes, `${origin}.`].filter(Boolean).join("\n") }, { silent: true });
    }
    if (!author) return false;
    for (const f of sub.files) {
      const table = f.kind === "photo" ? "author_photos" : "author_reports";
      await supabase.from(table).insert({
        author_id: author.id, file_name: f.name, file_path: f.path, file_size: f.size || 0, mime_type: f.type || null,
        uploaded_by: data.currentUser?.id || null, description: `Enviado por ${sub.submitter.name}`,
      });
    }
    const { error } = await supabase.from("intake_submissions").update({
      status: "Aprovado", author_id: author.id, reviewed_by: data.currentUser?.id || null, reviewed_at: new Date().toISOString(),
    }).eq("id", sub.id);
    if (error) notify("O alvo foi salvo, mas houve erro ao marcar o envio como aprovado.", "error");
    await data.addAudit("Cadastro externo aprovado", `${target.mode === "merge" ? "Juntou ao card" : "Criou o card"} de ${author.name} — enviado por ${sub.submitter.name}.`);
    notify(target.mode === "merge" ? `Dados juntados ao card de ${author.name}.` : `Alvo ${author.name} cadastrado.`);
    data.reload();
    load();
    return author.id;
  }

  async function reject(sub: IntakeSubmission, note: string) {
    const { error } = await supabase.from("intake_submissions").update({
      status: "Recusado", review_note: note || null, reviewed_by: data.currentUser?.id || null, reviewed_at: new Date().toISOString(),
    }).eq("id", sub.id);
    if (error) { notify("Erro ao recusar.", "error"); return false; }
    if (sub.files.length) await supabase.storage.from(INTEL_BUCKET).remove(sub.files.map((f) => f.path));
    await data.addAudit("Cadastro externo recusado", `Recusou o alvo ${sub.payload.name} enviado por ${sub.submitter.name}${note ? ` (${note})` : ""}.`);
    notify("Envio recusado (fotos apagadas).");
    load();
    return true;
  }

  const pending = submissions.filter((s) => s.status === "Pendente");
  return { links, submissions, pending, urls, missing, load, createLink, setLinkActive, deleteLink, approve, reject };
}

export type IntakeApi = ReturnType<typeof useIntake>;
