import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Copy, FileText, Inbox, Link2, Loader2, MessageCircle, Power, Trash2, UserPlus, Users, XCircle } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Field, Input, Select, Textarea } from "./ui/input";
import { Badge } from "./ui/badge";
import type { AppData } from "../hooks/useAppData";
import { IntakeApi, IntakeLink, IntakeSubmission, intakeUrl } from "../hooks/useIntake";
import { formatBR, formatDateTimeBR } from "../lib/dates";
import { normName, scoreAuthors } from "../lib/photoMatch";

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy"); ta.remove(); return ok;
  }
}

const inviteText = (link: IntakeLink) =>
  `*SI 6ª CIA — Cadastro de alvo*\nUse este link para cadastrar alvos (dados, fotos e o PDF do REDS). O envio passa por conferência antes de entrar na base.\n${intakeUrl(link.token)}${link.expiresAt ? `\nVálido até ${formatBR(link.expiresAt.slice(0, 10))}.` : ""}\n_Uso restrito — não repasse._`;

/** Criar e gerenciar links de cadastro externo (para mandar no WhatsApp). */
export function IntakeLinksModal({ open, onClose, data, intake }: { open: boolean; onClose: () => void; data: AppData; intake: IntakeApi }) {
  const [label, setLabel] = useState("");
  const [days, setDays] = useState(30);
  const [folderId, setFolderId] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => { if (open) { setLabel(""); setDays(30); setFolderId(""); setCopied(""); intake.load(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async () => {
    setBusy(true);
    const link = await intake.createLink(label, days, folderId);
    setBusy(false);
    if (link) { setLabel(""); window.open(whatsappUrl(inviteText(link)), "_blank", "noopener"); }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" eyebrow="Banco de alvos" title={<span className="inline-flex items-center gap-2"><Link2 className="h-5 w-5 text-pm-gold-light" />Links de cadastro externo</span>}>
      {intake.missing ? (
        <div className="rounded-sm border-l-4 border-status-risk bg-status-risk/10 p-4 text-sm">
          <b>Falta ativar no banco.</b> Rode o script <code>supabase/04_audiencias_links_externos.sql</code> no Supabase (SQL Editor) e abra esta janela de novo.
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-pm-muted">Gere um link e mande no WhatsApp para outro policial. Ele abre no celular, cadastra o alvo (dados, fotos e o PDF do REDS) e o envio cai em <b>Recebidos</b> para você aprovar — nada entra na base sem a sua conferência. Quem tem o link não vê nada da sua base.</p>
          <div className="grid gap-3 rounded-sm border border-pm-line bg-white p-4 sm:grid-cols-[1fr_140px_180px_auto] sm:items-end">
            <Field label="Para quem (nome do link)"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Sgt Fulano — GEPAR 16º BPM" /></Field>
            <Field label="Validade">
              <Select value={days} onChange={(e) => setDays(Number(e.target.value))}>
                {[1, 7, 15, 30, 90, 180].map((d) => <option key={d} value={d}>{d} dia(s)</option>)}
                <option value={0}>Sem prazo</option>
              </Select>
            </Field>
            <Field label="Sugerir pasta">
              <Select value={folderId} onChange={(e) => setFolderId(e.target.value)}><option value="">—</option>{data.authorCategories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select>
            </Field>
            <Button variant="primary" onClick={create} disabled={busy || !label.trim()}>{busy ? <Loader2 className="animate-spin" /> : <MessageCircle />}Criar e enviar</Button>
          </div>

          <div className="divide-y divide-pm-line rounded-sm border border-pm-line bg-white">
            {intake.links.length === 0 && <p className="p-4 text-sm text-pm-muted">Nenhum link criado ainda.</p>}
            {intake.links.map((link) => {
              const expired = Boolean(link.expiresAt) && new Date(link.expiresAt) < new Date();
              const ok = link.active && !expired;
              return (
                <div key={link.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${ok ? "" : "opacity-60"}`}>
                  <div className="min-w-[200px] flex-1">
                    <p className="font-bold">{link.label}</p>
                    <p className="flex flex-wrap gap-x-3 text-xs text-pm-muted">
                      <span>{link.uses} envio(s)</span>
                      <span>{link.expiresAt ? `${expired ? "expirou" : "válido até"} ${formatBR(link.expiresAt.slice(0, 10))}` : "sem prazo"}</span>
                      {!link.active && <Badge tone="late">Desativado</Badge>}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" disabled={!ok} onClick={async () => { if (await copy(intakeUrl(link.token))) setCopied(link.id); }}><Copy />{copied === link.id ? "Copiado" : "Copiar"}</Button>
                    <Button size="sm" variant="gold" disabled={!ok} onClick={() => window.open(whatsappUrl(inviteText(link)), "_blank", "noopener")}><MessageCircle />WhatsApp</Button>
                    <Button size="sm" onClick={() => intake.setLinkActive(link, !link.active)} title={link.active ? "Desativar" : "Reativar"}><Power />{link.active ? "Desativar" : "Reativar"}</Button>
                    <Button size="sm" variant="danger" onClick={() => intake.deleteLink(link)} aria-label="Excluir link"><Trash2 /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}

const FORM_FIELDS: [keyof IntakeSubmission["payload"], string][] = [
  ["name", "Nome"], ["alias", "Vulgo"], ["birthDate", "Nascimento"], ["motherName", "Mãe"], ["fatherName", "Pai"], ["document", "RG / CPF"],
  ["address", "Endereço"], ["neighborhood", "Bairro"], ["city", "Cidade"], ["crimes", "Crimes / modus"], ["reds", "REDS"], ["notes", "Observações"],
];

/** Caixa de recebidos: conferir e aprovar (card novo ou juntar a um existente) ou recusar. */
export function IntakeInboxModal({ open, onClose, data, intake, onApproved }: { open: boolean; onClose: () => void; data: AppData; intake: IntakeApi; onApproved?: (authorId: string) => void }) {
  const [tab, setTab] = useState<"Pendente" | "Aprovado" | "Recusado">("Pendente");
  const [currentId, setCurrentId] = useState("");
  useEffect(() => { if (open) { setTab("Pendente"); intake.load(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = intake.submissions.filter((s) => s.status === tab);
  const current = list.find((s) => s.id === currentId) || list[0];

  return (
    <Modal open={open} onClose={onClose} size="xl" eyebrow="Banco de alvos" title={<span className="inline-flex items-center gap-2"><Inbox className="h-5 w-5 text-pm-gold-light" />Cadastros recebidos</span>}>
      {intake.missing ? (
        <div className="rounded-sm border-l-4 border-status-risk bg-status-risk/10 p-4 text-sm"><b>Falta ativar no banco.</b> Rode o script <code>supabase/04_audiencias_links_externos.sql</code> no Supabase.</div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(["Pendente", "Aprovado", "Recusado"] as const).map((t) => (
              <button key={t} type="button" onClick={() => { setTab(t); setCurrentId(""); }}
                className={`rounded-sm px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${tab === t ? "bg-pm-black text-white" : "border border-pm-line bg-white hover:border-pm-gold"}`}>
                {t === "Pendente" ? "Pendentes" : t === "Aprovado" ? "Aprovados" : "Recusados"} ({intake.submissions.filter((s) => s.status === t).length})
              </button>
            ))}
          </div>
          {list.length === 0 && <p className="rounded-sm border border-pm-line bg-white p-6 text-center text-sm text-pm-muted">Nada aqui.</p>}
          {list.length > 0 && (
            <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
              <div className="max-h-[60vh] divide-y divide-pm-line overflow-auto rounded-sm border border-pm-line bg-white">
                {list.map((s) => (
                  <button key={s.id} type="button" onClick={() => setCurrentId(s.id)} className={`block w-full px-3 py-2.5 text-left ${current?.id === s.id ? "bg-pm-gold/15" : "hover:bg-pm-cream"}`}>
                    <p className="truncate text-sm font-black uppercase">{s.payload.name}</p>
                    <p className="truncate text-xs text-pm-muted">{s.submitter.name}{s.submitter.unit ? ` · ${s.submitter.unit}` : ""}</p>
                    <p className="text-[11px] text-pm-muted">{formatDateTimeBR(s.createdAt)}{s.files.length ? ` · ${s.files.length} arquivo(s)` : ""}</p>
                  </button>
                ))}
              </div>
              {current && <SubmissionReview key={current.id} sub={current} data={data} intake={intake} onApproved={(id) => { setCurrentId(""); onApproved?.(id); }} />}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function SubmissionReview({ sub, data, intake, onApproved }: { sub: IntakeSubmission; data: AppData; intake: IntakeApi; onApproved: (id: string) => void }) {
  const candidates = useMemo(() => {
    const docDigits = (sub.payload.document || "").replace(/\D/g, "");
    const byDoc = docDigits.length >= 6 ? data.authors.filter((a) => (a.document || "").replace(/\D/g, "").includes(docDigits.slice(-6))) : [];
    const byName = scoreAuthors({ name: normName(sub.payload.name), alias: normName(sub.payload.alias || ""), digits: "", display: "", displayAlias: "" }, data.authors).map((c) => c.author);
    return [...new Map([...byDoc, ...byName].map((a) => [a.id, a])).values()].slice(0, 6);
  }, [sub, data.authors]);
  const link = intake.links.find((l) => l.id === sub.linkId);
  const [mode, setMode] = useState<"new" | "merge">(candidates.length ? "merge" : "new");
  const [authorId, setAuthorId] = useState(candidates[0]?.id || "");
  const [form, setForm] = useState({
    name: sub.payload.name || "", alias: sub.payload.alias || "", motherName: sub.payload.motherName || "", fatherName: sub.payload.fatherName || "",
    birthDate: sub.payload.birthDate || "", document: sub.payload.document || "", address: sub.payload.address || "", neighborhood: sub.payload.neighborhood || "",
    city: sub.payload.city || "", crimes: sub.payload.crimes || "", categoryId: link?.folderId || "", status: "Suspeito", riskLevel: "Médio",
    notes: [sub.payload.reds && `REDS relacionado: ${sub.payload.reds}.`, sub.payload.notes].filter(Boolean).join("\n"),
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = sub.status === "Pendente";
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const approve = async () => {
    setBusy(true);
    const id = await intake.approve(sub, { mode, authorId, form });
    setBusy(false);
    if (id) onApproved(id);
  };

  return (
    <div className="space-y-4 rounded-sm border border-pm-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Users className="h-4 w-4 text-pm-gold-dark" />
        <span>Enviado por <b>{sub.submitter.name}</b>{sub.submitter.register ? ` (nº ${sub.submitter.register})` : ""}{sub.submitter.unit ? ` — ${sub.submitter.unit}` : ""}{sub.submitter.phone ? ` · ${sub.submitter.phone}` : ""}</span>
        <Badge>{sub.linkLabel}</Badge>
      </div>

      {sub.files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sub.files.map((f) => f.kind === "photo"
            ? <a key={f.path} href={intake.urls[f.path]} target="_blank" rel="noreferrer" className="block h-32 w-24 overflow-hidden rounded-sm border border-pm-line bg-pm-sand">{intake.urls[f.path] && <img src={intake.urls[f.path]} alt="" className="h-full w-full object-cover" />}</a>
            : <a key={f.path} href={intake.urls[f.path]} target="_blank" rel="noreferrer" className="flex h-32 w-24 flex-col items-center justify-center gap-1 rounded-sm border border-pm-line bg-pm-cream p-2 text-center text-[10px] font-bold"><FileText className="h-6 w-6 text-pm-gold-dark" />{f.name}</a>)}
        </div>
      )}

      {pending ? (
        <>
          <div className="grid gap-2.5 sm:grid-cols-3">
            {FORM_FIELDS.filter(([k]) => k !== "reds").map(([k, label]) => (
              <Field key={k} label={label} className={k === "name" || k === "address" || k === "notes" || k === "crimes" ? "sm:col-span-3" : ""}>
                {k === "notes" ? <Textarea rows={3} value={(form as any)[k]} onChange={(e) => set(k, e.target.value)} />
                  : <Input type={k === "birthDate" ? "date" : "text"} value={(form as any)[k]} onChange={(e) => set(k, e.target.value)} />}
              </Field>
            ))}
            <Field label="Pasta"><Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}><option value="">Sem pasta</option>{data.authorCategories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></Field>
            <Field label="Situação"><Select value={form.status} onChange={(e) => set("status", e.target.value)}>{["Suspeito", "Autor", "Monitorado", "Foragido", "Preso"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Risco"><Select value={form.riskLevel} onChange={(e) => set("riskLevel", e.target.value)}>{["Baixo", "Médio", "Alto"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
          </div>

          <div className="rounded-sm border border-pm-line bg-pm-cream/60 p-3 text-sm">
            {candidates.length > 0 && <p className="mb-2 font-semibold text-[#8a6200]">Já existe alvo parecido na base — confira se é a mesma pessoa.</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Select className="h-9 w-auto" value={mode} onChange={(e) => setMode(e.target.value as "new" | "merge")}>
                <option value="new">Criar card novo</option>
                <option value="merge" disabled={!data.authors.length}>Juntar a um alvo existente</option>
              </Select>
              {mode === "merge" && (
                <Select className="h-9 min-w-64 flex-1" value={authorId} onChange={(e) => setAuthorId(e.target.value)}>
                  <option value="">Escolha o alvo…</option>
                  {candidates.length > 0 && <optgroup label="Parecidos">{candidates.map((a) => <option key={a.id} value={a.id}>{a.name}{a.alias ? ` ("${a.alias}")` : ""}</option>)}</optgroup>}
                  <optgroup label="Todos">{[...data.authors].sort((a, b) => a.name.localeCompare(b.name)).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>
                </Select>
              )}
            </div>
            {mode === "merge" && <p className="mt-1.5 text-xs text-pm-muted">Campos vazios do card são preenchidos; dados diferentes ficam registrados nas observações. Fotos e PDF vão para o card.</p>}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <Field label="Motivo (se recusar)" className="min-w-48 flex-1"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" /></Field>
            <Button variant="danger" disabled={busy} onClick={async () => { if (window.confirm("Recusar este envio? As fotos enviadas serão apagadas.")) { setBusy(true); await intake.reject(sub, note); setBusy(false); } }}><XCircle />Recusar</Button>
            <Button variant="primary" disabled={busy || (mode === "merge" && !authorId) || !form.name.trim()} onClick={approve}>{busy ? <Loader2 className="animate-spin" /> : mode === "merge" ? <CheckCircle2 /> : <UserPlus />}{mode === "merge" ? "Aprovar e juntar" : "Aprovar e cadastrar"}</Button>
          </div>
        </>
      ) : (
        <div className="space-y-1 text-sm">
          {FORM_FIELDS.map(([k, label]) => sub.payload[k] ? <p key={k}><b>{label}:</b> {k === "birthDate" ? formatBR(String(sub.payload[k])) : sub.payload[k]}</p> : null)}
          <p className="pt-2 text-xs text-pm-muted">{sub.status} em {formatDateTimeBR(sub.reviewedAt)}{sub.reviewNote ? ` — ${sub.reviewNote}` : ""}.</p>
          {sub.authorId && data.authors.some((a) => a.id === sub.authorId) && <Button size="sm" onClick={() => onApproved(sub.authorId)}>Abrir card</Button>}
        </div>
      )}
    </div>
  );
}
