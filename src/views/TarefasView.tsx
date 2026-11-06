import { useMemo, useState } from "react";
import { ListChecks, Search, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, EmptyState } from "../components/ui/card";
import { Input, Select } from "../components/ui/input";
import { STATUS_COLOR } from "../components/ui/badge";
import { TaskCard } from "../components/TaskCard";
import { PRIORITIES, STATUSES, TASK_TYPES, Task, countByStatus, isOpen, matchesText } from "../lib/domain";
import { isSameMonth, parseISODate } from "../lib/dates";
import type { AppData } from "../hooks/useAppData";

type Props = {
  data: AppData;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  onEdit: (task: Task) => void;
  onPostpone: (task: Task) => void;
};

const PRIORITY_WEIGHT: Record<string, number> = { Crítica: 0, Alta: 1, Média: 2, Baixa: 3 };
const STATUS_WEIGHT: Record<string, number> = { Atrasada: 0, "Risco de prazo": 1, "A fazer": 2, Paralisada: 3, "Concluída": 4 };

export function TarefasView({ data, statusFilter, setStatusFilter, onEdit, onPostpone }: Props) {
  const [query, setQuery] = useState("");
  const [responsible, setResponsible] = useState("");
  const [type, setType] = useState("");
  const [priority, setPriority] = useState("");
  const [date, setDate] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [sort, setSort] = useState<"prazo" | "dia" | "prioridade">("prazo");

  const searching = Boolean(query.trim() || date);
  const reference = parseISODate(data.today);

  const base = useMemo(() => data.tasks.filter((task) => {
    // Sem pesquisa: abertas sempre aparecem; concluídas só as do mês atual. A pesquisa olha o histórico inteiro.
    if (!searching && !isOpen(task) && !isSameMonth(task.date, reference)) return false;
    if (responsible && task.responsibleId !== responsible) return false;
    if (onlyMine && task.responsibleId !== data.currentUser?.id) return false;
    if (type && task.type !== type) return false;
    if (priority && task.priority !== priority) return false;
    if (date && ![task.date, task.overdueDate, task.officialDeadline].includes(date)) return false;
    return matchesText([task.title, task.type, task.responsible, task.manager, task.workflow, task.notes], query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data.tasks, searching, responsible, onlyMine, type, priority, date, query, data.today]);

  const counts = countByStatus(base);
  const visible = base
    .filter((task) => statusFilter === "Todas" || task.status === statusFilter)
    .sort((a, b) => {
      if (sort === "dia") return a.date.localeCompare(b.date);
      if (sort === "prioridade") return (PRIORITY_WEIGHT[a.priority] ?? 9) - (PRIORITY_WEIGHT[b.priority] ?? 9) || a.overdueDate.localeCompare(b.overdueDate);
      return (STATUS_WEIGHT[a.status] ?? 9) - (STATUS_WEIGHT[b.status] ?? 9) || a.overdueDate.localeCompare(b.overdueDate);
    });

  const hasFilters = query || responsible || type || priority || date || onlyMine;
  const clear = () => { setQuery(""); setResponsible(""); setType(""); setPriority(""); setDate(""); setOnlyMine(false); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["Todas", ...STATUSES].map((status) => {
          const active = statusFilter === status;
          const total = status === "Todas" ? base.length : counts[status as keyof typeof counts] || 0;
          return (
            <button key={status} type="button" onClick={() => setStatusFilter(status)}
              className={`inline-flex items-center gap-2 rounded-sm border px-3 py-2 text-xs font-bold uppercase tracking-wide transition ${active ? "border-pm-black bg-pm-black text-white" : "border-pm-line bg-white hover:border-pm-gold"}`}>
              {status !== "Todas" && <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: STATUS_COLOR[status] }} />}
              {status}<span className={active ? "text-pm-gold-light" : "text-pm-muted"}>{total}</span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardContent className="!p-4">
          <div className="grid gap-2 md:grid-cols-[minmax(220px,2fr)_repeat(4,minmax(0,1fr))_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-pm-muted" />
              <Input className="pl-9" placeholder="Pesquisar em todas as demandas (inclui histórico)" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <Select value={responsible} onChange={(e) => setResponsible(e.target.value)}>
              <option value="">Todos os responsáveis</option>
              {data.users.map((u) => <option key={u.id} value={u.id}>{u.warName || u.name}</option>)}
            </Select>
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Todos os tipos</option>
              {TASK_TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
            <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="">Todas as prioridades</option>
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </Select>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} title="Dia ou prazo" />
            <Select value={sort} onChange={(e) => setSort(e.target.value as any)} aria-label="Ordenar">
              <option value="prazo">Ordenar: urgência</option>
              <option value="dia">Ordenar: dia</option>
              <option value="prioridade">Ordenar: prioridade</option>
            </Select>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-pm-muted">
            <label className="inline-flex cursor-pointer items-center gap-2 font-semibold text-pm-ink">
              <input type="checkbox" className="h-4 w-4 accent-[#7A6C45]" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} />Só as minhas
            </label>
            <span>{searching ? "Pesquisando em todo o histórico." : "Abertas sempre aparecem; concluídas, só as do mês atual."}</span>
            {hasFilters && <Button size="sm" variant="ghost" onClick={clear}><X />Limpar filtros</Button>}
            <span className="ml-auto font-bold text-pm-ink">{visible.length} demanda(s)</span>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {visible.length === 0 && <EmptyState icon={ListChecks} title="Nenhuma demanda encontrada">Ajuste os filtros ou pesquise pelo nome, REDS ou responsável.</EmptyState>}
        {visible.map((task) => <TaskCard key={task.id} task={task} data={data} onEdit={onEdit} onPostpone={onPostpone} />)}
      </div>
    </div>
  );
}
