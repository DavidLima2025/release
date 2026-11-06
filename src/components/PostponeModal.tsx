import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/input";
import { Task } from "../lib/domain";
import { addDays, formatBR, isValidISODate } from "../lib/dates";

export function PostponeModal({ task, today, onClose, onConfirm }: { task: Task | null; today: string; onClose: () => void; onConfirm: (task: Task, date: string) => void }) {
  const [date, setDate] = useState("");
  useEffect(() => { if (task) setDate(addDays(task.overdueDate > today ? task.overdueDate : today, 3)); }, [task, today]);
  if (!task) return null;
  const base = task.overdueDate > today ? task.overdueDate : today;
  const valid = isValidISODate(date);
  return (
    <Modal open onClose={onClose} size="md" eyebrow="Postergar prazo" title={task.title}
      footer={<>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="primary" disabled={!valid} onClick={() => { onConfirm(task, date); onClose(); }}><Clock />Postergar para {valid ? formatBR(date) : "…"}</Button>
      </>}>
      <p className="mb-4 text-sm text-pm-muted">Prazo atual: <b className="text-pm-ink">{formatBR(task.overdueDate)}</b></p>
      <div className="mb-4 flex flex-wrap gap-2">
        {[1, 3, 7, 15, 30].map((days) => (
          <Button key={days} size="sm" variant={date === addDays(base, days) ? "gold" : "outline"} onClick={() => setDate(addDays(base, days))}>+{days} {days === 1 ? "dia" : "dias"}</Button>
        ))}
      </div>
      <Field label="Nova data de prazo"><Input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} /></Field>
    </Modal>
  );
}
