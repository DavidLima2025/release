import { useEffect, useState } from "react";
import { Check, Paperclip, Plus } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Field, Input, Select, Textarea } from "./ui/input";
import { AppUser, DEFAULT_CHECKLIST, MANUAL_STATUSES, PRIORITIES, TASK_TYPES, Task, Workflow } from "../lib/domain";
import { addDays, formatBR, weekdayLabel } from "../lib/dates";
import type { TaskInput } from "../hooks/useAppData";

type Props = {
  open: boolean;
  task?: Task | null;
  initialDate: string;
  users: AppUser[];
  workflows: Workflow[];
  currentUserId?: string;
  onClose: () => void;
  onSubmit: (values: TaskInput, file?: File | null) => Promise<boolean>;
};

function emptyForm(date: string, workflows: Workflow[], currentUserId?: string, users: AppUser[] = []): TaskInput & { checklistText: string } {
  const me = users.find((u) => u.id === currentUserId && u.status === "Ativo");
  return {
    title: "", responsibleId: me?.id || "", date, type: "Inteligência", priority: "Média", notes: "",
    overdueDate: addDays(date, 3), officialDeadline: "", recurrence: "none", recurrenceCount: 4,
    workflowId: workflows[0]?.id || "", status: "A fazer", checklistText: DEFAULT_CHECKLIST.join("\n"),
  };
}

export function TaskFormModal({ open, task, initialDate, users, workflows, currentUserId, onClose, onSubmit }: Props) {
  const editing = Boolean(task);
  const [form, setForm] = useState(() => emptyForm(initialDate, workflows, currentUserId, users));
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    if (task) {
      setForm({
        title: task.title, responsibleId: task.responsibleId, date: task.date, type: task.type, priority: task.priority,
        notes: task.notes, overdueDate: task.overdueDate, officialDeadline: task.officialDeadline, recurrence: "none", recurrenceCount: 1,
        workflowId: task.workflowId, status: MANUAL_STATUSES.includes(task.storedStatus as any) ? task.storedStatus : "A fazer",
        checklistText: task.checklist.join("\n"),
      });
    } else {
      setForm(emptyForm(initialDate, workflows, currentUserId, users));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id, initialDate]);

  const set = (key: string, value: any) => setForm((current) => ({ ...current, [key]: value }));
  const activeUsers = users.filter((u) => u.status === "Ativo" || u.id === form.responsibleId);
  const types = TASK_TYPES.includes(form.type || "") ? TASK_TYPES : [...TASK_TYPES, form.type || ""];

  const submit = async () => {
    setSaving(true);
    const checklist = form.checklistText.split("\n").map((line) => line.trim()).filter(Boolean);
    const ok = await onSubmit({ ...form, checklist: checklist.length ? checklist : DEFAULT_CHECKLIST }, file);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={editing ? "Editar demanda" : `${weekdayLabel(form.date)} · ${formatBR(form.date)}`}
      title={editing ? task!.title : "Nova demanda"}
      footer={<>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" onClick={submit} disabled={saving}>{editing ? <Check /> : <Plus />}{saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar demanda"}</Button>
      </>}
    >
      <form className="grid gap-4 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label="Título da demanda" className="md:col-span-2">
          <Input autoFocus value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Levantamento de alvos — furtos na Praça Sete" />
        </Field>
        <Field label="Responsável">
          <Select value={form.responsibleId} onChange={(e) => set("responsibleId", e.target.value)}>
            <option value="">Selecione…</option>
            {activeUsers.map((u) => <option key={u.id} value={u.id}>{u.warName || u.name}{u.status !== "Ativo" ? " (inativo)" : ""}</option>)}
          </Select>
        </Field>
        <Field label="Etapa do workflow">
          <Select value={form.workflowId} onChange={(e) => set("workflowId", e.target.value)}>
            <option value="">Sem etapa</option>
            {workflows.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </Select>
        </Field>
        <Field label="Tipo">
          <Select value={form.type} onChange={(e) => set("type", e.target.value)}>{types.map((t) => <option key={t}>{t}</option>)}</Select>
        </Field>
        <Field label="Prioridade">
          <Select value={form.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</Select>
        </Field>
        <Field label="Dia no calendário">
          <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required />
        </Field>
        <Field label="Prazo (vira atrasada depois)" hint="Faltando 2 dias, a demanda entra em risco de prazo.">
          <Input type="date" value={form.overdueDate} min={form.date} onChange={(e) => set("overdueDate", e.target.value)} />
        </Field>
        <Field label="Prazo oficial (opcional)">
          <Input type="date" value={form.officialDeadline} onChange={(e) => set("officialDeadline", e.target.value)} />
        </Field>
        {editing ? (
          <Field label="Situação" hint="Atrasada e risco de prazo são calculados pelo prazo.">
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>{MANUAL_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select>
          </Field>
        ) : (
          <div className="grid grid-cols-[1fr_96px] gap-2">
            <Field label="Repetir">
              <Select value={form.recurrence} onChange={(e) => set("recurrence", e.target.value)}>
                <option value="none">Não repetir</option>
                <option value="daily">Todo dia</option>
                <option value="weekdays">Dias úteis</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensal</option>
              </Select>
            </Field>
            <Field label="Vezes">
              <Input type="number" min={1} max={60} value={form.recurrenceCount} disabled={form.recurrence === "none"} onChange={(e) => set("recurrenceCount", Number(e.target.value))} />
            </Field>
          </div>
        )}
        <Field label="Informações da demanda" className="md:col-span-2">
          <Textarea rows={5} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Contexto, fontes, observações…" />
        </Field>
        <Field label="Checklist (um item por linha)" className={editing ? "md:col-span-2" : ""}>
          <Textarea rows={4} value={form.checklistText} onChange={(e) => set("checklistText", e.target.value)} />
        </Field>
        {!editing && (
          <Field label="Anexo (opcional)">
            <label className="flex h-[118px] cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-pm-line bg-white px-3 text-center text-sm text-pm-muted hover:border-pm-gold">
              <Paperclip className="h-5 w-5 text-pm-gold-dark" />
              <span className="font-semibold text-pm-ink">{file ? file.name : "Escolher arquivo"}</span>
              <span className="text-xs">Fica anexado à primeira demanda criada</span>
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </Field>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
