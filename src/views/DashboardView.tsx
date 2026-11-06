import { AlertTriangle, CalendarClock, CheckCircle2, ListChecks, ScanText, TrendingUp } from "lucide-react";
import { Card, CardContent, EmptyState, SectionHeader } from "../components/ui/card";
import { STATUS_COLOR, StatusBadge } from "../components/ui/badge";
import { STATUSES, TASK_TYPES, checklistProgress, countByStatus, isOpen } from "../lib/domain";
import { addDays, formatBR, isSameMonth, parseISODate } from "../lib/dates";
import type { AppData } from "../hooks/useAppData";

function Kpi({ label, value, icon: Icon, hint }: { label: string; value: string | number; icon: any; hint?: string }) {
  return (
    <div className="pm-panel p-4">
      <div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-pm-muted">{label}</p><Icon className="h-4 w-4 text-pm-gold-dark" /></div>
      <p className="mt-2 font-display text-4xl font-black leading-none">{value}</p>
      {hint && <p className="mt-1 text-xs text-pm-muted">{hint}</p>}
    </div>
  );
}

/** Barra horizontal simples (magnitude em um só tom). */
function BarRow({ label, value, max, suffix, color = "#9B8A5C" }: { label: string; value: number; max: number; suffix?: string; color?: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div title={`${label}: ${value}${suffix || ""}`} className="group">
      <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate font-semibold">{label}</span><span className="shrink-0 tabular-nums text-pm-muted">{value}{suffix}</span></div>
      <div className="h-2.5 overflow-hidden rounded-sm bg-pm-sand"><div className="h-full rounded-r-[4px] transition-all group-hover:brightness-90" style={{ width: `${Math.max(pct, value ? 2 : 0)}%`, background: color }} /></div>
    </div>
  );
}

export function DashboardView({ data }: { data: AppData }) {
  const { tasks, users, today } = data;
  const counts = countByStatus(tasks);
  const open = tasks.filter(isOpen);
  const reference = parseISODate(today);
  const doneThisMonth = tasks.filter((t) => t.status === "Concluída" && isSameMonth(t.date, reference)).length;
  const monthTotal = tasks.filter((t) => isSameMonth(t.date, reference)).length;
  const rate = monthTotal ? Math.round((doneThisMonth / monthTotal) * 100) : 0;
  const avgChecklist = open.length ? Math.round(open.reduce((sum, t) => sum + checklistProgress(t), 0) / open.length) : 0;

  const ranking = users.filter((u) => u.status === "Ativo").map((user) => {
    const assigned = tasks.filter((t) => t.responsibleId === user.id);
    return {
      label: user.warName || user.name,
      open: assigned.filter(isOpen).length,
      late: assigned.filter((t) => t.status === "Atrasada").length,
      done: assigned.filter((t) => t.status === "Concluída").length,
    };
  }).filter((r) => r.open + r.done > 0).sort((a, b) => b.open - a.open).slice(0, 8);
  const maxOpen = Math.max(1, ...ranking.map((r) => r.open));

  const types = [...new Set([...TASK_TYPES, ...tasks.map((t) => t.type)])].map((type) => ({ type, total: tasks.filter((t) => t.type === type).length })).filter((t) => t.total).sort((a, b) => b.total - a.total);
  const maxType = Math.max(1, ...types.map((t) => t.total));

  const boTasks = tasks.filter((t) => /^REDS \d{4}-/.test(t.title));
  const naturezas = Object.entries(boTasks.reduce((acc, t) => {
    const nat = t.title.split("—")[1]?.trim() || "Não informada";
    acc[nat] = (acc[nat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxNat = Math.max(1, ...naturezas.map(([, n]) => n));

  const upcoming = open.filter((t) => t.overdueDate >= today && t.overdueDate <= addDays(today, 7)).sort((a, b) => a.overdueDate.localeCompare(b.overdueDate)).slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Em aberto" value={open.length} icon={ListChecks} />
        <Kpi label="Atrasadas" value={counts["Atrasada"]} icon={AlertTriangle} hint={open.length ? `${Math.round((counts["Atrasada"] / open.length) * 100)}% das abertas` : undefined} />
        <Kpi label="Conclusão no mês" value={`${rate}%`} icon={TrendingUp} hint={`${doneThisMonth} de ${monthTotal}`} />
        <Kpi label="Checklist médio" value={`${avgChecklist}%`} icon={CheckCircle2} hint="das demandas abertas" />
        <Kpi label="BOs importados" value={boTasks.length} icon={ScanText} />
      </div>

      <Card>
        <CardContent>
          <SectionHeader title="Demandas por situação" />
          <div className="flex h-8 w-full gap-[2px] overflow-hidden rounded-sm bg-pm-sand">
            {STATUSES.map((s) => counts[s] ? <div key={s} title={`${s}: ${counts[s]}`} style={{ flex: counts[s], background: STATUS_COLOR[s] }} /> : null)}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {STATUSES.map((s) => <span key={s} className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-[2px]" style={{ background: STATUS_COLOR[s] }} />{s} <b className="tabular-nums">{counts[s]}</b></span>)}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent>
            <SectionHeader title="Carga por responsável" subtitle="Demandas em aberto (atrasadas entre parênteses)" />
            <div className="space-y-3">
              {ranking.length === 0 && <EmptyState title="Sem demandas atribuídas" />}
              {ranking.map((r) => <BarRow key={r.label} label={`${r.label}${r.late ? ` (${r.late} atrasada${r.late > 1 ? "s" : ""})` : ""}`} value={r.open} max={maxOpen} />)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <SectionHeader title="Distribuição por tipo" />
            <div className="space-y-3">
              {types.length === 0 && <EmptyState title="Sem demandas" />}
              {types.map((t) => <BarRow key={t.type} label={t.type} value={t.total} max={maxType} color="#231F20" />)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <SectionHeader icon={ScanText} title="Naturezas dos BOs importados" />
            <div className="space-y-3">
              {naturezas.length === 0 && <EmptyState title="Nenhum BO importado ainda" />}
              {naturezas.map(([nat, n]) => <BarRow key={nat} label={nat} value={n} max={maxNat} />)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <SectionHeader icon={CalendarClock} title="Prazos dos próximos 7 dias" />
            <div className="divide-y divide-pm-line">
              {upcoming.length === 0 && <EmptyState title="Nenhum prazo nos próximos dias" />}
              {upcoming.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-12 shrink-0 font-black tabular-nums">{formatBR(t.overdueDate).slice(0, 5)}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{t.title}</span>
                  <span className="hidden shrink-0 text-xs text-pm-muted sm:inline">{t.responsible}</span>
                  <StatusBadge status={t.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
