import { useState } from "react";
import { BellRing, Gavel, MapPin, X } from "lucide-react";
import type { Task } from "../lib/domain";
import { formatBR, weekdayLabel } from "../lib/dates";
import { dueReminders, upcomingAudiencias, whenText } from "../lib/audiencia";

/** Faixa no topo: audiências dentro da janela de lembrete de cada uma. */
export function AudienciaBanner({ tasks, today, onOpen }: { tasks: Task[]; today: string; onOpen: (date: string) => void }) {
  const [hidden, setHidden] = useState<string>(() => { try { return sessionStorage.getItem("si6_aud_oculto") || ""; } catch { return ""; } });
  const due = dueReminders(tasks, today);
  const key = due.map((d) => d.task.id).join(",");
  if (!due.length || hidden === key) return null;
  const urgent = due.some((d) => d.days <= 1);
  const hide = () => { setHidden(key); try { sessionStorage.setItem("si6_aud_oculto", key); } catch { /* sem armazenamento */ } };
  return (
    <div className={`mb-5 flex items-start gap-3 rounded-sm border-l-4 px-4 py-3 shadow-panel ${urgent ? "border-status-late bg-red-50" : "border-status-risk bg-status-risk/10"}`}>
      <BellRing className={`mt-0.5 h-5 w-5 shrink-0 ${urgent ? "text-status-late" : "text-[#8a6200]"}`} />
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <p className="font-black uppercase tracking-wide">{due.length === 1 ? "Lembrete de audiência" : `${due.length} audiências próximas`}</p>
        {due.map(({ task, info, days }) => (
          <button key={task.id} type="button" onClick={() => onOpen(info.date)} className="block w-full text-left hover:underline">
            <b className={days <= 1 ? "text-status-late" : ""}>{whenText(days, info.time)}</b> ({formatBR(info.date)}) — {task.title}{info.local ? ` · ${info.local}` : ""}
          </button>
        ))}
      </div>
      <button type="button" onClick={hide} className="text-pm-muted hover:text-pm-ink" aria-label="Ocultar até a próxima sessão" title="Ocultar"><X className="h-4 w-4" /></button>
    </div>
  );
}

/** Lista das próximas audiências (painel). */
export function UpcomingAudiencias({ tasks, today, onOpen }: { tasks: Task[]; today: string; onOpen: (date: string) => void }) {
  const list = upcomingAudiencias(tasks, today, 90).slice(0, 6);
  if (!list.length) return null;
  return (
    <div className="rounded-sm border border-pm-line bg-white shadow-panel">
      <p className="pm-eyebrow flex items-center gap-2 border-b border-pm-line px-4 py-2.5"><Gavel className="h-4 w-4 text-pm-gold-dark" />Próximas audiências</p>
      <div className="divide-y divide-pm-line">
        {list.map(({ task, info, days }) => (
          <button key={task.id} type="button" onClick={() => onOpen(info.date)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-pm-cream">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-sm text-center leading-none ${days <= 1 ? "bg-status-late text-white" : days <= info.remindDays ? "bg-status-risk text-pm-black" : "bg-pm-black text-white"}`}>
              <span><span className="block font-display text-lg font-black">{info.date.slice(8)}</span><span className="text-[9px] font-bold uppercase">{weekdayLabel(info.date).slice(0, 3)}</span></span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{task.title}</p>
              <p className="flex flex-wrap gap-x-2 text-xs text-pm-muted">
                <span className={days <= 1 ? "font-bold text-status-late" : ""}>{whenText(days, info.time)}</span>
                {info.local && <span className="inline-flex items-center gap-1 truncate"><MapPin className="h-3 w-3" />{info.local}</span>}
                {info.pa && <span>{info.pa}</span>}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
