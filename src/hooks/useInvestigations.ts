import { useCallback, useEffect, useRef, useState } from "react";
import { INVESTIGATION_BUCKET, supabase } from "../supabase";
import { safeFileName, Author } from "../lib/domain";
import {
  Investigation, InvestigationItem, InvestigationLink, InvestigationTarget, StageKey, STAGES,
  normalizeInvestigation, normalizeItem, normalizeLink, normalizeTarget, slug, stageIndex,
} from "../lib/investigation";
import type { AppData, Notify } from "./useAppData";
import type { ReportImage, ReportPerson } from "../lib/report/model";

const INV_FIELDS: Record<string, string> = {
  title: "title", objective: "objective", origin: "origin", destination: "destination", summary: "summary", analysis: "analysis",
  conclusion: "conclusion", recommendations: "recommendations", methodology: "methodology", classification: "classification",
  status: "status", stage: "stage", stages: "stages", priority: "priority", nature: "nature", area: "area", responsibleId: "responsible_id",
  team: "team", openedAt: "opened_at", dueDate: "due_date", closedAt: "closed_at",
};
const ITEM_FIELDS: Record<string, string> = {
  kind: "kind", title: "title", itemDate: "item_date", source: "source", reference: "reference", url: "url", sourceRating: "source_rating",
  infoRating: "info_rating", summary: "summary", authorIds: "author_ids", includeInReport: "include_in_report",
};

function toRow(values: Record<string, any>, map: Record<string, string>) {
  const row: Record<string, any> = {};
  Object.entries(values).forEach(([key, value]) => {
    if (!(key in map)) return;
    row[map[key]] = value === "" && /(_at|_date|_id)$/.test(map[key]) ? null : value;
  });
  return row;
}

/** Converte qualquer imagem (inclusive webp) em JPEG/PNG para embutir no PDF/PPTX. */
async function loadImage(url: string, keepPng = false): Promise<ReportImage | undefined> {
  if (!url) return undefined;
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) return undefined;
    const blob = await response.blob();
    const bitmapUrl = URL.createObjectURL(blob);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = bitmapUrl;
    });
    const max = 900;
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d")!;
    if (!keepPng) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(bitmapUrl);
    const type = keepPng ? "png" : "jpg";
    const dataUrl = canvas.toDataURL(keepPng ? "image/png" : "image/jpeg", 0.86);
    const bytes = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
    return { bytes, type, dataUrl, width: canvas.width, height: canvas.height };
  } catch {
    return undefined;
  }
}

function download(bytes: Uint8Array, fileName: string, mime: string) {
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function useInvestigations(data: AppData, notify: Notify) {
  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [items, setItems] = useState<InvestigationItem[]>([]);
  const [targets, setTargets] = useState<InvestigationTarget[]>([]);
  const [links, setLinks] = useState<InvestigationLink[]>([]);
  const [loaded, setLoaded] = useState(false);
  const enabled = data.permissions.investigations;
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (!enabled || busy.current) return;
    busy.current = true;
    try {
      const [inv, it, tg, lk] = await Promise.all([
        supabase.from("investigations").select("*").order("opened_at", { ascending: false }),
        supabase.from("investigation_items").select("*").order("item_date", { ascending: true, nullsFirst: false }),
        supabase.from("investigation_targets").select("*").order("position", { ascending: true }),
        supabase.from("investigation_links").select("*").order("created_at", { ascending: true }),
      ]);
      if (inv.error) {
        if (/relation .* does not exist|Could not find the table/i.test(inv.error.message)) notify("Rode o script supabase/02_investigacoes.sql para ativar as investigações.", "error");
      } else setInvestigations((inv.data || []).map(normalizeInvestigation));
      if (it.data) setItems(it.data.map(normalizeItem));
      if (tg.data) setTargets(tg.data.map(normalizeTarget));
      if (lk.data) setLinks(lk.data.map(normalizeLink));
    } finally {
      busy.current = false;
      setLoaded(true);
    }
  }, [enabled, notify]);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, [enabled, load, data.currentUser?.id]);

  const audit = (action: string, details: string) => {
    const u = data.currentUser;
    if (!u) return;
    supabase.from("audit_logs").insert({ user_id: u.id, user_name: u.warName || u.name, user_role: u.role, action, details, user_agent: navigator.userAgent }).then(() => undefined);
  };

  const fail = (error: any, message: string) => { console.error(error); notify(message, "error"); return null; };

  // ---------- Investigação ----------
  async function createInvestigation(values: Partial<Investigation>) {
    if (!values.title?.trim()) { notify("Informe o título da investigação.", "error"); return null; }
    const row = { ...toRow(values, INV_FIELDS), created_by: data.currentUser?.id, responsible_id: values.responsibleId || data.currentUser?.id, stage: "abertura" };
    const { data: created, error } = await supabase.from("investigations").insert(row).select("*").single();
    if (error) return fail(error, "Erro ao criar a investigação.");
    const inv = normalizeInvestigation(created);
    setInvestigations((list) => [inv, ...list]);
    audit("Investigação aberta", `Abriu ${inv.code} — ${inv.title}.`);
    notify(`Investigação ${inv.code} aberta.`);
    return inv;
  }

  async function updateInvestigation(inv: Investigation, values: Partial<Investigation>, message = "Dossiê salvo.") {
    const row = toRow(values, INV_FIELDS);
    setInvestigations((list) => list.map((i) => (i.id === inv.id ? { ...i, ...values } : i)));
    const { error } = await supabase.from("investigations").update(row).eq("id", inv.id);
    if (error) { load(); return fail(error, "Erro ao salvar o dossiê."); }
    if (message) notify(message);
    return true;
  }

  async function toggleStageItem(inv: Investigation, key: StageKey, index: number) {
    const stage = STAGES.find((s) => s.key === key)!;
    const current = inv.stages[key]?.done || [];
    const done = stage.checklist.map((_, i) => (i === index ? !current[i] : Boolean(current[i])));
    const stages = { ...inv.stages, [key]: { ...inv.stages[key], done, completedAt: done.every(Boolean) ? new Date().toISOString() : undefined } };
    await updateInvestigation(inv, { stages }, "");
  }

  async function setStage(inv: Investigation, key: StageKey) {
    const from = stageIndex(inv.stage);
    const to = stageIndex(key);
    const stages = { ...inv.stages };
    if (to > from) {
      // Etapas deixadas para trás ficam registradas com a data de conclusão.
      STAGES.slice(from, to).forEach((s) => { stages[s.key] = { ...stages[s.key], completedAt: stages[s.key]?.completedAt || new Date().toISOString() }; });
    }
    const values: Partial<Investigation> = { stage: key, stages };
    if (key === "encerramento" && inv.status === "Em andamento") values.status = "Concluída";
    if (key === "encerramento" && !inv.closedAt) values.closedAt = new Date().toISOString().slice(0, 10);
    await updateInvestigation(inv, values, `Etapa: ${STAGES[to].name}.`);
    audit("Etapa da investigação", `${inv.code}: ${STAGES[from].name} → ${STAGES[to].name}.`);
  }

  async function deleteInvestigation(inv: Investigation) {
    if (!window.confirm(`Excluir a investigação ${inv.code} e todo o dossiê (fontes, alvos vinculados e arquivos)? Esta ação não pode ser desfeita.`)) return false;
    const files = items.filter((i) => i.investigationId === inv.id && i.filePath).map((i) => i.filePath);
    const { error } = await supabase.from("investigations").delete().eq("id", inv.id);
    if (error) return Boolean(fail(error, "Erro ao excluir a investigação."));
    if (files.length) await supabase.storage.from(INVESTIGATION_BUCKET).remove(files);
    setInvestigations((list) => list.filter((i) => i.id !== inv.id));
    audit("Investigação excluída", `Excluiu ${inv.code} — ${inv.title}.`);
    notify("Investigação excluída.");
    return true;
  }

  // ---------- Fontes e evidências ----------
  async function saveItem(inv: Investigation, values: Partial<InvestigationItem>, file?: File | null, existing?: InvestigationItem) {
    if (!values.title?.trim()) { notify("Informe a descrição da fonte.", "error"); return null; }
    const row: Record<string, any> = toRow(values, ITEM_FIELDS);
    if (file) {
      const path = `${inv.id}/${Date.now()}-${safeFileName(file.name)}`;
      const up = await supabase.storage.from(INVESTIGATION_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (up.error) return fail(up.error, "Erro ao enviar o arquivo. Rode o script 02_investigacoes.sql (cria o espaço de arquivos).");
      Object.assign(row, { file_path: path, file_name: file.name, file_size: file.size, mime_type: file.type });
      if (existing?.filePath) await supabase.storage.from(INVESTIGATION_BUCKET).remove([existing.filePath]);
    }
    const query = existing
      ? supabase.from("investigation_items").update(row).eq("id", existing.id).select("*").single()
      : supabase.from("investigation_items").insert({ ...row, investigation_id: inv.id, created_by: data.currentUser?.id }).select("*").single();
    const { data: saved, error } = await query;
    if (error) return fail(error, "Erro ao salvar a fonte.");
    const item = normalizeItem(saved);
    setItems((list) => (existing ? list.map((i) => (i.id === item.id ? item : i)) : [...list, item]));
    if (!existing) audit("Fonte adicionada", `${inv.code}: ${item.kind} — ${item.title}.`);
    notify(existing ? "Fonte atualizada." : "Fonte adicionada ao dossiê.");
    return item;
  }

  async function deleteItem(item: InvestigationItem) {
    if (!window.confirm(`Remover "${item.title}" do dossiê?`)) return;
    const { error } = await supabase.from("investigation_items").delete().eq("id", item.id);
    if (error) { fail(error, "Erro ao remover a fonte."); return; }
    if (item.filePath) await supabase.storage.from(INVESTIGATION_BUCKET).remove([item.filePath]);
    setItems((list) => list.filter((i) => i.id !== item.id));
    notify("Fonte removida.");
  }

  async function openItemFile(item: InvestigationItem) {
    const popup = window.open("", "_blank");
    const { data: signed, error } = await supabase.storage.from(INVESTIGATION_BUCKET).createSignedUrl(item.filePath, 300);
    if (error || !signed?.signedUrl) { popup?.close(); notify("Não foi possível abrir o arquivo.", "error"); return; }
    if (popup) popup.location.href = signed.signedUrl; else window.location.href = signed.signedUrl;
    audit("Arquivo de investigação aberto", `Abriu ${item.fileName}.`);
  }

  // ---------- Alvos ----------
  async function addTarget(inv: Investigation, authorId: string, role = "Associado", parentId = "") {
    if (targets.some((t) => t.investigationId === inv.id && t.authorId === authorId)) { notify("Este alvo já está no dossiê.", "info"); return null; }
    const position = targets.filter((t) => t.investigationId === inv.id).length;
    const { data: created, error } = await supabase.from("investigation_targets")
      .insert({ investigation_id: inv.id, author_id: authorId, role, parent_id: parentId || null, position }).select("*").single();
    if (error) return fail(error, "Erro ao vincular o alvo.");
    const target = normalizeTarget(created);
    setTargets((list) => [...list, target]);
    const author = data.authors.find((a) => a.id === authorId);
    audit("Alvo vinculado", `${inv.code}: ${author?.name || "alvo"} como ${role}.`);
    return target;
  }

  async function createAndAddTarget(inv: Investigation, form: any, role: string, parentId = "") {
    const author = await data.addAuthor(form);
    if (!author) return null;
    return addTarget(inv, author.id, role, parentId);
  }

  async function updateTarget(target: InvestigationTarget, values: Partial<InvestigationTarget>) {
    if (values.parentId && values.parentId === target.id) { notify("Um alvo não pode ser superior de si mesmo.", "error"); return; }
    // Evita ciclo: o novo superior não pode ser subordinado deste alvo.
    if (values.parentId) {
      let cursor = targets.find((t) => t.id === values.parentId);
      while (cursor) {
        if (cursor.id === target.id) { notify("Esse vínculo criaria um ciclo na hierarquia.", "error"); return; }
        cursor = targets.find((t) => t.id === cursor!.parentId);
      }
    }
    setTargets((list) => list.map((t) => (t.id === target.id ? { ...t, ...values } : t)));
    const row: any = {};
    if ("role" in values) row.role = values.role;
    if ("parentId" in values) row.parent_id = values.parentId || null;
    if ("notes" in values) row.notes = values.notes;
    if ("position" in values) row.position = values.position;
    const { error } = await supabase.from("investigation_targets").update(row).eq("id", target.id);
    if (error) { load(); fail(error, "Erro ao atualizar o alvo."); }
  }

  async function removeTarget(target: InvestigationTarget) {
    const author = data.authors.find((a) => a.id === target.authorId);
    if (!window.confirm(`Desvincular ${author?.name || "este alvo"} da investigação? (O card no banco de alvos continua.)`)) return;
    const { error } = await supabase.from("investigation_targets").delete().eq("id", target.id);
    if (error) { fail(error, "Erro ao desvincular."); return; }
    setTargets((list) => list.filter((t) => t.id !== target.id).map((t) => (t.parentId === target.id ? { ...t, parentId: "" } : t)));
    setLinks((list) => list.filter((l) => l.fromTarget !== target.id && l.toTarget !== target.id));
  }

  async function addLink(inv: Investigation, fromTarget: string, toTarget: string, relation: string, notes = "") {
    if (!fromTarget || !toTarget || fromTarget === toTarget) { notify("Escolha dois alvos diferentes.", "error"); return null; }
    const { data: created, error } = await supabase.from("investigation_links").insert({ investigation_id: inv.id, from_target: fromTarget, to_target: toTarget, relation, notes }).select("*").single();
    if (error) return fail(error, "Erro ao registrar o vínculo.");
    const link = normalizeLink(created);
    setLinks((list) => [...list, link]);
    return link;
  }

  async function deleteLink(link: InvestigationLink) {
    const { error } = await supabase.from("investigation_links").delete().eq("id", link.id);
    if (error) { fail(error, "Erro ao remover o vínculo."); return; }
    setLinks((list) => list.filter((l) => l.id !== link.id));
  }

  // ---------- Relatório ----------
  async function generateReport(inv: Investigation, format: "pdf" | "pptx") {
    const invTargets = targets.filter((t) => t.investigationId === inv.id);
    const invItems = items.filter((i) => i.investigationId === inv.id);
    const invLinks = links.filter((l) => l.investigationId === inv.id);
    const authorOf = (id: string) => data.authors.find((a) => a.id === id) as Author | undefined;
    const people: ReportPerson[] = [];
    for (const t of [...invTargets].sort((a, b) => a.position - b.position)) {
      const a = authorOf(t.authorId);
      if (!a) continue;
      const parent = invTargets.find((x) => x.id === t.parentId);
      const photoRow = data.authorPhotos.find((p) => p.authorId === a.id);
      const photo = photoRow ? await loadImage(data.getIntelFileUrl(photoRow.filePath)) : undefined;
      people.push({
        targetId: t.id, authorId: a.id, name: a.name, alias: a.alias, role: t.role, parentName: parent ? authorOf(parent.authorId)?.name || "" : "",
        birthDate: a.birthDate, motherName: a.motherName, document: a.document, address: a.address, neighborhood: a.neighborhood, city: a.city,
        status: a.status, crimes: a.crimes, notes: a.notes, targetNotes: t.notes, photo,
      });
    }
    const userName = (id: string) => { const u = data.users.find((x) => x.id === id); return u ? u.warName || u.name : ""; };
    const logo = await loadImage("/pmmg-logo.png", true);
    const [{ buildReport }, renderer] = await Promise.all([
      import("../lib/report/model"),
      format === "pdf" ? import("../lib/report/pdf") : import("../lib/report/pptx"),
    ]);
    const model = buildReport({
      investigation: inv, items: invItems, targets: invTargets, links: invLinks, people,
      responsibleName: userName(inv.responsibleId), teamNames: inv.team.map(userName).filter(Boolean),
      generatedBy: data.currentUser?.warName || data.currentUser?.name || "", logo,
    });
    const bytes = format === "pdf" ? await (renderer as typeof import("../lib/report/pdf")).renderPdf(model) : await (renderer as typeof import("../lib/report/pptx")).renderPptx(model);
    const name = `RELINT_${inv.code || "SEM-CODIGO"}_${slug(inv.title)}.${format}`;
    download(bytes, name, format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    audit("Relatório gerado", `${inv.code}: ${format.toUpperCase()} gerado.`);
    notify(`${format.toUpperCase()} gerado: ${name}`);
  }

  return {
    investigations, items, targets, links, loaded, reload: load,
    createInvestigation, updateInvestigation, toggleStageItem, setStage, deleteInvestigation,
    saveItem, deleteItem, openItemFile, addTarget, createAndAddTarget, updateTarget, removeTarget, addLink, deleteLink, generateReport,
  };
}

export type InvestigationsApi = ReturnType<typeof useInvestigations>;
