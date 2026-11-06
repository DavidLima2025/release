import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, GitBranch, Plus, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, EmptyState, SectionHeader } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { STATUS_COLOR, StatusBadge } from "../components/ui/badge";
import { Task, isOpen } from "../lib/domain";
import { formatBR } from "../lib/dates";
import type { AppData } from "../hooks/useAppData";

export function WorkflowView({ data, onEdit }: { data: AppData; onEdit: (task: Task) => void }) {
  const [name, setName] = useState("");
  const { workflows, permissions } = data;
  const openTasks = data.tasks.filter(isOpen);
  const unassigned = openTasks.filter((task) => !workflows.some((w) => w.id === task.workflowId));

  const move = (task: Task, delta: number) => {
    const index = workflows.findIndex((w) => w.id === task.workflowId);
    const target = workflows[Math.min(workflows.length - 1, Math.max(0, index + delta))];
    if (target && target.id !== task.workflowId) data.setTaskWorkflow(task, target);
  };

  const create = async () => { if (await data.addWorkflow(name)) setName(""); };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <SectionHeader icon={GitBranch} title="Quadro do processo" subtitle="Demandas em aberto por etapa. Ao chegar na última etapa, a demanda é concluída." />
          {workflows.length === 0 ? (
            <EmptyState icon={GitBranch} title="Nenhuma etapa cadastrada">Crie as etapas abaixo (ex.: Triagem, Coleta, Análise, Difusão).</EmptyState>
          ) : (
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
              {[...(unassigned.length ? [{ id: "", name: "Sem etapa", position: -1 }] : []), ...workflows].map((workflow, index) => {
                const list = workflow.id ? openTasks.filter((task) => task.workflowId === workflow.id) : unassigned;
                const stepNumber = workflow.id ? workflows.findIndex((w) => w.id === workflow.id) + 1 : 0;
                return (
                  <div key={workflow.id || `none-${index}`} className="flex w-72 shrink-0 flex-col rounded-sm border border-pm-line bg-pm-cream/70">
                    <div className="flex items-center gap-2 border-b border-pm-line bg-pm-black px-3 py-2 text-white">
                      <span className="grid h-6 w-6 place-items-center rounded-sm bg-pm-gold text-xs font-black text-pm-black">{stepNumber || "–"}</span>
                      <span className="flex-1 truncate text-sm font-black uppercase tracking-wide">{workflow.name}</span>
                      <span className="text-xs font-bold text-pm-gold-light">{list.length}</span>
                    </div>
                    <div className="flex max-h-[520px] flex-col gap-2 overflow-y-auto p-2">
                      {list.length === 0 && <p className="p-3 text-center text-xs text-pm-muted">Vazio</p>}
                      {list.map((task) => (
                        <div key={task.id} className="relative rounded-sm border border-pm-line bg-white p-2.5 pl-3 shadow-sm">
                          <span className="absolute inset-y-0 left-0 w-1" style={{ background: STATUS_COLOR[task.status] }} />
                          <button type="button" onClick={() => onEdit(task)} className="block w-full text-left text-sm font-bold leading-snug hover:text-pm-gold-dark">{task.title}</button>
                          <p className="mt-1 text-[11px] text-pm-muted">{task.responsible} · prazo {formatBR(task.overdueDate)}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <StatusBadge status={task.status} />
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="!h-7 !w-7" title="Etapa anterior" disabled={!workflow.id || stepNumber <= 1} onClick={() => move(task, -1)}><ChevronLeft /></Button>
                              <Button size="icon" variant="ghost" className="!h-7 !w-7" title="Próxima etapa" onClick={() => (workflow.id ? move(task, 1) : data.setTaskWorkflow(task, workflows[0]))}><ChevronRight /></Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHeader title="Etapas do workflow" subtitle="A ordem define o caminho das demandas. Novas demandas entram na primeira etapa." />
          {permissions.manageWorkflow && (
            <form className="mb-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); create(); }}>
              <Input placeholder="Nova etapa. Ex.: Monitoramento" value={name} onChange={(e) => setName(e.target.value)} />
              <Button type="submit" variant="primary"><Plus />Criar etapa</Button>
            </form>
          )}
          <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {workflows.map((workflow, index) => {
              const inUse = data.tasks.filter((task) => task.workflowId === workflow.id).length;
              return (
                <li key={workflow.id} className="flex items-center gap-3 rounded-sm border border-pm-line bg-white px-3 py-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-pm-black text-sm font-black text-white">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{workflow.name}</p>
                    <p className="text-xs text-pm-muted">{inUse ? `${inUse} demanda(s)` : "Livre"}{index === workflows.length - 1 ? " · etapa final" : ""}</p>
                  </div>
                  {permissions.manageWorkflow && <>
                    <Button size="icon" variant="ghost" title="Subir" disabled={index === 0} onClick={() => data.moveWorkflow(workflow, -1)}><ArrowUp /></Button>
                    <Button size="icon" variant="ghost" title="Descer" disabled={index === workflows.length - 1} onClick={() => data.moveWorkflow(workflow, 1)}><ArrowDown /></Button>
                  </>}
                  {permissions.deleteWorkflow && !inUse && <Button size="icon" variant="ghost" title="Excluir" className="text-status-late" onClick={() => data.deleteWorkflow(workflow)}><Trash2 /></Button>}
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
