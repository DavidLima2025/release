import { useMemo, useState } from "react";
import { FileSearch, FolderLock, Plus, Search, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, EmptyState } from "../components/ui/card";
import { Field, Input, Select, Textarea } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Modal } from "../components/ui/modal";
import { CLASSIFICATIONS, Investigation, INVESTIGATION_STATUSES, overallProgress, STAGES } from "../lib/investigation";
import { PRIORITIES, matchesText } from "../lib/domain";
import { formatBR } from "../lib/dates";
import type { AppData } from "../hooks/useAppData";
import type { InvestigationsApi } from "../hooks/useInvestigations";

type Props = { data: AppData; api: InvestigationsApi; onOpen: (inv: Investigation) => void; createOpen: boolean; setCreateOpen: (v: boolean) => void };

export function InvestigationsView({ data, api, onOpen, createOpen, setCreateOpen }: Props) {
  const [query, setQuery] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const userName = (id: string) => { const u = data.users.find((x) => x.id === id); return u ? u.warName || u.name : "—"; };

  const visible = useMemo(() => api.investigations.filter((inv) => matchesText([inv.code, inv.title, inv.objective, inv.nature, inv.area, userName(inv.responsibleId)], query)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api.investigations, query, data.users]);
  const active = visible.filter((i) => i.status === "Em andamento" || i.status === "Suspensa");
  const closed = visible.filter((i) => i.status === "Concluída" || i.status === "Arquivada");

  const card = (inv: Investigation) => {
    const progress = overallProgress(inv);
    const nTargets = api.targets.filter((t) => t.investigationId === inv.id).length;
    const nItems = api.items.filter((t) => t.investigationId === inv.id).length;
    return (
      <button key={inv.id} type="button" onClick={() => onOpen(inv)} className="relative w-full overflow-hidden rounded-sm border border-pm-line bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-pm-gold">
        <span className="absolute inset-x-0 top-0 h-1 bg-pm-gold" style={{ width: `${progress}%` }} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-black tracking-wider text-pm-gold-dark">{inv.code}</span>
          <span className="flex gap-1">
            {inv.status === "Suspensa" && <Badge tone="paused">Suspensa</Badge>}
            {inv.classification !== "Ostensivo" && <Badge tone="late">{inv.classification}</Badge>}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 font-bold leading-snug">{inv.title}</p>
        <p className="mt-1 text-xs text-pm-muted">{userName(inv.responsibleId)} · desde {formatBR(inv.openedAt)}</p>
        <div className="mt-2 flex items-center gap-3 text-[11px] font-semibold text-pm-muted">
          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{nTargets} alvo(s)</span>
          <span className="inline-flex items-center gap-1"><FileSearch className="h-3 w-3" />{nItems} fonte(s)</span>
          <span className="ml-auto">{progress}%</span>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-80 max-w-full"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-pm-muted" /><Input className="pl-9" placeholder="Código, título, alvo, área…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-[#7A6C45]" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />Mostrar concluídas e arquivadas ({closed.length})</label>
      </div>

      {api.loaded && api.investigations.length === 0 ? (
        <EmptyState icon={FolderLock} title="Nenhuma investigação aberta">Abra uma linha de investigação para montar o dossiê: fontes, alvos, organograma e relatório.</EmptyState>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
          {STAGES.map((stage, index) => {
            const list = active.filter((inv) => inv.stage === stage.key);
            return (
              <div key={stage.key} className="flex w-64 shrink-0 flex-col rounded-sm border border-pm-line bg-pm-cream/70">
                <div className="flex items-center gap-2 bg-pm-black px-3 py-2 text-white">
                  <span className="grid h-6 w-6 place-items-center rounded-sm bg-pm-gold text-xs font-black text-pm-black">{index + 1}</span>
                  <span className="flex-1 truncate text-xs font-black uppercase tracking-wider">{stage.name}</span>
                  <span className="text-xs font-bold text-pm-gold-light">{list.length}</span>
                </div>
                <p className="border-b border-pm-line px-3 py-1.5 text-[11px] leading-snug text-pm-muted">{stage.description}</p>
                <div className="flex min-h-24 flex-col gap-2 p-2">{list.map(card)}</div>
              </div>
            );
          })}
        </div>
      )}

      {showClosed && (
        <Card>
          <CardContent>
            <p className="pm-heading mb-3">Concluídas e arquivadas</p>
            {closed.length === 0 ? <p className="text-sm text-pm-muted">Nenhuma.</p> : <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{closed.map(card)}</div>}
          </CardContent>
        </Card>
      )}

      <CreateInvestigationModal open={createOpen} data={data} onClose={() => setCreateOpen(false)} onCreate={async (values) => { const inv = await api.createInvestigation(values); if (inv) { setCreateOpen(false); onOpen(inv); } }} />
    </div>
  );
}

function CreateInvestigationModal({ open, data, onClose, onCreate }: { open: boolean; data: AppData; onClose: () => void; onCreate: (v: Partial<Investigation>) => void }) {
  const empty = { title: "", objective: "", origin: "", nature: "", area: "", classification: "Reservado", priority: "Média", responsibleId: data.currentUser?.id || "", dueDate: "" };
  const [form, setForm] = useState(empty);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const analysts = data.users.filter((u) => u.status === "Ativo" && u.role !== "Colaborador");
  return (
    <Modal open={open} onClose={() => { onClose(); setForm(empty); }} eyebrow="Etapa 1 · Abertura" title="Nova linha de investigação"
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={() => onCreate(form)}><Plus />Abrir investigação</Button></>}>
      <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onCreate(form); }}>
        <Field label="Título" className="md:col-span-2"><Input autoFocus value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Tráfico de drogas na Vila X" /></Field>
        <Field label="Objetivo" className="md:col-span-2"><Textarea rows={3} value={form.objective} onChange={(e) => set("objective", e.target.value)} placeholder="O que a investigação precisa responder?" /></Field>
        <Field label="Origem da demanda" className="md:col-span-2"><Input value={form.origin} onChange={(e) => set("origin", e.target.value)} placeholder="Ex.: determinação do Cmt da 6ª CIA após aumento de ocorrências" /></Field>
        <Field label="Natureza"><Input value={form.nature} onChange={(e) => set("nature", e.target.value)} placeholder="Ex.: Tráfico de drogas" /></Field>
        <Field label="Área / bairros"><Input value={form.area} onChange={(e) => set("area", e.target.value)} /></Field>
        <Field label="Responsável"><Select value={form.responsibleId} onChange={(e) => set("responsibleId", e.target.value)}>{analysts.map((u) => <option key={u.id} value={u.id}>{u.warName || u.name}</option>)}</Select></Field>
        <Field label="Prazo"><Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></Field>
        <Field label="Grau de sigilo"><Select value={form.classification} onChange={(e) => set("classification", e.target.value)}>{CLASSIFICATIONS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Prioridade"><Select value={form.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</Select></Field>
        <p className="text-xs text-pm-muted md:col-span-2">O código (INV-{new Date().getFullYear()}-nnn) é gerado automaticamente. Situações: {INVESTIGATION_STATUSES.join(", ")}.</p>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
