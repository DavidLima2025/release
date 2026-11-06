import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, FileText, Loader2, MapPin, ScanText, Trash2, Upload, Users } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Field, Input, Select } from "./ui/input";
import { Badge } from "./ui/badge";
import { BO_CHECKLIST, PRIORITIES, TASK_TYPES } from "../lib/domain";
import { addDays, formatBR, isValidISODate } from "../lib/dates";
import { Boletim, boletimNotes, boletimTitle, isBoletim, naturezaCurta, parseBoletim } from "../lib/boletim";
import { extractPdfItems } from "../lib/pdf";
import type { AppData } from "../hooks/useAppData";

type DateSource = "registro" | "fato" | "selecionado";

type Item = {
  key: string;
  file: File;
  state: "reading" | "ready" | "error";
  error?: string;
  bo?: Boletim;
  title: string;
  date: string;
  dateTouched: boolean;
  include: boolean;
  duplicate: boolean;
  open: boolean;
};

type Props = { open: boolean; selectedDate: string; data: AppData; onClose: () => void; onCreated?: (date: string) => void };

function pickDate(bo: Boletim | undefined, source: DateSource, selectedDate: string) {
  if (source === "selecionado" || !bo) return selectedDate;
  if (source === "fato") return bo.dataFato || bo.dataRegistro || selectedDate;
  return bo.dataRegistro || bo.dataFato || selectedDate;
}

export function BoImportModal({ open, selectedDate, data, onClose, onCreated }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [dateSource, setDateSource] = useState<DateSource>("registro");
  const [responsibleId, setResponsibleId] = useState("");
  const [type, setType] = useState("Análise de BO");
  const [priority, setPriority] = useState("Média");
  const [deadlineDays, setDeadlineDays] = useState(3);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setItems([]);
    setSaving(false);
    const me = data.users.find((u) => u.id === data.currentUser?.id && u.status === "Ativo");
    setResponsibleId(me?.id || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Trocar a origem da data atualiza as linhas que a pessoa ainda não editou à mão.
  useEffect(() => {
    setItems((list) => list.map((item) => (item.dateTouched ? item : { ...item, date: pickDate(item.bo, dateSource, selectedDate) })));
  }, [dateSource, selectedDate]);

  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));

  async function addFiles(fileList: FileList | File[] | null) {
    const files = Array.from(fileList || []).filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (!files.length) return;
    const fresh: Item[] = files.map((file, i) => ({
      key: `${Date.now()}-${i}-${file.name}`, file, state: "reading", title: file.name.replace(/\.pdf$/i, ""),
      date: selectedDate, dateTouched: false, include: true, duplicate: false, open: files.length === 1,
    }));
    setItems((list) => [...list, ...fresh]);
    for (const item of fresh) {
      try {
        const bo = parseBoletim(await extractPdfItems(item.file));
        if (!isBoletim(bo)) {
          update(item.key, { state: "error", include: false, error: "Não parece um BO do REDS/SIDS (sem nº, natureza ou histórico). Confira se o PDF tem texto selecionável." });
          continue;
        }
        const duplicate = Boolean(bo.numero) && data.tasks.some((task) => task.title.includes(bo.numero) || task.notes.includes(`REDS: ${bo.numero}`));
        update(item.key, { state: "ready", bo, title: boletimTitle(bo), date: pickDate(bo, dateSource, selectedDate), duplicate, include: !duplicate });
      } catch (error) {
        console.error(error);
        update(item.key, { state: "error", include: false, error: "Não foi possível ler este PDF (arquivo protegido ou corrompido?)." });
      }
    }
  }

  const ready = items.filter((item) => item.state === "ready" && item.include && isValidISODate(item.date) && item.title.trim());
  const reading = items.some((item) => item.state === "reading");

  async function create() {
    if (!responsibleId) { window.alert("Selecione o responsável pelas demandas."); return; }
    setSaving(true);
    let created = 0;
    for (const item of ready) {
      const result = await data.createTasks({
        title: item.title, responsibleId, date: item.date, type, priority,
        // BO antigo não nasce atrasado: o prazo conta a partir de hoje ou do dia da demanda, o que for depois.
        overdueDate: addDays(item.date > data.today ? item.date : data.today, Math.max(0, Number(deadlineDays) || 0)),
        notes: boletimNotes(item.bo!), checklist: BO_CHECKLIST, workflowId: data.workflows[0]?.id,
      }, { silent: true });
      const id = result?.[0]?.id;
      if (id) {
        created += 1;
        await data.uploadDemandFile({ id, title: item.title }, item.file, true);
      }
    }
    setSaving(false);
    if (created) {
      const firstDate = ready[0]?.date;
      data.reload();
      onCreated?.(firstDate);
      onClose();
    }
  }

  const activeUsers = data.users.filter((u) => u.status === "Ativo");

  return (
    <Modal open={open} onClose={onClose} size="xl" eyebrow="Importar boletim de ocorrência" title="Ler PDF e criar demanda"
      footer={<>
        <span className="mr-auto self-center text-xs text-pm-muted">O PDF original fica anexado à demanda criada.</span>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!ready.length || reading || saving} onClick={create}>
          {saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
          {saving ? "Criando…" : ready.length > 1 ? `Criar ${ready.length} demandas` : "Criar demanda"}
        </Button>
      </>}>
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed px-4 py-8 text-center transition ${dragging ? "border-pm-gold bg-pm-gold/10" : "border-pm-line bg-white hover:border-pm-gold"}`}>
            <ScanText className="h-8 w-8 text-pm-gold-dark" />
            <p className="text-sm font-black uppercase tracking-wide text-pm-black">Arraste os PDFs aqui</p>
            <p className="text-xs text-pm-muted">ou clique para escolher · aceita vários BOs de uma vez</p>
            <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </div>

          <Field label="Criar a demanda no dia">
            <Select value={dateSource} onChange={(e) => setDateSource(e.target.value as DateSource)}>
              <option value="registro">Data do registro do BO</option>
              <option value="fato">Data do fato</option>
              <option value="selecionado">Dia selecionado no calendário ({formatBR(selectedDate)})</option>
            </Select>
          </Field>
          <Field label="Responsável">
            <Select value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
              <option value="">Selecione…</option>
              {activeUsers.map((u) => <option key={u.id} value={u.id}>{u.warName || u.name}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo"><Select value={type} onChange={(e) => setType(e.target.value)}>{TASK_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
            <Field label="Prioridade"><Select value={priority} onChange={(e) => setPriority(e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</Select></Field>
          </div>
          <Field label="Prazo para análise (dias)" hint="Contado a partir de hoje (ou do dia da demanda, se for futuro).">
            <Input type="number" min={0} max={90} value={deadlineDays} onChange={(e) => setDeadlineDays(Number(e.target.value))} />
          </Field>
        </div>

        <div className="space-y-3">
          {items.length === 0 && (
            <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-sm border border-pm-line bg-white/60 p-8 text-center text-sm text-pm-muted">
              <FileText className="mb-3 h-10 w-10 text-pm-gold" />
              <p className="max-w-sm">O sistema lê o nº do REDS, natureza, data/hora, local, envolvidos, materiais, guarnição e o histórico, e monta a demanda automaticamente.</p>
            </div>
          )}
          {items.map((item) => (
            <div key={item.key} className={`rounded-sm border bg-white ${item.state === "error" ? "border-status-late/40" : item.include ? "border-pm-gold" : "border-pm-line opacity-80"}`}>
              <div className="flex items-start gap-3 p-3">
                <div className="pt-2">
                  {item.state === "reading" && <Loader2 className="h-5 w-5 animate-spin text-pm-gold-dark" />}
                  {item.state === "error" && <AlertTriangle className="h-5 w-5 text-status-late" />}
                  {item.state === "ready" && <input type="checkbox" className="h-5 w-5 accent-[#7A6C45]" checked={item.include} onChange={(e) => update(item.key, { include: e.target.checked })} title="Incluir" />}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="truncate text-xs font-semibold text-pm-muted">{item.file.name}</p>
                  {item.state === "reading" && <p className="text-sm">Lendo o PDF…</p>}
                  {item.state === "error" && <p className="text-sm text-status-late">{item.error}</p>}
                  {item.state === "ready" && item.bo && (
                    <>
                      <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
                        <Input value={item.title} onChange={(e) => update(item.key, { title: e.target.value })} aria-label="Título da demanda" />
                        <Input type="date" value={item.date} onChange={(e) => update(item.key, { date: e.target.value, dateTouched: true })} aria-label="Dia da demanda" />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        {item.duplicate && <Badge tone="late">Já importado antes</Badge>}
                        {item.bo.natureza && <Badge tone="dark">{naturezaCurta(item.bo.natureza)}</Badge>}
                        {item.bo.tentadoConsumado && <Badge>{item.bo.tentadoConsumado}</Badge>}
                        {item.bo.dataFato && <Badge tone="gold">Fato {formatBR(item.bo.dataFato)} {item.bo.horaFato}</Badge>}
                        {item.bo.local.bairro && <span className="inline-flex items-center gap-1 text-pm-muted"><MapPin className="h-3 w-3" />{[item.bo.local.logradouro, item.bo.local.numero].filter(Boolean).join(", ")} · {item.bo.local.bairro}</span>}
                        {item.bo.envolvidos.length > 0 && <span className="inline-flex items-center gap-1 text-pm-muted"><Users className="h-3 w-3" />{item.bo.envolvidos.length} envolvido(s)</span>}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {item.state === "ready" && <Button size="icon" variant="ghost" title="Ver dados lidos" onClick={() => update(item.key, { open: !item.open })}><ChevronDown className={item.open ? "rotate-180" : ""} /></Button>}
                  <Button size="icon" variant="ghost" title="Remover" onClick={() => setItems((list) => list.filter((i) => i.key !== item.key))}><Trash2 /></Button>
                </div>
              </div>
              {item.open && item.bo && (
                <div className="grid gap-4 border-t border-pm-line bg-pm-cream/50 p-4 text-sm md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="pm-label">Envolvidos</p>
                    {item.bo.envolvidos.map((e) => <p key={e.numero}><b>{e.tipo}:</b> {e.nome || "—"}</p>)}
                    {item.bo.materiais.length > 0 && <>
                      <p className="pm-label pt-2">Materiais</p>
                      {item.bo.materiais.map((m, i) => <p key={i}>{m.objeto} {m.quantidade && `(${m.quantidade})`} — {m.situacao}</p>)}
                    </>}
                    {item.bo.militares.length > 0 && <>
                      <p className="pm-label pt-2">Guarnição</p>
                      {item.bo.militares.map((m, i) => <p key={i}>{m.cargo} {m.nome}</p>)}
                    </>}
                  </div>
                  <div>
                    <p className="pm-label">Histórico</p>
                    <p className="max-h-60 overflow-auto whitespace-pre-wrap text-xs leading-relaxed">{item.bo.historico || "Histórico não encontrado no PDF."}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
          {items.length > 0 && (
            <Button size="sm" onClick={() => inputRef.current?.click()}><Upload />Adicionar outro PDF</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
