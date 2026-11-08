import { useEffect, useRef, useState } from "react";
import { BellRing, CheckCircle2, FileText, Gavel, Loader2, Paperclip, ScanText, X } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Field, Input, Select, Textarea } from "./ui/input";
import type { AppData } from "../hooks/useAppData";
import type { Boletim } from "../lib/boletim";
import { formatBR, isValidISODate } from "../lib/dates";
import { AUDIENCIA_ITEMS, AUDIENCIA_TYPE, LEMBRETE_OPCOES, audienciaMarker, reminderDate } from "../lib/audiencia";

type Props = {
  open: boolean;
  data: AppData;
  onClose: () => void;
  /** BO já lido (quando vem da importação de BO). */
  bo?: Boletim | null;
  boFile?: File | null;
  onCreated?: (date: string) => void;
};

const EMPTY = {
  date: "", time: "", local: "", mode: "Presencial", link: "", pa: "", received: "", remindDays: 3,
  items: ["Fotos", "Vídeos", "Observação"] as string[], itemsDetail: "", notes: "", priority: "Alta", responsibleId: "",
};

export function AudienciaModal({ open, data, onClose, bo: initialBo = null, boFile: initialFile = null, onCreated }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [bo, setBo] = useState<Boletim | null>(initialBo);
  const [boFile, setBoFile] = useState<File | null>(initialFile);
  const [requisicao, setRequisicao] = useState<File | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const boRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const me = data.users.find((u) => u.id === data.currentUser?.id && u.status === "Ativo");
    setForm({ ...EMPTY, received: data.today, responsibleId: me?.id || "" });
    setBo(initialBo); setBoFile(initialFile); setRequisicao(null); setError(""); setSaving(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key: keyof typeof EMPTY, value: any) => setForm((f) => ({ ...f, [key]: value }));
  const toggleItem = (item: string) => setForm((f) => ({ ...f, items: f.items.includes(item) ? f.items.filter((i) => i !== item) : [...f.items, item] }));

  async function readBo(file: File) {
    setReading(true);
    try {
      const [{ extractPdfItems }, lib] = await Promise.all([import("../lib/pdf"), import("../lib/boletim")]);
      const parsed = lib.parseBoletim(await extractPdfItems(file));
      if (!lib.isBoletim(parsed)) { window.alert("Não reconheci um BO do REDS neste PDF. Ele será anexado mesmo assim."); setBo(null); }
      else setBo(parsed);
      setBoFile(file);
    } catch {
      window.alert("Não foi possível ler este PDF.");
    } finally { setReading(false); }
  }

  async function save() {
    setError("");
    if (!isValidISODate(form.date)) return setError("Informe a data da audiência.");
    if (!form.responsibleId) return setError("Selecione o responsável.");
    const received = isValidISODate(form.received) ? form.received : data.today;
    const natureza = bo ? (await import("../lib/boletim")).naturezaCurta(bo.natureza) : "";
    const title = ["Audiência", natureza, bo?.numero ? `REDS ${bo.numero}` : form.pa ? (/^p\.?\s?a\b/i.test(form.pa.trim()) ? form.pa.trim() : `P.A. ${form.pa.trim()}`) : ""].filter(Boolean).join(" — ");
    const local = [bo?.local.logradouro, bo?.local.numero].filter(Boolean).join(", ") + (bo?.local.bairro ? ` — ${bo.local.bairro}` : "");
    const notes = [
      audienciaMarker(form.date, form.time, form.remindDays),
      `Audiência: ${formatBR(form.date)}${form.time ? ` às ${form.time}` : ""}`,
      form.local && `Local: ${form.local}`,
      `Modalidade: ${form.mode}${form.mode === "Virtual" && form.link ? ` — ${form.link}` : ""}`,
      form.pa && `P.A. / requisição: ${form.pa}`,
      `Requisição recebida em: ${formatBR(received)}`,
      `Lembrete: ${form.remindDays} dia(s) antes (a partir de ${formatBR(reminderDate(form.date, form.remindDays))})`,
      bo?.numero && `REDS: ${bo.numero}`,
      bo?.natureza && `Natureza: ${bo.natureza}`,
      bo?.dataFato && `Fato: ${formatBR(bo.dataFato)}${bo.horaFato ? ` ${bo.horaFato}` : ""}${local.trim() ? ` — ${local}` : ""}`,
      bo?.envolvidos.length ? `Envolvidos: ${bo.envolvidos.filter((e) => e.nome).map((e) => `${e.nome} (${e.tipo.toLowerCase()})`).join("; ")}` : "",
      form.items.length ? `Itens da ocorrência: ${form.items.join("; ")}` : "",
      form.itemsDetail.trim() && `Detalhes dos itens: ${form.itemsDetail.trim()}`,
      form.notes.trim() && `Observação: ${form.notes.trim()}`,
    ].filter(Boolean).join("\n");
    const checklist = [
      "Conferir a requisição (P.A.)",
      ...form.items.map((i) => (i === "Fotos" ? "Separar as fotos" : i === "Vídeos" ? "Separar os vídeos" : i === "Observação" ? "Revisar observações e o BO" : `Separar: ${i}`)),
      "Comparecer à audiência",
    ];
    setSaving(true);
    const created = await data.createTasks({
      title, responsibleId: form.responsibleId, date: received > form.date ? form.date : received, overdueDate: form.date, officialDeadline: form.date,
      type: AUDIENCIA_TYPE, priority: form.priority, notes, checklist, workflowId: data.workflows[0]?.id,
    }, { silent: true });
    const task = created?.[0];
    if (task) {
      if (boFile) await data.uploadDemandFile(task, boFile, true);
      if (requisicao) await data.uploadDemandFile(task, requisicao, true);
      data.reload();
      setSaving(false);
      onCreated?.(form.date);
      onClose();
      return;
    }
    setSaving(false);
  }

  const activeUsers = data.users.filter((u) => u.status === "Ativo");
  const extraItem = form.items.filter((i) => !AUDIENCIA_ITEMS.includes(i));

  return (
    <Modal open={open} onClose={() => !saving && onClose()} size="lg" eyebrow="Agenda" title={<span className="inline-flex items-center gap-2"><Gavel className="h-5 w-5 text-pm-gold-light" />Cadastrar audiência</span>}
      footer={<>
        {error && <span className="mr-auto self-center text-sm font-semibold text-status-late">{error}</span>}
        <Button onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button variant="primary" onClick={save} disabled={saving || reading}>{saving ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}Salvar audiência</Button>
      </>}>
      <div className="space-y-4">
        {bo || boFile ? (
          <div className="flex flex-wrap items-center gap-2 rounded-sm bg-pm-black px-4 py-3 text-white">
            <FileText className="h-5 w-5 text-pm-gold-light" />
            <span className="font-black">{bo?.numero ? `REDS ${bo.numero}` : boFile?.name}</span>
            {bo?.natureza && <span className="pm-chip bg-pm-gold text-pm-black">{bo.natureza}</span>}
            {bo?.dataFato && <span className="text-sm text-white/70">Fato em {formatBR(bo.dataFato)}</span>}
            {!initialFile && <button type="button" className="ml-auto text-white/70 hover:text-white" onClick={() => { setBo(null); setBoFile(null); }} aria-label="Remover BO"><X className="h-4 w-4" /></button>}
          </div>
        ) : (
          <button type="button" onClick={() => boRef.current?.click()} disabled={reading}
            className="flex w-full items-center gap-3 rounded-sm border-2 border-dashed border-pm-line bg-white px-4 py-3 text-left hover:border-pm-gold">
            {reading ? <Loader2 className="h-6 w-6 animate-spin text-pm-gold-dark" /> : <ScanText className="h-6 w-6 text-pm-gold-dark" />}
            <span><b className="block text-sm uppercase">{reading ? "Lendo o BO…" : "Anexar o BO do fato (opcional)"}</b><span className="text-xs text-pm-muted">Puxa nº do REDS, natureza, data e envolvidos para a audiência.</span></span>
          </button>
        )}
        <input ref={boRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) readBo(f); e.target.value = ""; }} />

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Data da audiência *"><Input type="date" value={form.date} min={data.today} onChange={(e) => set("date", e.target.value)} /></Field>
          <Field label="Horário"><Input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} /></Field>
          <Field label="Lembrar">
            <Select value={form.remindDays} onChange={(e) => set("remindDays", Number(e.target.value))}>
              {LEMBRETE_OPCOES.map((d) => <option key={d} value={d}>{d} dia(s) antes</option>)}
            </Select>
          </Field>
          <Field label="Local (fórum, vara, sala)" className="sm:col-span-2"><Input value={form.local} onChange={(e) => set("local", e.target.value)} placeholder="Ex.: Fórum Lafayette — 2ª Vara Criminal" /></Field>
          <Field label="Modalidade">
            <Select value={form.mode} onChange={(e) => set("mode", e.target.value)}><option>Presencial</option><option>Virtual</option></Select>
          </Field>
          {form.mode === "Virtual" && <Field label="Link da sala virtual" className="sm:col-span-3"><Input value={form.link} onChange={(e) => set("link", e.target.value)} placeholder="https://…" /></Field>}
          <Field label="Nº do P.A. / requisição"><Input value={form.pa} onChange={(e) => set("pa", e.target.value)} placeholder="Ex.: PA 123/2026" /></Field>
          <Field label="Requisição recebida em"><Input type="date" value={form.received} onChange={(e) => set("received", e.target.value)} /></Field>
          <Field label="Anexar requisição">
            <label className="pm-field flex cursor-pointer items-center gap-2 truncate text-sm">
              <Paperclip className="h-4 w-4 shrink-0 text-pm-gold-dark" /><span className="truncate">{requisicao ? requisicao.name : "PDF ou foto"}</span>
              <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { setRequisicao(e.target.files?.[0] || null); e.target.value = ""; }} />
            </label>
          </Field>
        </div>

        <div className="rounded-sm border border-pm-line bg-white p-3">
          <p className="pm-label">Itens da ocorrência para lembrar</p>
          <div className="flex flex-wrap gap-2">
            {[...AUDIENCIA_ITEMS, ...extraItem].map((item) => (
              <label key={item} className={`flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-1.5 text-sm font-semibold ${form.items.includes(item) ? "border-pm-gold bg-pm-gold/15" : "border-pm-line"}`}>
                <input type="checkbox" className="h-4 w-4 accent-[#7A6C45]" checked={form.items.includes(item)} onChange={() => toggleItem(item)} />{item}
              </label>
            ))}
            <Input className="h-9 w-48 text-sm" placeholder="+ outro item (Enter)" onKeyDown={(e) => {
              const v = (e.target as HTMLInputElement).value.trim();
              if (e.key === "Enter" && v) { e.preventDefault(); if (!form.items.includes(v)) set("items", [...form.items, v]); (e.target as HTMLInputElement).value = ""; }
            }} />
          </div>
          <Field label="Detalhes dos itens" className="mt-3"><Textarea rows={2} value={form.itemsDetail} onChange={(e) => set("itemsDetail", e.target.value)} placeholder="Ex.: fotos do material apreendido no celular funcional; vídeo da câmera da loja (pen drive)" /></Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_200px_160px]">
          <Field label="Observação"><Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="O que lembrar no dia: testemunhas, fardamento, documentos…" /></Field>
          <Field label="Responsável"><Select value={form.responsibleId} onChange={(e) => set("responsibleId", e.target.value)}><option value="">Selecione…</option>{activeUsers.map((u) => <option key={u.id} value={u.id}>{u.warName || u.name}</option>)}</Select></Field>
          <Field label="Prioridade"><Select value={form.priority} onChange={(e) => set("priority", e.target.value)}>{["Média", "Alta", "Crítica"].map((p) => <option key={p}>{p}</option>)}</Select></Field>
        </div>
        {isValidISODate(form.date) && (
          <p className="flex items-center gap-2 rounded-sm bg-pm-gold/15 px-3 py-2 text-sm"><BellRing className="h-4 w-4 text-pm-gold-dark" />
            A demanda fica no dia {formatBR(isValidISODate(form.received) ? form.received : data.today)} com vencimento em {formatBR(form.date)}. O aviso aparece no topo do sistema a partir de {formatBR(reminderDate(form.date, form.remindDays))}.
          </p>
        )}
      </div>
    </Modal>
  );
}
