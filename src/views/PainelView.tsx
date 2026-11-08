import { AlertTriangle, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, ListChecks, PauseCircle, Plus, ScanText } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, EmptyState } from "../components/ui/card";
import { STATUS_COLOR } from "../components/ui/badge";
import { TaskCard } from "../components/TaskCard";
import { STATUSES, Status, Task, countByStatus } from "../lib/domain";
import { buildCalendarDays, formatBR, monthLabel, parseISODate, weekdayLabel } from "../lib/dates";
import type { AppData } from "../hooks/useAppData";
import { UpcomingAudiencias } from "../components/AudienciaPanel";
import { parseAudiencia } from "../lib/audiencia";

const STAT_META: Record<Status, { label: string; icon: any }> = {
  "A fazer": { label: "A fazer", icon: ListChecks },
  Atrasada: { label: "Atrasadas", icon: AlertTriangle },
  Paralisada: { label: "Paralisadas", icon: PauseCircle },
  "Risco de prazo": { label: "Risco de prazo", icon: Clock },
  "Concluída": { label: "Concluídas", icon: CheckCircle2 },
};

export function StatCards({ tasks, onOpen }: { tasks: Task[]; onOpen: (status: Status) => void }) {
  const counts = countByStatus(tasks);
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {STATUSES.map((status) => {
        const { label, icon: Icon } = STAT_META[status];
        return (
          <button key={status} type="button" onClick={() => onOpen(status)}
            className="group relative overflow-hidden rounded-sm border border-pm-line bg-white p-4 text-left shadow-panel transition hover:-translate-y-0.5 hover:border-pm-gold">
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: STATUS_COLOR[status] }} />
            <div className="flex items-start justify-between">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-pm-muted">{label}</p>
              <Icon className="h-4 w-4" style={{ color: STATUS_COLOR[status] }} />
            </div>
            <p className="mt-2 font-display text-4xl font-black leading-none text-pm-black">{counts[status] || 0}</p>
          </button>
        );
      })}
    </section>
  );
}

type Props = {
  data: AppData;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  monthDate: Date;
  setMonthDate: (date: Date) => void;
  onCreate: (date: string) => void;
  onEdit: (task: Task) => void;
  onPostpone: (task: Task) => void;
  onImportBo: () => void;
  onOpenStatus: (status: Status) => void;
};

export function PainelView({ data, selectedDate, setSelectedDate, monthDate, setMonthDate, onCreate, onEdit, onPostpone, onImportBo, onOpenStatus }: Props) {
  const days = buildCalendarDays(monthDate);
  const dayTasks = data.tasks.filter((task) => task.date === selectedDate);
  const dueTasks = data.tasks.filter((task) => task.overdueDate === selectedDate && task.date !== selectedDate && task.status !== "Concluída");

  // Audiência aparece também no dia em que acontece (a demanda fica no dia do recebimento).
  const audiencias = data.tasks.filter((t) => t.status !== "Concluída").map((t) => ({ t, info: parseAudiencia(t) })).filter((x) => x.info);
  const shiftMonth = (delta: number) => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + delta, 1));
  const goToday = () => { setSelectedDate(data.today); setMonthDate(parseISODate(data.today)); };

  return (
    <div className="space-y-6">
      <StatCards tasks={data.tasks} onOpen={onOpenStatus} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <Card>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="pm-heading flex items-center gap-2 text-lg"><CalendarDays className="h-5 w-5 text-pm-gold-dark" />Calendário de demandas</h2>
              <div className="flex items-center gap-1.5">
                <Button size="icon" onClick={() => shiftMonth(-1)} aria-label="Mês anterior"><ChevronLeft /></Button>
                <div className="skew-tab min-w-44 bg-pm-black px-4 py-2 text-center text-sm font-black uppercase tracking-wide text-white"><span>{monthLabel(monthDate)}</span></div>
                <Button size="icon" onClick={() => shiftMonth(1)} aria-label="Próximo mês"><ChevronRight /></Button>
                <Button size="sm" variant="ghost" onClick={goToday}>Hoje</Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-wider text-pm-muted sm:gap-1.5">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {days.map((date, index) => {
                if (!date) return <div key={`blank-${index}`} />;
                const list = data.tasks.filter((task) => task.date === date);
                const hearings = audiencias.filter((x) => x.info!.date === date);
                const selected = date === selectedDate;
                const isToday = date === data.today;
                const weekend = [0, 6].includes(parseISODate(date).getDay());
                return (
                  <button key={date} type="button" onClick={() => setSelectedDate(date)} onDoubleClick={() => onCreate(date)}
                    className={`group flex min-h-[62px] flex-col rounded-sm border p-1 text-left transition sm:min-h-[104px] sm:p-1.5 ${selected ? "border-pm-black bg-pm-black text-white" : `border-pm-line hover:border-pm-gold ${weekend ? "bg-pm-sand/50" : "bg-white"}`}`}>
                    <div className="flex items-center justify-between">
                      <span className={`grid h-6 w-6 place-items-center rounded-sm text-xs font-black ${isToday && !selected ? "bg-pm-gold text-pm-black" : ""}`}>{Number(date.slice(8))}</span>
                      {list.length > 0 && <span className={`text-[10px] font-black ${selected ? "text-pm-gold-light" : "text-pm-muted"}`}>{list.length}</span>}
                    </div>
                    <div className="mt-1 hidden flex-1 space-y-0.5 sm:block">
                      {hearings.map(({ t, info }) => (
                        <div key={`a-${t.id}`} className={`truncate rounded-[2px] px-1 py-0.5 text-[10px] font-black uppercase leading-tight ${selected ? "bg-pm-gold text-pm-black" : "bg-pm-black text-pm-gold-light"}`}>⚖ {info!.time || "Audiência"}</div>
                      ))}
                      {list.slice(0, 3).map((task) => (
                        <div key={task.id} className={`truncate rounded-[2px] border-l-[3px] px-1 py-0.5 text-[10px] font-semibold leading-tight ${selected ? "bg-white/10" : "bg-pm-cream"} ${task.status === "Concluída" ? "line-through opacity-60" : ""}`} style={{ borderColor: STATUS_COLOR[task.status] }}>{task.title}</div>
                      ))}
                      {list.length > 3 && <p className={`px-1 text-[10px] font-bold ${selected ? "text-pm-gold-light" : "text-pm-gold-dark"}`}>+{list.length - 3} mais</p>}
                    </div>
                    <div className="mt-auto flex gap-0.5 sm:hidden">
                      {hearings.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-pm-black ring-1 ring-pm-gold" />}
                      {list.slice(0, 4).map((task) => <span key={task.id} className="h-1.5 flex-1 rounded-full" style={{ background: STATUS_COLOR[task.status] }} />)}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-pm-muted">
              {STATUSES.map((status) => <span key={status} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: STATUS_COLOR[status] }} />{status}</span>)}
              <span className="ml-auto hidden md:inline">Clique duplo no dia para criar demanda</span>
            </div>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <div className="relative overflow-hidden bg-pm-black p-5 text-white">
            <div className="absolute inset-y-0 right-0 w-24 bg-pm-gold [clip-path:polygon(40%_0,100%_0,60%_100%,0_100%)]" />
            <p className="relative text-[11px] font-bold uppercase tracking-[0.22em] text-pm-gold-light">{weekdayLabel(selectedDate)}{selectedDate === data.today ? " · hoje" : ""}</p>
            <p className="relative font-display text-4xl font-black">{formatBR(selectedDate)}</p>
            <p className="relative mt-1 text-sm text-white/70">{dayTasks.length} demanda(s) no dia{dueTasks.length ? ` · ${dueTasks.length} com prazo vencendo` : ""}</p>
            <div className="relative mt-4 flex flex-wrap gap-2">
              <Button variant="gold" onClick={() => onCreate(selectedDate)}><Plus />Nova demanda</Button>
              <Button variant="light" onClick={onImportBo}><ScanText />Importar BO</Button>
            </div>
          </div>

          <UpcomingAudiencias tasks={data.tasks} today={data.today} onOpen={setSelectedDate} />

          <div className="space-y-2">
            {dayTasks.length === 0 && <EmptyState icon={CalendarDays} title="Nenhuma demanda neste dia">Cadastre uma nova demanda ou importe um BO em PDF.</EmptyState>}
            {dayTasks.map((task) => <TaskCard key={task.id} task={task} data={data} onEdit={onEdit} onPostpone={onPostpone} defaultOpen={dayTasks.length === 1} />)}
          </div>

          {dueTasks.length > 0 && (
            <div className="space-y-2">
              <p className="pm-eyebrow">Prazo vencendo neste dia</p>
              {dueTasks.map((task) => <TaskCard key={task.id} task={task} data={data} onEdit={onEdit} onPostpone={onPostpone} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

