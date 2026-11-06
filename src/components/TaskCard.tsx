import { useState } from "react";
import { Check, ChevronDown, Clock, Copy, Edit3, FileText, PauseCircle, Paperclip, RotateCcw, Trash2, Upload, UserRound, X } from "lucide-react";
import { Button } from "./ui/button";
import { Badge, PriorityBadge, STATUS_COLOR, StatusBadge } from "./ui/badge";
import { Attachment, Task, checklistProgress, formatBytes } from "../lib/domain";
import { daysBetween, formatBR } from "../lib/dates";
import type { AppData } from "../hooks/useAppData";

type Props = {
  task: Task;
  data: AppData;
  onEdit: (task: Task) => void;
  onPostpone: (task: Task) => void;
  defaultOpen?: boolean;
};

function deadlineText(task: Task, today: string) {
  if (task.status === "Concluída") return "Concluída";
  const diff = daysBetween(task.overdueDate, today);
  if (diff === null) return "Sem prazo";
  if (diff < 0) return `Atrasada há ${-diff} dia${diff === -1 ? "" : "s"}`;
  if (diff === 0) return "Vence hoje";
  if (diff === 1) return "Vence amanhã";
  return `Vence em ${diff} dias`;
}

export function TaskCard({ task, data, onEdit, onPostpone, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const files: Attachment[] = data.attachments.filter((file) => file.demandId === task.id);
  const progress = checklistProgress(task);
  const done = task.status === "Concluída";

  return (
    <article className="relative overflow-hidden rounded-sm border border-pm-line bg-white shadow-panel">
      <span className="absolute inset-y-0 left-0 w-1" style={{ background: STATUS_COLOR[task.status] }} />
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-start gap-3 px-4 py-3 pl-5 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            <Badge>{task.type}</Badge>
            {files.length > 0 && <Badge tone="gold"><Paperclip className="h-3 w-3" />{files.length}</Badge>}
          </div>
          <h3 className={`mt-1.5 font-bold leading-snug text-pm-black ${done ? "text-pm-muted line-through decoration-pm-gold/60" : ""}`}>{task.title}</h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-pm-muted">
            <span className="inline-flex items-center gap-1"><UserRound className="h-3 w-3" />{task.responsible}</span>
            <span>Dia {formatBR(task.date)}</span>
            <span className={task.status === "Atrasada" ? "font-bold text-status-late" : task.status === "Risco de prazo" ? "font-bold text-[#8a6200]" : ""}>{deadlineText(task, data.today)} · prazo {formatBR(task.overdueDate)}</span>
            <span>{task.workflow}</span>
          </p>
        </div>
        <div className="hidden w-24 shrink-0 sm:block">
          <div className="flex justify-between text-[10px] font-bold uppercase text-pm-muted"><span>Checklist</span><span>{progress}%</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-pm-sand"><div className="h-full bg-pm-gold" style={{ width: `${progress}%` }} /></div>
        </div>
        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-pm-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-pm-line bg-pm-cream/40 px-5 py-4">
          {task.notes && <p className="max-h-72 overflow-auto whitespace-pre-wrap text-sm leading-relaxed text-pm-ink">{task.notes}</p>}

          <div className="grid gap-2 text-xs sm:grid-cols-4">
            <Info label="Gestor" value={task.manager} />
            <Info label="Etapa" value={task.workflow} />
            <Info label="Prazo interno" value={formatBR(task.overdueDate)} />
            <Info label="Prazo oficial" value={formatBR(task.officialDeadline)} />
          </div>

          <div>
            <p className="pm-label">Checklist</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {task.checklist.map((item, index) => (
                <label key={`${task.id}-${index}`} className="flex cursor-pointer items-center gap-2 rounded-sm border border-pm-line bg-white px-3 py-2 text-sm hover:border-pm-gold">
                  <input type="checkbox" className="h-4 w-4 accent-[#7A6C45]" checked={task.done[index]} onChange={() => data.toggleChecklistItem(task, index)} />
                  <span className={task.done[index] ? "text-pm-muted line-through" : ""}>{item}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <p className="pm-label">Anexos</p>
            <div className="flex flex-wrap gap-2">
              {files.map((file) => (
                <span key={file.id} className="inline-flex items-center gap-1 rounded-sm border border-pm-line bg-white text-xs font-semibold">
                  <a href={data.getAttachmentUrl(file.filePath)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 hover:text-pm-gold-dark">
                    <FileText className="h-3.5 w-3.5 text-pm-gold-dark" />{file.fileName}<span className="font-normal text-pm-muted">{formatBytes(file.fileSize)}</span>
                  </a>
                  <button type="button" title="Remover anexo" onClick={() => data.deleteAttachment(file)} className="px-1.5 py-1.5 text-pm-muted hover:text-status-late"><X className="h-3.5 w-3.5" /></button>
                </span>
              ))}
              <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-sm border border-dashed border-pm-gold px-3 text-xs font-bold uppercase tracking-wide text-pm-gold-dark hover:bg-white">
                <Upload className="h-3.5 w-3.5" />Anexar
                <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) data.uploadDemandFile(task, f); e.target.value = ""; }} />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-pm-line pt-3">
            {done
              ? <Button size="sm" onClick={() => data.setTaskStatus(task, "A fazer")}><RotateCcw />Reabrir</Button>
              : <Button size="sm" variant="primary" onClick={() => data.setTaskStatus(task, "Concluída")}><Check />Concluir</Button>}
            <Button size="sm" onClick={() => onEdit(task)}><Edit3 />Editar</Button>
            {!done && <Button size="sm" onClick={() => onPostpone(task)}><Clock />Postergar</Button>}
            {!done && task.status !== "Paralisada" && <Button size="sm" onClick={() => data.setTaskStatus(task, "Paralisada")}><PauseCircle />Paralisar</Button>}
            {task.status === "Paralisada" && <Button size="sm" onClick={() => data.setTaskStatus(task, "A fazer")}><RotateCcw />Retomar</Button>}
            <Button size="sm" onClick={() => data.duplicateTask(task)}><Copy />Duplicar</Button>
            {data.permissions.deleteDemand && <Button size="sm" variant="danger" onClick={() => data.deleteTask(task)}><Trash2 />Excluir</Button>}
          </div>
        </div>
      )}
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-pm-line bg-white px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-pm-muted">{label}</p>
      <p className="truncate font-semibold text-pm-ink">{value || "—"}</p>
    </div>
  );
}
