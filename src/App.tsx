import { useCallback, useState } from "react";
import { Loader2, Plus, ScanText } from "lucide-react";
import { supabaseConfigured } from "./supabase";
import { useAppData } from "./hooks/useAppData";
import { Status, Task } from "./lib/domain";
import { formatBR, parseISODate, todayISO } from "./lib/dates";
import { ToastStack, useToasts } from "./components/Toast";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Button } from "./components/ui/button";
import { TaskFormModal } from "./components/TaskFormModal";
import { PostponeModal } from "./components/PostponeModal";
import { BoImportModal } from "./components/BoImportModal";
import { ChangePasswordModal, ForcePasswordChange } from "./components/PasswordForm";
import { Layout, View } from "./views/Layout";
import { LoginView } from "./views/LoginView";
import { SetupView } from "./views/SetupView";
import { PainelView } from "./views/PainelView";
import { TarefasView } from "./views/TarefasView";
import { WorkflowView } from "./views/WorkflowView";
import { DashboardView } from "./views/DashboardView";
import { UsersView } from "./views/UsersView";
import { TargetsView } from "./views/TargetsView";
import { AuditView } from "./views/AuditView";
import { TVPanel } from "./views/TVPanel";

const TITLES: Record<View, [string, string]> = {
  painel: ["Painel operacional", "Calendário e demandas do dia"],
  tarefas: ["Demandas", "Todas as demandas com filtros e pesquisa"],
  workflow: ["Workflow", "Etapas do processo de inteligência"],
  dashboard: ["Dashboard", "Indicadores de produtividade e prazos"],
  alvos: ["Banco de alvos", "Autores e suspeitos por modalidade"],
  usuarios: ["Usuários", "Cadastro e perfis de acesso"],
  auditoria: ["Auditoria", "Histórico de ações no sistema"],
};

export default function App() {
  if (!supabaseConfigured) return <SetupView />;
  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const { toasts, notify } = useToasts();
  const data = useAppData(notify);

  const [view, setView] = useState<View>("painel");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [monthDate, setMonthDate] = useState(() => parseISODate(todayISO()));
  const [statusFilter, setStatusFilter] = useState("Todas");
  const [taskForm, setTaskForm] = useState<{ open: boolean; task: Task | null; date: string }>({ open: false, task: null, date: todayISO() });
  const [postponing, setPostponing] = useState<Task | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [tvOpen, setTvOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const openCreate = useCallback((date: string) => setTaskForm({ open: true, task: null, date }), []);
  const openEdit = useCallback((task: Task) => setTaskForm({ open: true, task, date: task.date }), []);
  const closeForm = useCallback(() => setTaskForm((f) => ({ ...f, open: false })), []);
  const closeTv = useCallback(() => setTvOpen(false), []);

  const selectDate = (date: string) => {
    setSelectedDate(date);
    const d = parseISODate(date);
    if (d.getMonth() !== monthDate.getMonth() || d.getFullYear() !== monthDate.getFullYear()) setMonthDate(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const openStatus = (status: Status) => { setStatusFilter(status); setView("tarefas"); };

  if (data.checkingSession) return <div className="grid min-h-screen place-items-center bg-pm-black text-pm-gold-light"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!data.currentUser) return <><LoginView onLogin={data.login} /><ToastStack toasts={toasts} /></>;
  if (data.currentUser.mustChangePassword) {
    return <><ForcePasswordChange name={data.currentUser.warName || data.currentUser.name} onSubmit={data.changeOwnPassword} onLogout={() => data.logout()} /><ToastStack toasts={toasts} /></>;
  }

  // Garante que um perfil sem permissão não fique numa tela restrita.
  const allowed: Record<View, boolean> = {
    painel: true, tarefas: true, workflow: true, dashboard: data.permissions.dashboard, alvos: data.permissions.targets,
    usuarios: data.permissions.users, auditoria: data.permissions.audit,
  };
  const current: View = allowed[view] ? view : "painel";
  const [title, subtitle] = TITLES[current];

  const headerActions = (current === "painel" || current === "tarefas") && (
    <>
      <Button onClick={() => setImportOpen(true)}><ScanText />Importar BO</Button>
      <Button variant="primary" onClick={() => openCreate(selectedDate)}><Plus />Nova demanda</Button>
    </>
  );

  const submitTask = async (values: any, file?: File | null) => {
    if (taskForm.task) return data.updateTask(taskForm.task.id, values);
    const created = await data.createTasks(values);
    if (!created) return false;
    if (file && created[0]) await data.uploadDemandFile(created[0], file);
    selectDate(values.date);
    return true;
  };

  return (
    <>
      <Layout view={current} setView={setView} data={data} onOpenTv={() => setTvOpen(true)} onImportBo={() => setImportOpen(true)}
        onChangePassword={() => setPasswordOpen(true)} title={title} subtitle={current === "painel" ? `${subtitle} · hoje ${formatBR(data.today)}` : subtitle} actions={headerActions}>
        {data.loading ? (
          <div className="flex items-center gap-3 py-20 text-pm-muted"><Loader2 className="h-5 w-5 animate-spin" />Carregando dados…</div>
        ) : (
          <ErrorBoundary resetKey={current}>
            {current === "painel" && (
              <PainelView data={data} selectedDate={selectedDate} setSelectedDate={selectDate} monthDate={monthDate} setMonthDate={setMonthDate}
                onCreate={openCreate} onEdit={openEdit} onPostpone={setPostponing} onImportBo={() => setImportOpen(true)} onOpenStatus={openStatus} />
            )}
            {current === "tarefas" && <TarefasView data={data} statusFilter={statusFilter} setStatusFilter={setStatusFilter} onEdit={openEdit} onPostpone={setPostponing} />}
            {current === "workflow" && <WorkflowView data={data} onEdit={openEdit} />}
            {current === "dashboard" && <DashboardView data={data} />}
            {current === "alvos" && <TargetsView data={data} />}
            {current === "usuarios" && <UsersView data={data} />}
            {current === "auditoria" && <AuditView data={data} />}
          </ErrorBoundary>
        )}
      </Layout>

      <TaskFormModal open={taskForm.open} task={taskForm.task} initialDate={taskForm.date} users={data.users} workflows={data.workflows}
        currentUserId={data.currentUser.id} onClose={closeForm} onSubmit={submitTask} />
      <PostponeModal task={postponing} today={data.today} onClose={() => setPostponing(null)} onConfirm={data.postponeTask} />
      <BoImportModal open={importOpen} selectedDate={selectedDate} data={data} onClose={() => setImportOpen(false)}
        onCreated={(date) => { notify("Demanda(s) criada(s) a partir do BO, com o PDF anexado."); if (date) { selectDate(date); setView("painel"); } }} />
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} onSubmit={data.changeOwnPassword} />
      {tvOpen && <TVPanel data={data} onClose={closeTv} />}
      <ToastStack toasts={toasts} />
    </>
  );
}
