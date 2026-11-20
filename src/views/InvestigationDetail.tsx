import { Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft, Check, ChevronRight, Download, Edit3, ExternalLink, FileSearch, FileText, GitFork, History, Link2, Loader2,
  Map as MapIcon, Paperclip, Plus, Presentation, Save, ScanText, Search, Sparkles, Layers, Binoculars, MapPin, Trash2, UserRound, UserPlus, Users,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, EmptyState, SectionHeader } from "../components/ui/card";
import { Field, Input, Select, Textarea } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Modal } from "../components/ui/modal";
import { LinkChart, Organogram } from "../components/Organogram";
import { BoAuthorModal } from "../components/BoAuthorModal";
import { DossieModal } from "../components/DossieModal";
import { CompareModal, EvidenceModal, GroupTimeline, GroupsModal, HierarchyModal, LinkDropModal, SharedContactsPanel, UnknownModal } from "../components/OrgTools";
import { autoLinksFor } from "../lib/sharedContacts";
import { groupStatus, type Confidence } from "../lib/investigation";
import { OrgBoard, type BoardPerson } from "../components/OrgBoard";
import { AUTO_GROUPS, groupKeyOf, roleOfAutoGroup } from "../lib/orgBoard";
import { redsCount } from "../lib/companions";
import { TargetFichaModal } from "../components/TargetFichaModal";
import { ShareTargetModal } from "../components/ShareTargetModal";
import type { Author } from "../lib/domain";
import { companionsOf } from "../lib/companions";

const CrimeMap = lazy(() => import("./CrimeMap"));
import {
  CLASSIFICATIONS, INFO_RATINGS, INVESTIGATION_STATUSES, ITEM_KINDS, Investigation, InvestigationItem, InvestigationLink, InvestigationTarget,
  RELATIONS, ROLE_COLOR, SOURCE_RATINGS, STAGES, TARGET_ROLES, overallProgress, ratingLabel, stageIndex, stageProgress,
} from "../lib/investigation";
import { PRIORITIES, formatBytes, matchesText } from "../lib/domain";
import { formatBR } from "../lib/dates";
import type { AppData } from "../hooks/useAppData";
import type { InvestigationsApi } from "../hooks/useInvestigations";

type Tab = "dossie" | "fontes" | "alvos" | "mapa" | "cronologia" | "analise" | "relatorio";
const TABS: [Tab, string, any][] = [
  ["dossie", "Dossiê", FileText], ["fontes", "Fontes e evidências", FileSearch], ["alvos", "Alvos e organograma", GitFork], ["mapa", "Mapa", MapIcon],
  ["cronologia", "Cronologia", History], ["analise", "Análise e conclusão", Edit3], ["relatorio", "Relatório", Download],
];

type Props = { data: AppData; api: InvestigationsApi; investigation: Investigation; onBack: () => void };

export function InvestigationDetail({ data, api, investigation: inv, onBack }: Props) {
  const [tab, setTab] = useState<Tab>("dossie");
  const [generating, setGenerating] = useState<"" | "pdf" | "pptx">("");
  const items = api.items.filter((i) => i.investigationId === inv.id);
  const targets = api.targets.filter((t) => t.investigationId === inv.id);
  const links = api.links.filter((l) => l.investigationId === inv.id);
  // Núcleos do organograma para o mapa (área de atuação × onde agiu).
  const mapNucleos = (() => {
    const by = new Map<string, { name: string; color: string; members: { authorId: string; name: string; area: string }[] }>();
    for (const t of targets) {
      if (!t.authorId) continue;
      const key = groupKeyOf(t, inv.orgGroups); const name = key.slice(2);
      const custom = inv.orgGroups.find((g) => g.name === name && key.startsWith("c:"));
      const color = custom?.color || ROLE_COLOR[roleOfAutoGroup(name)] || "#6B655A";
      const g = by.get(key) || { name, color, members: [] };
      g.members.push({ authorId: t.authorId, name: data.authors.find((a) => a.id === t.authorId)?.name || "?", area: t.area });
      by.set(key, g);
    }
    return [...by.values()];
  })();
  const canDelete = data.permissions.users || data.currentUser?.role === "Gestor" || inv.responsibleId === data.currentUser?.id;

  const generate = async (format: "pdf" | "pptx") => {
    setGenerating(format);
    try { await api.generateReport(inv, format); } catch (e) { console.error(e); data.reload(); window.alert("Não foi possível gerar o arquivo. Veja o console para detalhes."); }
    setGenerating("");
  };

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden bg-pm-black p-5 text-white md:p-6">
        <div className="absolute inset-y-0 right-0 hidden w-40 bg-pm-gold [clip-path:polygon(45%_0,100%_0,100%_100%,0_100%)] md:block" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-pm-gold-light hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />Investigações</button>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-black tracking-wider text-pm-gold-light">{inv.code}</span>
              {inv.classification !== "Ostensivo" && <span className="pm-chip bg-status-late text-white">{inv.classification}</span>}
              <span className="pm-chip bg-white/10 text-white">{inv.status}</span>
            </div>
            <h2 className="mt-1 font-display text-2xl font-black uppercase leading-tight md:text-3xl">{inv.title}</h2>
            <p className="mt-1 text-sm text-white/70">{targets.length} alvo(s) · {items.length} fonte(s) · {overallProgress(inv)}% concluído</p>
          </div>
          <div className="relative flex flex-wrap gap-2 lg:mr-28">
            <Button variant="gold" onClick={() => generate("pdf")} disabled={Boolean(generating)}>{generating === "pdf" ? <Loader2 className="animate-spin" /> : <FileText />}Gerar PDF</Button>
            <Button variant="light" onClick={() => generate("pptx")} disabled={Boolean(generating)}>{generating === "pptx" ? <Loader2 className="animate-spin" /> : <Presentation />}Gerar PPTX</Button>
          </div>
        </div>
      </div>

      <StageBoard inv={inv} api={api} />

      <div className="flex gap-1 overflow-x-auto border-b border-pm-line">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => setTab(key)}
            className={`-mb-px inline-flex shrink-0 items-center gap-2 border-b-[3px] px-4 py-2.5 text-xs font-black uppercase tracking-wider ${tab === key ? "border-pm-gold text-pm-black" : "border-transparent text-pm-muted hover:text-pm-ink"}`}>
            <Icon className="h-4 w-4" />{label}
            {key === "fontes" && <span className="text-pm-muted">{items.length}</span>}
            {key === "alvos" && <span className="text-pm-muted">{targets.length}</span>}
          </button>
        ))}
      </div>

      {tab === "dossie" && <DossierTab data={data} api={api} inv={inv} canDelete={canDelete} onDeleted={onBack} />}
      {tab === "fontes" && <SourcesTab data={data} api={api} inv={inv} items={items} targets={targets} />}
      {tab === "alvos" && <TargetsTab data={data} api={api} inv={inv} targets={targets} links={links} />}
      {tab === "mapa" && (
        <Suspense fallback={<div className="flex items-center gap-2 py-16 text-pm-muted"><Loader2 className="h-5 w-5 animate-spin" />Carregando o mapa…</div>}>
          <CrimeMap data={data} api={api} items={items} nucleos={mapNucleos} />
        </Suspense>
      )}
      {tab === "cronologia" && <TimelineTab inv={inv} items={items} />}
      {tab === "analise" && <AnalysisTab api={api} inv={inv} />}
      {tab === "relatorio" && <ReportTab inv={inv} items={items} targets={targets} links={links} generating={generating} onGenerate={generate} onTab={setTab} />}
    </div>
  );
}

// ---------- Etapas ----------
function StageBoard({ inv, api }: { inv: Investigation; api: InvestigationsApi }) {
  const current = stageIndex(inv.stage);
  const stage = STAGES[current];
  const progress = stageProgress(inv, inv.stage);
  const next = STAGES[current + 1];
  const done = inv.stages[inv.stage]?.done || [];
  return (
    <Card>
      <CardContent className="!p-4">
        <ol className="flex gap-1 overflow-x-auto pb-1">
          {STAGES.map((s, i) => {
            const state = i < current ? "done" : i === current ? "current" : "todo";
            return (
              <li key={s.key} className="min-w-[120px] flex-1">
                <button type="button" onClick={() => i !== current && window.confirm(`Mover a investigação para a etapa "${s.name}"?`) && api.setStage(inv, s.key)}
                  className={`skew-tab flex h-11 w-full items-center justify-center px-3 text-center text-[11px] font-black uppercase tracking-wide transition ${state === "current" ? "bg-pm-black text-white" : state === "done" ? "bg-pm-gold text-pm-black hover:bg-pm-gold-light" : "bg-pm-sand text-pm-muted hover:bg-pm-line"}`}>
                  <span className="flex items-center gap-1.5">{state === "done" ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}{s.short}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <p className="pm-eyebrow">Etapa {current + 1} de {STAGES.length} · {progress.count}/{progress.total} itens</p>
            <p className="pm-heading mt-0.5">{stage.name}</p>
            <p className="text-sm text-pm-muted">{stage.description}</p>
            <div className="mt-3 grid gap-1.5 md:grid-cols-2">
              {stage.checklist.map((item, i) => (
                <label key={item} className="flex cursor-pointer items-start gap-2 rounded-sm border border-pm-line bg-white px-3 py-2 text-sm hover:border-pm-gold">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#7A6C45]" checked={Boolean(done[i])} onChange={() => api.toggleStageItem(inv, inv.stage, i)} />
                  <span className={done[i] ? "text-pm-muted line-through" : ""}>{item}</span>
                </label>
              ))}
            </div>
          </div>
          {next && (
            <Button variant={progress.count === progress.total ? "primary" : "outline"} onClick={() => api.setStage(inv, next.key)}>
              Avançar para {next.name}<ChevronRight />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Dossiê (dados gerais) ----------
function DossierTab({ data, api, inv, canDelete, onDeleted }: { data: AppData; api: InvestigationsApi; inv: Investigation; canDelete: boolean; onDeleted: () => void }) {
  const pick = (i: Investigation) => ({
    title: i.title, objective: i.objective, origin: i.origin, destination: i.destination, summary: i.summary, methodology: i.methodology,
    classification: i.classification, status: i.status, priority: i.priority, nature: i.nature, area: i.area, responsibleId: i.responsibleId,
    team: i.team, openedAt: i.openedAt, dueDate: i.dueDate, closedAt: i.closedAt,
  });
  const [form, setForm] = useState(() => pick(inv));
  useEffect(() => setForm(pick(inv)), [inv.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const dirty = JSON.stringify(form) !== JSON.stringify(pick(inv));
  const analysts = data.users.filter((u) => u.status === "Ativo" && u.role !== "Colaborador");
  return (
    <Card>
      <CardContent>
        <SectionHeader title="Dados do dossiê" subtitle="Estes textos entram na introdução e na síntese do relatório."
          actions={<>
            {canDelete && <Button variant="danger" onClick={async () => { if (await api.deleteInvestigation(inv)) onDeleted(); }}><Trash2 />Excluir</Button>}
            <Button variant="primary" disabled={!dirty} onClick={() => api.updateInvestigation(inv, form)}><Save />Salvar</Button>
          </>} />
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Título" className="md:col-span-4"><Input value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
          <Field label="Situação"><Select value={form.status} onChange={(e) => set("status", e.target.value)}>{INVESTIGATION_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Grau de sigilo"><Select value={form.classification} onChange={(e) => set("classification", e.target.value)}>{CLASSIFICATIONS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Prioridade"><Select value={form.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Responsável"><Select value={form.responsibleId} onChange={(e) => set("responsibleId", e.target.value)}><option value="">—</option>{analysts.map((u) => <option key={u.id} value={u.id}>{u.warName || u.name}</option>)}</Select></Field>
          <Field label="Natureza"><Input value={form.nature} onChange={(e) => set("nature", e.target.value)} /></Field>
          <Field label="Área / bairros"><Input value={form.area} onChange={(e) => set("area", e.target.value)} /></Field>
          <Field label="Abertura"><Input type="date" value={form.openedAt} onChange={(e) => set("openedAt", e.target.value)} /></Field>
          <Field label="Prazo"><Input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></Field>
          <Field label="Objetivo" className="md:col-span-2"><Textarea rows={3} value={form.objective} onChange={(e) => set("objective", e.target.value)} /></Field>
          <Field label="Origem da demanda" className="md:col-span-2"><Textarea rows={3} value={form.origin} onChange={(e) => set("origin", e.target.value)} /></Field>
          <Field label="Síntese dos fatos / contexto" hint="Separe parágrafos com uma linha em branco." className="md:col-span-4"><Textarea rows={7} value={form.summary} onChange={(e) => set("summary", e.target.value)} /></Field>
          <Field label="Metodologia / ações realizadas (opcional)" className="md:col-span-2"><Textarea rows={4} value={form.methodology} onChange={(e) => set("methodology", e.target.value)} /></Field>
          <Field label="Destinatário da difusão" className="md:col-span-2"><Textarea rows={4} value={form.destination} onChange={(e) => set("destination", e.target.value)} placeholder="Ex.: Comando do 1º BPM" /></Field>
          <div className="md:col-span-4">
            <span className="pm-label">Equipe</span>
            <div className="flex flex-wrap gap-2">
              {analysts.map((u) => {
                const on = form.team.includes(u.id);
                return <button key={u.id} type="button" onClick={() => set("team", on ? form.team.filter((x: string) => x !== u.id) : [...form.team, u.id])}
                  className={`rounded-sm border px-3 py-1.5 text-xs font-bold uppercase ${on ? "border-pm-black bg-pm-black text-white" : "border-pm-line bg-white hover:border-pm-gold"}`}>{u.warName || u.name}</button>;
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Fontes e evidências ----------
const KIND_TONE: Record<string, any> = { "Boletim de ocorrência": "dark", "Relatório de inteligência": "late", Informe: "risk", Reportagem: "todo" };

function SourcesTab({ data, api, inv, items, targets }: { data: AppData; api: InvestigationsApi; inv: Investigation; items: InvestigationItem[]; targets: InvestigationTarget[] }) {
  const [editing, setEditing] = useState<InvestigationItem | null>(null);
  const [open, setOpen] = useState<"" | "new" | "bo">("");
  const [kind, setKind] = useState("");
  const [query, setQuery] = useState("");
  const authorName = (id: string) => data.authors.find((a) => a.id === id)?.name || "";
  const list = items.filter((i) => (!kind || i.kind === kind) && matchesText([i.title, i.summary, i.source, i.reference, i.kind], query))
    .sort((a, b) => (b.itemDate || "").localeCompare(a.itemDate || ""));
  return (
    <Card>
      <CardContent>
        <SectionHeader title="Fontes e evidências" subtitle="BOs, reportagens, relatórios, informes, entrevistas, fotos e qualquer dado reunido — com a avaliação da fonte."
          actions={<>
            <Button onClick={() => setOpen("bo")}><ScanText />Importar BO (PDF)</Button>
            <Button variant="primary" onClick={() => { setEditing(null); setOpen("new"); }}><Plus />Adicionar fonte</Button>
          </>} />
        <div className="mb-4 flex flex-wrap gap-2">
          <Select className="w-56" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Todos os tipos</option>{ITEM_KINDS.map((k) => <option key={k}>{k}</option>)}</Select>
          <Input className="w-72" placeholder="Pesquisar no conteúdo" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {list.length === 0 && <EmptyState icon={FileSearch} title="Nenhuma fonte registrada">Comece importando um BO em PDF ou adicionando uma reportagem, informe ou relatório.</EmptyState>}
        <div className="grid gap-2">
          {list.map((item) => (
            <div key={item.id} className={`rounded-sm border bg-white p-3 ${item.includeInReport ? "border-pm-line" : "border-dashed border-pm-line opacity-70"}`}>
              <div className="flex flex-col gap-2 md:flex-row md:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={KIND_TONE[item.kind] || "default"}>{item.kind}</Badge>
                    {item.itemDate && <span className="text-xs font-bold">{formatBR(item.itemDate)}</span>}
                    {ratingLabel(item.sourceRating, item.infoRating) && <Badge tone="gold" className="font-mono">{ratingLabel(item.sourceRating, item.infoRating)}</Badge>}
                    {!item.includeInReport && <Badge>Fora do relatório</Badge>}
                  </div>
                  <p className="mt-1 font-bold">{item.title}{item.reference ? <span className="font-normal text-pm-muted"> · {item.reference}</span> : null}</p>
                  {item.source && <p className="text-xs text-pm-muted">Fonte: {item.source}</p>}
                  {item.summary && <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm">{item.summary}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {item.authorIds.map((id) => authorName(id) && <Badge key={id} tone="todo"><Users className="h-3 w-3" />{authorName(id)}</Badge>)}
                    {item.url && <a href={item.url} target="_blank" rel="noreferrer" className="pm-chip bg-pm-sand text-pm-ink hover:text-pm-gold-dark"><ExternalLink className="h-3 w-3" />Link</a>}
                    {item.filePath && <button type="button" onClick={() => api.openItemFile(item)} className="pm-chip bg-pm-sand text-pm-ink hover:text-pm-gold-dark"><Paperclip className="h-3 w-3" />{item.fileName} {formatBytes(item.fileSize)}</button>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" onClick={() => { setEditing(item); setOpen("new"); }}><Edit3 />Editar</Button>
                  <Button size="sm" variant="danger" onClick={() => api.deleteItem(item)}><Trash2 /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <ItemModal open={Boolean(open)} boMode={open === "bo"} data={data} api={api} inv={inv} item={editing} targets={targets} onClose={() => { setOpen(""); setEditing(null); }} />
    </Card>
  );
}

function ItemModal({ open, boMode, data, api, inv, item, targets, onClose }: {
  open: boolean; boMode: boolean; data: AppData; api: InvestigationsApi; inv: Investigation; item: InvestigationItem | null; targets: InvestigationTarget[]; onClose: () => void;
}) {
  const empty = { kind: boMode ? "Boletim de ocorrência" : "Reportagem", title: "", itemDate: "", source: "", reference: "", url: "", sourceRating: "", infoRating: "", summary: "", authorIds: [] as string[], includeInReport: true };
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggested, setSuggested] = useState<{ name: string; tipo: string; add: boolean }[]>([]);
  useEffect(() => {
    if (!open) return;
    setFile(null); setSuggested([]);
    setForm(item ? { kind: item.kind, title: item.title, itemDate: item.itemDate, source: item.source, reference: item.reference, url: item.url, sourceRating: item.sourceRating, infoRating: item.infoRating, summary: item.summary, authorIds: item.authorIds, includeInReport: item.includeInReport } : empty);
  }, [open, item?.id, boMode]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const readBo = async (pdf: File) => {
    setReading(true);
    try {
      const [{ extractPdfItems }, bo] = await Promise.all([import("../lib/pdf"), import("../lib/boletim")]);
      const parsed = bo.parseBoletim(await extractPdfItems(pdf));
      if (!bo.isBoletim(parsed)) { window.alert("Não reconheci um BO do REDS neste PDF. Preencha os campos manualmente."); return; }
      const fato = [parsed.local.logradouro, parsed.local.numero].filter(Boolean).join(", ");
      setForm((f) => ({
        ...f, kind: "Boletim de ocorrência", title: `${bo.naturezaCurta(parsed.natureza)}${fato ? ` — ${fato}${parsed.local.bairro ? `, ${parsed.local.bairro}` : ""}` : ""}`,
        itemDate: parsed.dataFato || parsed.dataRegistro, source: "PMMG / REDS", reference: parsed.numero, sourceRating: f.sourceRating || "A", infoRating: f.infoRating || "2",
        summary: [parsed.envolvidos.length ? `Envolvidos: ${parsed.envolvidos.map((e) => `${e.nome} (${e.tipo.toLowerCase()})`).join("; ")}.` : "", parsed.historico].filter(Boolean).join("\n\n"),
        ...bo.boletimGeo(parsed),
      }));
      setSuggested(parsed.envolvidos.filter((e) => e.nome && /AUTOR|SUSPEITO|INFRATOR|CONDUZIDO|PRESO/i.test(e.tipo)).map((e) => ({ name: e.nome, tipo: e.tipo, add: true })));
    } catch (e) {
      console.error(e);
      window.alert("Não foi possível ler este PDF.");
    } finally { setReading(false); }
  };

  const save = async () => {
    setSaving(true);
    const authorIds = [...form.authorIds];
    // Envolvidos do BO marcados viram alvos (reaproveita o card se o nome já existir no banco de alvos).
    for (const s of suggested.filter((x) => x.add)) {
      const existing = data.authors.find((a) => a.name.trim().toUpperCase() === s.name.trim().toUpperCase());
      const target = existing
        ? (api.targets.find((t) => t.investigationId === inv.id && t.authorId === existing.id) || await api.addTarget(inv, existing.id, "Executor"))
        : await api.createAndAddTarget(inv, { name: s.name, status: "Autor", riskLevel: "Médio", city: "Belo Horizonte", crimes: form.title.split(" — ")[0], notes: `Envolvido como ${s.tipo.toLowerCase()} no REDS ${form.reference}.` }, "Executor");
      if (target && !authorIds.includes(target.authorId)) authorIds.push(target.authorId);
    }
    const saved = await api.saveItem(inv, { ...form, authorIds }, file, item || undefined);
    setSaving(false);
    if (saved) onClose();
  };

  const linked = targets.map((t) => ({ t, a: data.authors.find((x) => x.id === t.authorId) })).filter((x) => x.a);
  return (
    <Modal open={open} onClose={onClose} size="lg" eyebrow={inv.code} title={item ? "Editar fonte" : boMode ? "Importar boletim de ocorrência" : "Adicionar fonte"}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={save} disabled={saving || reading}>{saving ? <Loader2 className="animate-spin" /> : <Save />}Salvar no dossiê</Button></>}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={boMode ? "PDF do BO (o sistema lê os dados)" : "Arquivo (opcional)"} className="md:col-span-2">
          <label className="flex cursor-pointer items-center gap-3 rounded-sm border border-dashed border-pm-gold bg-white px-3 py-3 text-sm hover:bg-pm-cream">
            {reading ? <Loader2 className="h-5 w-5 animate-spin text-pm-gold-dark" /> : <Paperclip className="h-5 w-5 text-pm-gold-dark" />}
            <span className="font-semibold">{file ? file.name : item?.fileName ? `${item.fileName} (substituir)` : "Escolher arquivo — PDF, imagem, documento…"}</span>
            <input type="file" className="hidden" accept={boMode ? "application/pdf,.pdf" : undefined} onChange={(e) => {
              const f = e.target.files?.[0] || null; setFile(f);
              if (f && (boMode || form.kind === "Boletim de ocorrência") && /\.pdf$/i.test(f.name)) readBo(f);
              e.target.value = "";
            }} />
          </label>
        </Field>
        <Field label="Tipo"><Select value={form.kind} onChange={(e) => set("kind", e.target.value)}>{ITEM_KINDS.map((k) => <option key={k}>{k}</option>)}</Select></Field>
        <Field label="Data do fato / publicação"><Input type="date" value={form.itemDate} onChange={(e) => set("itemDate", e.target.value)} /></Field>
        <Field label="Descrição / título" className="md:col-span-2"><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Reportagem sobre tráfico na Vila X" /></Field>
        <Field label="Fonte (órgão, veículo, informante codificado…)"><Input value={form.source} onChange={(e) => set("source", e.target.value)} /></Field>
        <Field label="Nº / referência (REDS, ofício…)"><Input value={form.reference} onChange={(e) => set("reference", e.target.value)} /></Field>
        <Field label="Link (fonte aberta)" className="md:col-span-2"><Input type="url" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://" /></Field>
        <Field label="Idoneidade da fonte"><Select value={form.sourceRating} onChange={(e) => set("sourceRating", e.target.value)}><option value="">Não avaliada</option>{SOURCE_RATINGS.map(([k, v]) => <option key={k} value={k}>{k} — {v}</option>)}</Select></Field>
        <Field label="Veracidade do dado"><Select value={form.infoRating} onChange={(e) => set("infoRating", e.target.value)}><option value="">Não avaliada</option>{INFO_RATINGS.map(([k, v]) => <option key={k} value={k}>{k} — {v}</option>)}</Select></Field>
        <Field label="Resumo / conteúdo relevante" className="md:col-span-2"><Textarea rows={6} value={form.summary} onChange={(e) => set("summary", e.target.value)} /></Field>
        {linked.length > 0 && (
          <div className="md:col-span-2">
            <span className="pm-label">Alvos citados nesta fonte</span>
            <div className="flex flex-wrap gap-2">
              {linked.map(({ a }) => {
                const on = form.authorIds.includes(a!.id);
                return <button key={a!.id} type="button" onClick={() => set("authorIds", on ? form.authorIds.filter((x) => x !== a!.id) : [...form.authorIds, a!.id])}
                  className={`rounded-sm border px-2.5 py-1 text-xs font-bold ${on ? "border-pm-black bg-pm-black text-white" : "border-pm-line bg-white"}`}>{a!.name}</button>;
              })}
            </div>
          </div>
        )}
        {suggested.length > 0 && (
          <div className="rounded-sm border border-pm-gold bg-pm-gold/10 p-3 md:col-span-2">
            <p className="pm-label">Envolvidos do BO — adicionar como alvos do dossiê?</p>
            {suggested.map((s, i) => (
              <label key={s.name} className="flex items-center gap-2 py-0.5 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[#7A6C45]" checked={s.add} onChange={(e) => setSuggested((list) => list.map((x, j) => (j === i ? { ...x, add: e.target.checked } : x)))} />
                <b>{s.name}</b><span className="text-pm-muted">({s.tipo.toLowerCase()}){data.authors.some((a) => a.name.trim().toUpperCase() === s.name.trim().toUpperCase()) ? " · já existe no banco de alvos" : " · novo card"}</span>
              </label>
            ))}
          </div>
        )}
        <label className="flex items-center gap-2 text-sm font-semibold md:col-span-2"><input type="checkbox" className="h-4 w-4 accent-[#7A6C45]" checked={form.includeInReport} onChange={(e) => set("includeInReport", e.target.checked)} />Incluir no relatório</label>
      </div>
    </Modal>
  );
}

// ---------- Alvos, hierarquia e vínculos ----------
function TargetsTab({ data, api, inv, targets, links }: { data: AppData; api: InvestigationsApi; inv: Investigation; targets: InvestigationTarget[]; links: InvestigationLink[] }) {
  const [selected, setSelected] = useState<string>("");
  const [picked, setPicked] = useState<string[]>([]);
  const [dossieOpen, setDossieOpen] = useState(false);
  const [hierOpen, setHierOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [ficha, setFicha] = useState<Author | null>(null);
  const [orgView, setOrgView] = useState<"quadro" | "arvore">("quadro");
  const [dragMode, setDragMode] = useState<"superior" | "vinculo">("superior");
  const [linkPair, setLinkPair] = useState<{ from: string; to: string } | null>(null);
  const [unknownOpen, setUnknownOpen] = useState(false);
  const [identify, setIdentify] = useState<InvestigationTarget | null>(null);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [evidenceOf, setEvidenceOf] = useState<InvestigationTarget | null>(null);
  const [sharing, setSharing] = useState<Author | null>(null);
  const [adding, setAdding] = useState(false);
  const [autoLink, setAutoLink] = useState(true);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("Associado");
  const [parentId, setParentId] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [boOpen, setBoOpen] = useState(false);
  const [link, setLink] = useState({ from: "", to: "", relation: "Comparsa", notes: "" });
  const authorOf = (t: InvestigationTarget) => data.authors.find((a) => a.id === t.authorId);
  const nameOf = (id: string) => { const t = targets.find((x) => x.id === id); return t ? authorOf(t)?.name || t.label || "NÃO IDENTIFICADO" : "—"; };
  const inDossier = new Set(targets.map((t) => t.authorId));
  const candidates = useMemo(() => (search.trim()
    ? data.authors.filter((a) => matchesText([a.name, a.alias, a.document, a.crimes, a.neighborhood, a.notes], search))
        .sort((x, y) => Number(inDossier.has(x.id)) - Number(inDossier.has(y.id))).slice(0, 40)
    : []), [data.authors, search, targets]); // eslint-disable-line react-hooks/exhaustive-deps
  const folderName = (id: string) => data.authorCategories.find((f) => f.id === id)?.name || "";

  // Sugestões: quem esteve no mesmo BO que os alvos do dossiê e ainda não está nele.
  const suggestions = useMemo(() => {
    const out = new Map<string, { author: (typeof data.authors)[number]; with: string[]; times: number; arrested: boolean }>();
    for (const t of targets) {
      const a = authorOf(t);
      if (!a) continue;
      for (const c of companionsOf(a.id, data.authors, data.authorReports, api.items)) {
        if (inDossier.has(c.author.id)) continue;
        const cur = out.get(c.author.id) || { author: c.author, with: [], times: 0, arrested: false };
        cur.with.push(a.name); cur.times += c.occurrences.length; cur.arrested ||= c.arrestedTogether;
        out.set(c.author.id, cur);
      }
    }
    return [...out.values()].sort((x, y) => y.times - x.times).slice(0, 12);
  }, [targets, data.authors, data.authorReports, api.items]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  /** Vincula os escolhidos; se marcado, registra "Comparsa/Associado" com quem esteve no mesmo BO. */
  const add = async (ids = picked) => {
    if (!ids.length) return;
    setAdding(true);
    const created: InvestigationTarget[] = [];
    for (const id of ids) {
      if (inDossier.has(id)) continue;
      const t = await api.addTarget(inv, id, role, parentId);
      if (t) created.push(t);
    }
    if (autoLink && created.length) {
      const all = [...targets, ...created];
      const done = new Set(links.map((l) => [l.fromTarget, l.toTarget].sort().join("|")));
      for (const t of created) {
        for (const c of companionsOf(t.authorId, data.authors, data.authorReports, api.items)) {
          const other = all.find((x) => x.authorId === c.author.id && x.id !== t.id);
          if (!other) continue;
          const key = [t.id, other.id].sort().join("|");
          if (done.has(key)) continue;
          done.add(key);
          await api.addLink(inv, other.id, t.id, c.arrestedTogether ? "Comparsa" : "Contato", `Juntos em ${c.occurrences.length} BO(s): ${c.occurrences.map((o) => o.reds).join(", ")}`);
        }
      }
    }
    setAdding(false);
    setPicked([]);
    if (created.length) { setSelected(created[created.length - 1].id); setSearch(""); }
  };

  const row = (a: (typeof data.authors)[number], extra?: ReactNode) => {
    const inside = inDossier.has(a.id);
    const on = picked.includes(a.id);
    const ph = data.authorPhotos.find((p) => p.authorId === a.id && (p.category || "perfil") === "perfil");
    return (
      <div key={a.id} role="button" tabIndex={0} onClick={() => !inside && togglePick(a.id)} onKeyDown={(e) => e.key === "Enter" && !inside && togglePick(a.id)}
        className={`flex items-center gap-2 rounded-sm border p-1.5 text-left ${inside ? "border-pm-line bg-pm-sand/40 opacity-60" : on ? "cursor-pointer border-pm-gold bg-pm-gold/15" : "cursor-pointer border-pm-line bg-white hover:border-pm-gold"}`}>
        <input type="checkbox" className="h-4 w-4 shrink-0 accent-[#7A6C45]" checked={on || inside} disabled={inside} readOnly tabIndex={-1} />
        <div className="grid h-11 w-9 shrink-0 place-items-center overflow-hidden rounded-sm bg-pm-sand">{ph ? <img src={data.getIntelFileUrl(ph.filePath)} alt="" className="h-full w-full object-cover" /> : <Users className="h-4 w-4 text-pm-muted" />}</div>
        <div className="min-w-0 flex-1 text-xs">
          <p className="truncate text-[13px] font-black uppercase leading-tight">{a.name}</p>
          <p className="truncate text-pm-muted">{[a.alias && `"${a.alias}"`, a.document, folderName(a.categoryId)].filter(Boolean).join(" · ") || "—"}</p>
          {extra}
        </div>
        {inside ? <Badge>no dossiê</Badge> : (
          <button type="button" title="Vincular agora" onClick={(e) => { e.stopPropagation(); add([a.id]); }} disabled={adding}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-pm-black text-white hover:bg-pm-ink disabled:opacity-50"><Plus className="h-4 w-4" /></button>
        )}
      </div>
    );
  };

  const boardPeople = useMemo(() => {
    const m = new Map<string, BoardPerson>();
    for (const t of targets) {
      const a = authorOf(t);
      const ph = data.authorPhotos.find((p) => p.authorId === t.authorId && (p.category || "perfil") === "perfil");
      const rank: Confidence[] = ["confirmado", "provavel", "a confirmar"];
      const ev = t.evidence.filter((e) => !e.role || e.role === t.role);
      const confidence = ev.length ? rank.find((c) => ev.some((e) => (e.confidence || "provavel") === c)) : undefined;
      m.set(t.id, {
        name: a?.name || t.label || "NÃO IDENTIFICADO", alias: a?.alias || "", photo: ph ? data.getIntelFileUrl(ph.filePath) : undefined, role: t.role, area: t.area,
        evidence: t.evidence.length, bos: a ? redsCount(a.id, data.authors, data.authorReports, api.items).length : 0, unknown: !a, status: groupStatus(t), confidence,
      });
    }
    return m;
  }, [targets, data.authors, data.authorPhotos, data.authorReports, api.items]); // eslint-disable-line react-hooks/exhaustive-deps
  const autoLinks = useMemo(() => autoLinksFor(targets, data.authors), [targets, data.authors]);
  const clusterOptions = (t: InvestigationTarget) => [
    ["", `Automático (${(AUTO_GROUPS[t.role] || AUTO_GROUPS["Associado"]).name.toLowerCase()})`],
    ...inv.orgGroups.map((g) => [g.name, g.name]),
  ];

  return (
    <div className="space-y-5">
      <Card>
        <CardContent>
          <SectionHeader icon={GitFork} title="Organograma" subtitle={orgView === "quadro"
            ? "Cada quadro é um núcleo do grupo. Arraste um alvo: sobre outro alvo = fica subordinado (seta vermelha); sobre um quadro = muda de núcleo; no vazio = sem superior. Clique duplo abre a ficha."
            : "Arraste um alvo sobre outro para deixá-lo subordinado (no vazio vai para o topo). Clique seleciona; clique duplo abre a ficha."}
            actions={<div className="flex flex-wrap gap-2">
              <div className="flex overflow-hidden rounded-sm border border-pm-line text-xs font-bold">
                {([["quadro", "Quadro por núcleos"], ["arvore", "Árvore"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setOrgView(k)} className={`px-3 py-1.5 ${orgView === k ? "bg-pm-black text-white" : "bg-white"}`}>{l}</button>)}
              </div>
              <Button size="sm" onClick={() => setGroupsOpen(true)}><Layers />Núcleos ({inv.orgGroups.length})</Button>
              <Button size="sm" onClick={() => setUnknownOpen(true)}><UserPlus />Não identificado</Button>
              <Button size="sm" disabled={targets.length < 2} onClick={() => setHierOpen(true)}><Sparkles />Sugerir funções e hierarquia</Button>
              <Button size="sm" onClick={() => setCompareOpen(true)}><GitFork />Comparar investigações</Button>
              <Button size="sm" variant="primary" disabled={!targets.length} onClick={() => setDossieOpen(true)}><FileText />PDF: organograma + qualificações</Button>
            </div>} />
          {targets.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-sm bg-pm-cream/70 px-2 py-1.5 text-xs">
              <span className="font-bold uppercase text-pm-muted">Arrastar um alvo sobre outro:</span>
              <div className="flex overflow-hidden rounded-sm border border-pm-line font-bold">
                <button type="button" onClick={() => setDragMode("superior")} className={`px-3 py-1.5 ${dragMode === "superior" ? "bg-[#C0201A] text-white" : "bg-white"}`}>▼ define o superior</button>
                <button type="button" onClick={() => setDragMode("vinculo")} className={`px-3 py-1.5 ${dragMode === "vinculo" ? "bg-[#2E6B3A] text-white" : "bg-white"}`}>⇢ cria vínculo</button>
              </div>
              <span className="text-pm-muted">Os quadros não mudam de lugar ao ligar alvos: a linha depende só da função (ou do nível do núcleo).</span>
              <Button size="sm" className="ml-auto" disabled={!api.undoCount} onClick={() => api.undo()} title={api.undoLabel ? `Desfazer: ${api.undoLabel}` : ""}>↶ Desfazer{api.undoLabel ? `: ${api.undoLabel}` : ""}</Button>
            </div>
          )}
          {targets.length === 0 ? <EmptyState icon={Users} title="Nenhum alvo no dossiê">Vincule alvos do banco de alvos ou cadastre novos ao lado.</EmptyState>
            : orgView === "quadro" ? <OrgBoard targets={targets} links={links} groups={inv.orgGroups} autoLinks={autoLinks} people={boardPeople} selectedId={selected} onSelect={(t) => setSelected(t.id)} onOpen={(t) => (authorOf(t) ? setFicha(authorOf(t)!) : setIdentify(t))}
                dragMode={dragMode} onLinkDrop={(t, to) => setLinkPair({ from: t.id, to })}
                onDropOnTarget={(t, parentId) => api.updateTarget(t, { parentId })}
                onDropOnGroup={(t, key) => key.startsWith("c:") ? api.updateTarget(t, { cluster: key.slice(2) }) : api.updateTarget(t, { cluster: "", role: roleOfAutoGroup(key.slice(2)) || t.role })} />
            : <Organogram targets={targets} links={links} authors={data.authors} photos={data.authorPhotos} photoUrl={data.getIntelFileUrl} selectedId={selected} onSelect={(t) => setSelected(t.id)}
                onReparent={(t, parentId) => api.updateTarget(t, { parentId })} onOpen={(t) => setFicha(authorOf(t) || null)} />}
          {orgView === "quadro" && targets.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] font-semibold text-pm-muted">
              <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-6 bg-[#C0201A]" />▶ comanda / hierarquia</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-6 border-t-2 border-dashed border-[#2E6B3A]" />vínculo (parente, namoro, fornecedor…)</span>
              <span className="inline-flex items-center gap-1.5"><span className="grid h-4 w-4 place-items-center rounded-full bg-[#9B8A5C] text-[9px] text-white">2</span>indícios da função</span>
              <span className="inline-flex items-center gap-1.5 text-[#2F5D7C]">◉ área de atuação</span>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-pm-muted">
            {TARGET_ROLES.map((r) => <span key={r} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: ROLE_COLOR[r] }} />{r}</span>)}
          </div>
        </CardContent>
      </Card>

      {api.items.some((i) => i.investigationId === inv.id && i.authorIds.length) && (
        <Card>
          <CardContent>
            <SectionHeader icon={Link2} title="Alvos × ocorrências" subtitle="Em quais BOs e fontes cada alvo aparece. Para ligar um alvo a uma fonte, edite a fonte e marque os alvos citados." />
            <LinkChart targets={targets} items={api.items.filter((i) => i.investigationId === inv.id)} authors={data.authors} />
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardContent>
            <SectionHeader icon={Users} title="Alvos do dossiê" subtitle="Papel no grupo, superior hierárquico e observações desta investigação." />
            <div className="grid gap-2">
              {targets.map((t) => {
                const a = authorOf(t);
                const photo = t.authorId ? data.authorPhotos.find((p) => p.authorId === t.authorId) : undefined;
                return (
                  <div key={t.id} className={`grid gap-3 rounded-sm border bg-white p-3 md:grid-cols-[56px_minmax(0,1fr)_150px_180px_auto] md:items-center ${selected === t.id ? "border-pm-black ring-2 ring-pm-gold" : "border-pm-line"}`} onClick={() => setSelected(t.id)}>
                    <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-sm bg-pm-sand">{photo ? <img src={data.getIntelFileUrl(photo.filePath)} alt="" className="h-full w-full object-cover" /> : <Users className="h-5 w-5 text-pm-muted" />}</div>
                    <div className="min-w-0">
                      {a ? <p className="break-words font-black uppercase leading-tight">{a.name}{groupStatus(t) && <span className="ml-2 rounded-sm bg-pm-black px-1.5 py-0.5 text-[10px] text-pm-gold-light">{groupStatus(t)}</span>}</p>
                        : <div className="grid gap-1"><Input className="h-8 w-full font-black uppercase" defaultValue={t.label} key={t.label} onBlur={(e) => e.target.value.trim() && e.target.value.toUpperCase() !== t.label && api.updateTarget(t, { label: e.target.value.toUpperCase() })} /><Button size="sm" variant="gold" onClick={(e) => { e.stopPropagation(); setIdentify(t); }}>Identificar no banco</Button></div>}
                      <p className="truncate text-xs text-pm-muted">{a ? <>{a.alias ? `"${a.alias}" · ` : ""}{a.crimes || a.status}</> : "Não identificado — sem card no banco de alvos"}</p>
                      <Input className="mt-1.5 h-8 text-xs" placeholder="Observação nesta investigação" defaultValue={t.notes} onBlur={(e) => e.target.value !== t.notes && api.updateTarget(t, { notes: e.target.value })} />
                    </div>
                    <Field label="Papel"><Select className="h-9" value={t.role} onChange={(e) => api.updateTarget(t, { role: e.target.value })}>{TARGET_ROLES.map((r) => <option key={r}>{r}</option>)}</Select></Field>
                    <Field label="Superior"><Select className="h-9" value={t.parentId} onChange={(e) => api.updateTarget(t, { parentId: e.target.value })}><option value="">— topo —</option>{targets.filter((x) => x.id !== t.id).map((x) => <option key={x.id} value={x.id}>{nameOf(x.id)}</option>)}</Select></Field>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" title="Indícios da função e área de atuação" onClick={(e) => { e.stopPropagation(); setEvidenceOf(t); }}><Binoculars /></Button>
                      <Button size="icon" variant="ghost" title="Ver ficha completa" disabled={!a} onClick={(e) => { e.stopPropagation(); setFicha(a || null); }}><UserRound /></Button>
                      <Button size="icon" variant="ghost" title="Desvincular" onClick={() => api.removeTarget(t)}><Trash2 /></Button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] md:col-span-full md:col-start-2" onClick={(e) => e.stopPropagation()}>
                      <Field label="Núcleo"><Select className="h-9" value={t.cluster} onChange={(e) => api.updateTarget(t, { cluster: e.target.value })}>{clusterOptions(t).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
                      <Field label="Área de atuação"><div className="relative"><MapPin className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-pm-muted" /><Input className="h-9 pl-8 uppercase" placeholder="bairro / ponto" defaultValue={t.area} key={t.area} onBlur={(e) => e.target.value.toUpperCase() !== t.area && api.updateTarget(t, { area: e.target.value.toUpperCase() })} /></div></Field>
                      <button type="button" onClick={() => setEvidenceOf(t)} className="self-end rounded-sm border border-pm-line px-3 py-2 text-xs font-bold hover:border-pm-gold">{t.evidence.length ? `${t.evidence.length} indício(s)` : "+ indício"}</button>
                    </div>
                  </div>
                );
              })}
              {targets.length === 0 && <p className="text-sm text-pm-muted">Nenhum alvo vinculado.</p>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardContent>
              <SectionHeader icon={UserPlus} title="Vincular alvo" />
              <div className="grid gap-2">
                <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-pm-muted" />
                  <Input className="pl-9" placeholder="Buscar: nome, vulgo, RG/CPF, bairro…" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
                </div>
                {search.trim() && (
                  <div className="max-h-72 space-y-1 overflow-auto">
                    {candidates.length === 0 && <p className="px-1 text-sm text-pm-muted">Nenhum alvo encontrado. Cadastre abaixo.</p>}
                    {candidates.map((a) => row(a))}
                  </div>
                )}
                {!search.trim() && suggestions.length > 0 && (
                  <div>
                    <p className="pm-label">Sugeridos — estiveram no mesmo BO que alvos do dossiê</p>
                    <div className="max-h-72 space-y-1 overflow-auto">
                      {suggestions.map((s) => row(s.author, <p className={`truncate ${s.arrested ? "font-semibold text-status-late" : "text-pm-gold-dark"}`}>{s.arrested ? "Preso junto" : "Junto"} com {s.with.join(", ")} ({s.times}×)</p>))}
                    </div>
                  </div>
                )}
                {!search.trim() && !suggestions.length && <p className="px-1 text-xs text-pm-muted">Digite para buscar no banco de alvos. Clique nos alvos para marcar vários, ou no + para vincular na hora.</p>}
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Papel"><Select value={role} onChange={(e) => setRole(e.target.value)}>{TARGET_ROLES.map((r) => <option key={r}>{r}</option>)}</Select></Field>
                  <Field label="Superior"><Select value={parentId} onChange={(e) => setParentId(e.target.value)}><option value="">— topo —</option>{targets.map((x) => <option key={x.id} value={x.id}>{nameOf(x.id)}</option>)}</Select></Field>
                </div>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="h-4 w-4 accent-[#7A6C45]" checked={autoLink} onChange={(e) => setAutoLink(e.target.checked)} />Ligar no organograma a quem esteve no mesmo BO</label>
                <Button variant="primary" disabled={!picked.length || adding} onClick={() => add()}>{adding ? <Loader2 className="animate-spin" /> : <Plus />}{picked.length > 1 ? `Vincular ${picked.length} alvos` : "Vincular ao dossiê"}</Button>
                <Button onClick={() => setNewOpen(true)}><UserPlus />Cadastrar alvo novo</Button>
                <Button onClick={() => setBoOpen(true)}><ScanText />Cadastrar alvos pelo BO</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <SectionHeader icon={Link2} title="Vínculos" subtitle="Relações fora da hierarquia (parentesco, fornecedor, comprador…). Dica: no organograma, escolha “cria vínculo” e arraste um alvo sobre o outro." />
              {targets.length < 2 ? <p className="text-sm text-pm-muted">Vincule ao menos dois alvos.</p> : (
                <div className="grid gap-2">
                  <Select value={link.from} onChange={(e) => setLink({ ...link, from: e.target.value })}><option value="">Alvo…</option>{targets.map((x) => <option key={x.id} value={x.id}>{nameOf(x.id)}</option>)}</Select>
                  <Select value={link.relation} onChange={(e) => setLink({ ...link, relation: e.target.value })}>{RELATIONS.map((r) => <option key={r}>{r}</option>)}</Select>
                  <Select value={link.to} onChange={(e) => setLink({ ...link, to: e.target.value })}><option value="">…de / com o alvo</option>{targets.filter((x) => x.id !== link.from).map((x) => <option key={x.id} value={x.id}>{nameOf(x.id)}</option>)}</Select>
                  <Input placeholder="Observação (opcional)" value={link.notes} onChange={(e) => setLink({ ...link, notes: e.target.value })} />
                  <Button variant="primary" onClick={async () => { if (await api.addLink(inv, link.from, link.to, link.relation, link.notes)) setLink({ from: "", to: "", relation: link.relation, notes: "" }); }}><Plus />Registrar vínculo</Button>
                </div>
              )}
              <div className="mt-3 divide-y divide-pm-line">
                {links.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1"><b>{nameOf(l.fromTarget)}</b> <span className="text-pm-gold-dark">— {l.relation.toLowerCase()} —</span> <b>{nameOf(l.toTarget)}</b>{l.notes && <span className="block text-xs text-pm-muted">{l.notes}</span>}</span>
                    <Button size="icon" variant="ghost" onClick={() => api.deleteLink(l)}><Trash2 /></Button>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-pm-line pt-3">
                <p className="pm-label mb-1">Telefones e veículos em comum</p>
                <SharedContactsPanel data={data} api={api} inv={inv} targets={targets} links={links} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {targets.length > 0 && (
        <Card>
          <CardContent>
            <SectionHeader icon={History} title="Linha do tempo do grupo" subtitle="Quem entrou, saiu, foi preso e quem assumiu a função de quem. Mudanças de função, superior e núcleo feitas no organograma entram sozinhas; BOs e indícios também." />
            <GroupTimeline data={data} api={api} inv={inv} targets={targets} />
          </CardContent>
        </Card>
      )}
      <BoAuthorModal open={boOpen} data={data} api={api} investigationId={inv.id} onClose={() => setBoOpen(false)} />
      <LinkDropModal pair={linkPair} onClose={() => setLinkPair(null)} data={data} api={api} inv={inv} targets={targets} />
      <UnknownModal open={unknownOpen || Boolean(identify)} identify={identify} onClose={() => { setUnknownOpen(false); setIdentify(null); }} data={data} api={api} inv={inv} targets={targets} />
      <GroupsModal open={groupsOpen} onClose={() => setGroupsOpen(false)} data={data} api={api} inv={inv} targets={targets} />
      <EvidenceModal target={evidenceOf} onClose={() => setEvidenceOf(null)} data={data} api={api} inv={inv} />
      <HierarchyModal open={hierOpen} onClose={() => setHierOpen(false)} data={data} api={api} inv={inv} targets={targets} />
      <CompareModal open={compareOpen} onClose={() => setCompareOpen(false)} data={data} api={api} inv={inv} targets={targets} onOpenAuthor={(id) => setFicha(data.authors.find((x) => x.id === id) || null)} />
      <TargetFichaModal author={ficha} data={data} api={api} onClose={() => setFicha(null)} onShareMessage={(x) => setSharing(x)} onOpenAuthor={(x) => setFicha(x)} />
      <ShareTargetModal author={sharing} data={data} onClose={() => setSharing(null)} />
      <DossieModal open={dossieOpen} onClose={() => setDossieOpen(false)} data={data} api={api} inv={inv} targets={targets} links={links} />
      <NewTargetModal open={newOpen} data={data} targets={targets} nameOf={nameOf} onClose={() => setNewOpen(false)}
        onSave={async (form, r, p) => { const t = await api.createAndAddTarget(inv, form, r, p); if (t) { setNewOpen(false); setSelected(t.id); } }} />
    </div>
  );
}

function NewTargetModal({ open, data, targets, nameOf, onClose, onSave }: { open: boolean; data: AppData; targets: InvestigationTarget[]; nameOf: (id: string) => string; onClose: () => void; onSave: (form: any, role: string, parent: string) => void }) {
  const empty = { name: "", alias: "", motherName: "", birthDate: "", document: "", address: "", neighborhood: "", city: "Belo Horizonte", crimes: "", categoryId: data.authorCategories[0]?.id || "", status: "Suspeito", riskLevel: "Médio", notes: "" };
  const [form, setForm] = useState(empty);
  const [role, setRole] = useState("Associado");
  const [parent, setParent] = useState("");
  useEffect(() => { if (open) { setForm(empty); setRole("Associado"); setParent(""); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Modal open={open} onClose={onClose} eyebrow="Novo card no banco de alvos" title="Cadastrar e vincular alvo"
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={() => onSave(form, role, parent)}><Plus />Cadastrar e vincular</Button></>}>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Nome completo" className="md:col-span-2"><Input autoFocus value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Vulgo"><Input value={form.alias} onChange={(e) => set("alias", e.target.value)} /></Field>
        <Field label="Papel no grupo"><Select value={role} onChange={(e) => setRole(e.target.value)}>{TARGET_ROLES.map((r) => <option key={r}>{r}</option>)}</Select></Field>
        <Field label="Superior"><Select value={parent} onChange={(e) => setParent(e.target.value)}><option value="">— topo —</option>{targets.map((x) => <option key={x.id} value={x.id}>{nameOf(x.id)}</option>)}</Select></Field>
        <Field label="Pasta"><Select value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}><option value="">Sem pasta</option>{data.authorCategories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</Select></Field>
        <Field label="Nome da mãe"><Input value={form.motherName} onChange={(e) => set("motherName", e.target.value)} /></Field>
        <Field label="Nascimento"><Input type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} /></Field>
        <Field label="RG / CPF"><Input value={form.document} onChange={(e) => set("document", e.target.value)} /></Field>
        <Field label="Endereço" className="md:col-span-2"><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="Bairro"><Input value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} /></Field>
        <Field label="Crimes / modus operandi" className="md:col-span-3"><Input value={form.crimes} onChange={(e) => set("crimes", e.target.value)} /></Field>
        <Field label="Observações" className="md:col-span-3"><Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        <p className="text-xs text-pm-muted md:col-span-3">Foto: depois de cadastrar, envie pela tela Banco de alvos — ela aparece no organograma e nos relatórios.</p>
      </div>
    </Modal>
  );
}

// ---------- Cronologia ----------
function TimelineTab({ inv, items }: { inv: Investigation; items: InvestigationItem[] }) {
  const events = [
    ...items.filter((i) => i.itemDate).map((i) => ({ date: i.itemDate, title: i.title, kind: i.kind, text: i.summary, rating: ratingLabel(i.sourceRating, i.infoRating), control: false })),
    { date: inv.openedAt, title: "Investigação aberta", kind: "Controle", text: inv.origin, rating: "", control: true },
    ...STAGES.filter((s) => inv.stages[s.key]?.completedAt).map((s) => ({ date: inv.stages[s.key]!.completedAt!.slice(0, 10), title: `Etapa concluída: ${s.name}`, kind: "Controle", text: "", rating: "", control: true })),
  ].filter((e) => e.date).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <Card>
      <CardContent>
        <SectionHeader icon={History} title="Cronologia" subtitle="Fatos datados das fontes e marcos da investigação." />
        {events.length === 0 && <EmptyState icon={History} title="Sem eventos datados">Informe a data nas fontes para montar a linha do tempo.</EmptyState>}
        <ol className="relative ml-3 border-l-2 border-pm-line">
          {events.map((e, i) => (
            <li key={i} className="relative pb-5 pl-6">
              <span className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 ${e.control ? "border-pm-line bg-pm-cream" : "border-pm-black bg-pm-gold"}`} />
              <p className="text-xs font-black tracking-wider text-pm-gold-dark">{formatBR(e.date)} · {e.kind.toUpperCase()}{e.rating && ` · ${e.rating}`}</p>
              <p className={`font-bold ${e.control ? "text-pm-muted" : ""}`}>{e.title}</p>
              {e.text && <p className="mt-0.5 line-clamp-3 text-sm text-pm-ink">{e.text}</p>}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ---------- Análise e conclusão ----------
function AnalysisTab({ api, inv }: { api: InvestigationsApi; inv: Investigation }) {
  const pick = (i: Investigation) => ({ analysis: i.analysis, conclusion: i.conclusion, recommendations: i.recommendations });
  const [form, setForm] = useState(() => pick(inv));
  useEffect(() => setForm(pick(inv)), [inv.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(form) !== JSON.stringify(pick(inv));
  return (
    <Card>
      <CardContent>
        <SectionHeader icon={Edit3} title="Análise e conclusão" subtitle="Texto do analista. Separe parágrafos com uma linha em branco."
          actions={<Button variant="primary" disabled={!dirty} onClick={() => api.updateInvestigation(inv, form)}><Save />Salvar</Button>} />
        <div className="grid gap-3">
          <Field label="Análise (integração e interpretação dos dados)"><Textarea rows={10} value={form.analysis} onChange={(e) => setForm({ ...form, analysis: e.target.value })} /></Field>
          <Field label="Conclusão"><Textarea rows={5} value={form.conclusion} onChange={(e) => setForm({ ...form, conclusion: e.target.value })} /></Field>
          <Field label="Recomendações (uma por linha)" hint="Viram alíneas a), b), c)… no relatório."><Textarea rows={5} value={form.recommendations} onChange={(e) => setForm({ ...form, recommendations: e.target.value })} /></Field>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Relatório ----------
function ReportTab({ inv, items, targets, links, generating, onGenerate, onTab }: {
  inv: Investigation; items: InvestigationItem[]; targets: InvestigationTarget[]; links: unknown[]; generating: string; onGenerate: (f: "pdf" | "pptx") => void; onTab: (t: Tab) => void;
}) {
  const checks: [boolean, string, Tab][] = [
    [Boolean(inv.objective), "Objetivo preenchido", "dossie"], [Boolean(inv.summary), "Síntese dos fatos", "dossie"], [items.length > 0, `Fontes registradas (${items.length})`, "fontes"],
    [items.some((i) => i.sourceRating && i.infoRating), "Fontes avaliadas (idoneidade/veracidade)", "fontes"], [targets.length > 0, `Alvos vinculados (${targets.length})`, "alvos"],
    [targets.some((t) => t.parentId) || links.length > 0, "Hierarquia ou vínculos definidos", "alvos"], [Boolean(inv.analysis), "Análise redigida", "analise"], [Boolean(inv.conclusion), "Conclusão redigida", "analise"],
  ];
  const ok = checks.filter(([v]) => v).length;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardContent>
          <SectionHeader icon={Download} title="Gerar relatório de inteligência" subtitle={`${ok}/${checks.length} itens prontos. Dá para gerar a qualquer momento — o que estiver vazio fica de fora.`} />
          <div className="grid gap-3 md:grid-cols-2">
            <button type="button" onClick={() => onGenerate("pdf")} disabled={Boolean(generating)} className="group rounded-sm border border-pm-line bg-white p-5 text-left transition hover:border-pm-gold disabled:opacity-60">
              {generating === "pdf" ? <Loader2 className="h-8 w-8 animate-spin text-pm-gold-dark" /> : <FileText className="h-8 w-8 text-pm-gold-dark" />}
              <p className="pm-heading mt-3">PDF — padrão ABNT</p>
              <p className="mt-1 text-sm text-pm-muted">Capa no modelo PMMG, folha de rosto, sumário, seções numeradas, quadros, organograma, referências (NBR 6023) e paginação. Grau de sigilo no topo e no rodapé de cada página.</p>
            </button>
            <button type="button" onClick={() => onGenerate("pptx")} disabled={Boolean(generating)} className="group rounded-sm border border-pm-line bg-white p-5 text-left transition hover:border-pm-gold disabled:opacity-60">
              {generating === "pptx" ? <Loader2 className="h-8 w-8 animate-spin text-pm-gold-dark" /> : <Presentation className="h-8 w-8 text-pm-gold-dark" />}
              <p className="pm-heading mt-3">PPTX — apresentação PMMG</p>
              <p className="mt-1 text-sm text-pm-muted">Slides no modelo da Apresentação Padrão: capa, roteiro, síntese, um slide por alvo com foto, organograma, vínculos, fontes, linha do tempo, análise e recomendações.</p>
            </button>
          </div>
          <p className="mt-4 text-xs text-pm-muted">Estrutura do PDF: A4, margens 3 cm (superior/esquerda) e 2 cm (inferior/direita), fonte 12 com espaçamento 1,5, recuo de 1,25 cm, seções primárias em página própria, legendas acima e fontes abaixo das ilustrações (NBR 14724 / NBR 10719). O PPTX usa as fontes Rawline do modelo; sem elas instaladas, o PowerPoint usa uma fonte parecida.</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <p className="pm-heading mb-3">Conferência</p>
          <ul className="space-y-1.5">
            {checks.map(([v, label, t]) => (
              <li key={label}><button type="button" onClick={() => onTab(t)} className="flex w-full items-center gap-2 text-left text-sm hover:text-pm-gold-dark">
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-sm ${v ? "bg-status-done text-white" : "border border-pm-line bg-white"}`}>{v && <Check className="h-3.5 w-3.5" />}</span>
                <span className={v ? "" : "text-pm-muted"}>{label}</span>
              </button></li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
