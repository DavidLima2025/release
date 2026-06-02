
import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, ArrowLeft, Building2, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardCheck, Clock, Copy, Edit3, Eye, FileText, Filter, LayoutDashboard, ListChecks, Lock, Mail, PauseCircle,
  Phone, Plus, RotateCcw, Search,
  Settings, Shield, Trash2, UserPlus, UserRound, Users
} from "lucide-react";
import { supabase } from "./supabase";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

const today = new Date().toISOString().slice(0, 10);
const statuses = ["A fazer", "Atrasada", "Paralisada", "Risco de prazo", "Concluída"];
const userRoles = ["Administrador", "Gestor", "Analista", "Colaborador"];

function Badge({ children, tone = "default" }) {
  const tones = {
    default: "bg-slate-100 text-slate-700",
    high: "bg-red-100 text-red-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-emerald-100 text-emerald-700",
    dark: "bg-emerald-950 text-emerald-50",
  };
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tones[tone] || tones.default}`}>{children}</span>;
}

function normalizeUser(row) {
  return {
    id: row?.id || "",
    name: row?.name || "Usuário sem nome",
    warName: row?.war_name || row?.name || "Usuário",
    register: row?.register || "",
    unit: row?.unit || "",
    role: row?.role || "Colaborador",
    email: row?.email || "",
    phone: row?.phone || "",
    login: row?.login || "",
    status: row?.status || "Ativo",
  };
}

function normalizeWorkflow(row) {
  return { id: row.id, name: row.name, position: row.position };
}

function normalizeTask(row) {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    status: row.status,
    priority: row.priority,
    responsibleId: row.responsible_id,
    managerId: row.manager_id,
    responsible: row.responsible?.war_name || row.responsible?.name || "Sem responsável",
    manager: row.manager?.war_name || row.manager?.name || "Gestor",
    date: row.date,
    officialDeadline: row.official_deadline || row.date,
    internalDeadline: row.internal_deadline || row.date,
    overdueDate: row.overdue_date || row.internal_deadline || row.date,
    workflowId: row.workflow_id,
    workflow: row.workflow?.name || "Triagem",
    checklist: Array.isArray(row.checklist) ? row.checklist : ["Triar demanda", "Executar atividade", "Registrar conclusão"],
    done: Array.isArray(row.done) ? row.done : [false, false, false],
    notes: row.notes || "",
  };
}

function getStatusCounts(tasks) {
  return statuses.reduce((acc, status) => {
    acc[status] = tasks.filter((task) => task.status === status).length;
    return acc;
  }, {});
}

function buildCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  for (let i = 0; i < firstDay.getDay(); i += 1) days.push(null);
  for (let day = 1; day <= lastDay.getDate(); day += 1) days.push(new Date(year, month, day).toISOString().slice(0, 10));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function OwlLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 shadow-lg shadow-orange-950/30">
        <Eye className="absolute left-2 h-5 w-5 text-white" />
        <Eye className="absolute right-2 h-5 w-5 text-white" />
        <Shield className="mt-5 h-5 w-5 text-emerald-950" />
      </div>
      <div>
        <p className="text-xl font-black tracking-tight text-white">SI 6ª CIA</p>
        <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">Centro de inteligência</p>
      </div>
    </div>
  );
}

function Login({ onLogin }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const submitLogin = () => {
    if (!login.trim() || !password.trim()) return alert("Informe usuário e senha para acessar.");
    onLogin(login.trim(), password);
  };
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black p-6 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,88,12,0.34),transparent_34%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.25)_42%,rgba(0,0,0,0.92)_100%)]" />
      <motion.section initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative z-10 w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 inline-flex rounded-full border border-orange-500/40 bg-black/55 px-5 py-2 text-xs font-black uppercase tracking-[0.28em] text-orange-300 shadow-lg shadow-orange-950/40 backdrop-blur">Inteligência Operacional</div>
          <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-2xl">SI 6ª CIA</h1>
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.22em] text-orange-200">Observar • Analisar • Antecipar</p>
        </div>
        <div className="rounded-3xl border border-orange-500/30 bg-black/72 p-8 shadow-2xl shadow-orange-950/50 backdrop-blur-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-600 shadow-lg shadow-orange-700/40 ring-1 ring-orange-300/40"><Eye className="h-9 w-9 text-white" /></div>
            <h2 className="text-2xl font-black tracking-tight text-white">Acesso Restrito</h2>
            <p className="mt-2 text-sm text-zinc-400">Sistema Integrado de Inteligência</p>
          </div>
          <div className="space-y-4">
            <Input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Usuário" className="h-12 border-white/10 bg-white/10 text-white placeholder:text-zinc-400" />
            <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Senha" type="password" className="h-12 border-white/10 bg-white/10 text-white placeholder:text-zinc-400" onKeyDown={(e) => e.key === "Enter" && submitLogin()} />
            <Button onClick={submitLogin} className="h-12 w-full bg-orange-600 text-base font-black uppercase tracking-wide hover:bg-orange-700"><Lock className="mr-2 h-4 w-4" /> Entrar</Button>
          </div>
        </div>
      </motion.section>
    </main>
  );
}

function StatCard({ label, value, icon: Icon, className }) {
  return (
    <Card className={`${className} border-0 text-white shadow-lg transition hover:scale-[1.02]`}>
      <CardContent className="flex items-center justify-between p-5">
        <div><p className="text-sm font-bold opacity-90">{label}</p><p className="mt-1 text-3xl font-black">{value}</p></div>
        <Icon className="h-10 w-10 opacity-90" />
      </CardContent>
    </Card>
  );
}

function CalendarBoard({ tasks, selectedDate, setSelectedDate, monthDate, setMonthDate, addQuickTask, updateTaskStatus, deleteTask, postponeTask, users }) {
  const [quickTitle, setQuickTitle] = useState("");
  const [quickResponsible, setQuickResponsible] = useState("");
  const [quickType, setQuickType] = useState("Inteligência");
  const [quickPriority, setQuickPriority] = useState("Média");
  const [quickOverdueDate, setQuickOverdueDate] = useState(selectedDate);
  const [quickNotes, setQuickNotes] = useState("");
  const [dayPanelOpen, setDayPanelOpen] = useState(false);
  const [dayPanelMode, setDayPanelMode] = useState("view");
  const selectedTasks = tasks.filter((task) => task.date === selectedDate);
  const monthDays = buildCalendarDays(monthDate);
  const monthLabel = monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const activeUsers = users.filter((u) => u.status === "Ativo");

  useEffect(() => setQuickOverdueDate(selectedDate), [selectedDate]);

  const saveQuickTask = () => {
    if (!quickTitle.trim()) return;
    if (!quickResponsible) return alert("Selecione um responsável cadastrado.");
    const responsible = users.find((u) => u.id === quickResponsible);
    addQuickTask({
      title: quickTitle,
      responsibleId: quickResponsible,
      responsible: responsible?.warName || responsible?.name || "",
      date: selectedDate,
      type: quickType,
      priority: quickPriority,
      overdueDate: quickOverdueDate || selectedDate,
      notes: quickNotes || "Demanda criada diretamente pelo calendário visual.",
    });
    setQuickTitle(""); setQuickResponsible(""); setQuickType("Inteligência"); setQuickPriority("Média"); setQuickNotes(""); setDayPanelMode("view");
  };

  return (
    <Card className="rounded-[2rem] border-0 bg-white/90 soft-card ring-1 ring-slate-200/70">
      <CardContent className="p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black"><CalendarDays className="h-5 w-5 text-orange-600" /> Calendário visual de atividades</h2>
            <p className="text-sm text-slate-500">Clique em um dia para ver atividades feitas e cadastrar nova demanda direto no calendário.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <div className="min-w-44 rounded-xl bg-emerald-950 px-4 py-2 text-center text-sm font-bold capitalize text-white">{monthLabel}</div>
            <Button variant="outline" size="icon" onClick={() => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-black uppercase text-slate-500">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((d)=><div key={d}>{d}</div>)}</div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {monthDays.map((date, index) => {
                const dayTasks = date ? tasks.filter((task) => task.date === date) : [];
                const doneCount = dayTasks.filter((task) => task.status === "Concluída").length;
                const pendingCount = dayTasks.length - doneCount;
                const isSelected = date === selectedDate;
                return (
                  <button type="button" key={`${date || "blank"}-${index}`} disabled={!date} onClick={() => date && (setSelectedDate(date), setDayPanelMode("view"), setDayPanelOpen(true))}
                    className={`min-h-28 rounded-2xl border p-2 text-left transition hover:shadow-md ${isSelected ? "border-orange-600 bg-orange-50 ring-2 ring-orange-200" : "bg-white"} ${!date ? "cursor-default opacity-0" : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${isSelected ? "bg-orange-600 text-white" : "bg-slate-100"}`}>{date ? Number(date.slice(8,10)) : ""}</span>
                      {dayTasks.length > 0 && <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs font-bold text-white">{dayTasks.length}</span>}
                    </div>
                    <div className="mt-2 space-y-1">{dayTasks.slice(0,3).map((task)=><div key={task.id} className={`truncate rounded-lg px-2 py-1 text-[11px] font-semibold ${task.status === "Concluída" ? "bg-green-100 text-green-700" : task.status === "Atrasada" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>{task.title}</div>)}</div>
                    {dayTasks.length > 0 && <div className="mt-2 flex gap-1 text-[10px] font-bold"><span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">{doneCount} feitas</span><span className="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-700">{pendingCount} pend.</span></div>}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="space-y-4">
            <div className="rounded-2xl bg-emerald-950 p-4 text-white"><p className="text-sm text-emerald-100">Dia selecionado</p><p className="text-2xl font-black">{selectedDate.split("-").reverse().join("/")}</p></div>
            <div className="rounded-2xl border bg-white p-4">
              <h3 className="mb-3 flex items-center gap-2 font-black"><Plus className="h-4 w-4 text-orange-600" /> Ações do dia</h3>
              <div className="grid gap-2">
                <Button onClick={() => {setDayPanelOpen(true); setDayPanelMode("create")}} className="w-full bg-orange-600 hover:bg-orange-700"><Plus className="mr-2 h-4 w-4" /> Cadastrar demanda</Button>
                <Button variant="outline" onClick={() => {setDayPanelOpen(true); setDayPanelMode("view")}} className="w-full"><FileText className="mr-2 h-4 w-4" /> Visualizar demandas do dia</Button>
              </div>
            </div>
            <div className="rounded-2xl border bg-white p-4">
              <h3 className="mb-3 flex items-center gap-2 font-black"><FileText className="h-4 w-4 text-orange-600" /> Atividades do dia</h3>
              <div className="max-h-80 space-y-2 overflow-auto pr-1">
                {selectedTasks.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Nenhuma atividade cadastrada neste dia.</p>}
                {selectedTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2"><p className="text-sm font-black">{task.title}</p><Badge tone={task.status === "Concluída" ? "low" : task.status === "Atrasada" ? "high" : "medium"}>{task.status}</Badge></div>
                    <p className="mt-1 text-xs text-slate-500">{task.responsible} • {task.workflow}</p>
                    <p className="mt-2 text-xs text-slate-600">{task.notes}</p>
                    <p className="mt-2 text-xs font-bold text-red-600">Data para atraso: {task.overdueDate || task.internalDeadline}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "Concluída")}><Check className="mr-1 h-3 w-3" /> Feita</Button>
                      <Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "A fazer")}><RotateCcw className="mr-1 h-3 w-3" /> Reabrir</Button>
                      <Button size="sm" variant="outline" onClick={() => postponeTask(task)}><Clock className="mr-1 h-3 w-3" /> Postergar</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteTask(task.id)} className="text-red-600"><Trash2 className="mr-1 h-3 w-3" /> Excluir</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        {dayPanelOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-emerald-950 p-5 text-white md:flex-row md:items-center md:justify-between">
                <div><p className="text-xs font-black uppercase tracking-[0.25em] text-orange-300">Calendário visual</p><h3 className="text-2xl font-black">{selectedDate.split("-").reverse().join("/")}</h3></div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setDayPanelMode("create")} className="!bg-orange-600 !text-white hover:!bg-orange-700 shadow-lg shadow-orange-900/20"><Plus className="mr-2 h-4 w-4" /> Cadastrar demanda</Button>
                  <Button variant="secondary" onClick={() => setDayPanelMode("view")} className="!bg-white/10 !text-white hover:!bg-white/20 ring-1 ring-white/10"><FileText className="mr-2 h-4 w-4" /> Ver demandas</Button>
                  <Button variant="secondary" onClick={() => setDayPanelOpen(false)} className="!bg-white !text-emerald-950 hover:!bg-slate-100 shadow-lg">Fechar</Button>
                </div>
              </div>
              <div className="p-5">
                {dayPanelMode === "create" ? (
                  <div className="rounded-2xl border bg-slate-50 p-5">
                    <h4 className="mb-4 flex items-center gap-2 text-xl font-black"><Plus className="h-5 w-5 text-orange-600" /> Nova demanda para este dia</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input placeholder="Título da demanda" value={quickTitle} onChange={(e) => setQuickTitle(e.target.value)} />
                      <select value={quickResponsible} onChange={(e) => setQuickResponsible(e.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm"><option value="">Selecione o responsável</option>{activeUsers.map((u)=><option key={u.id} value={u.id}>{u.warName || u.name}</option>)}</select>
                      <select value={quickType} onChange={(e) => setQuickType(e.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm"><option>Inteligência</option><option>Dossiê</option><option>Operacional</option><option>Relatório</option><option>Gestão</option></select>
                      <select value={quickPriority} onChange={(e) => setQuickPriority(e.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm"><option>Baixa</option><option>Média</option><option>Alta</option><option>Crítica</option></select>
                      <div><label className="mb-1 block text-xs font-bold text-slate-500">Data para atraso da demanda</label><Input type="date" value={quickOverdueDate} onChange={(e) => setQuickOverdueDate(e.target.value)} /></div>
                      <textarea className="min-h-28 rounded-md border bg-white p-3 text-sm md:col-span-2" placeholder="Informações da demanda" value={quickNotes} onChange={(e) => setQuickNotes(e.target.value)} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2"><Button onClick={saveQuickTask} className="bg-orange-600 hover:bg-orange-700"><Plus className="mr-2 h-4 w-4" /> Salvar demanda</Button><Button variant="outline" onClick={() => setDayPanelMode("view")}>Cancelar</Button></div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 flex items-center justify-between"><h4 className="text-xl font-black">Demandas cadastradas neste dia</h4><Badge tone="dark">{selectedTasks.length} demandas</Badge></div>
                    <div className="grid gap-3">
                      {selectedTasks.length === 0 && <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Nenhuma demanda cadastrada neste dia.</p>}
                      {selectedTasks.map((task)=><div key={task.id} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h5 className="text-lg font-black">{task.title}</h5><Badge tone={task.status === "Concluída" ? "low" : task.status === "Atrasada" ? "high" : "medium"}>{task.status}</Badge></div><p className="mt-2 text-sm text-slate-600">{task.notes}</p><p className="mt-2 text-xs text-slate-500">Responsável: {task.responsible} • Workflow: {task.workflow}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "Concluída")}><Check className="mr-1 h-3 w-3" /> Feita</Button><Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "A fazer")}><RotateCcw className="mr-1 h-3 w-3" /> Reabrir</Button><Button size="sm" variant="outline" onClick={() => postponeTask(task)}><Clock className="mr-1 h-3 w-3" /> Postergar</Button><Button size="sm" variant="outline" onClick={() => deleteTask(task.id)} className="text-red-600"><Trash2 className="mr-1 h-3 w-3" /> Excluir</Button></div></div></div>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UserManagement({ users = [], addUser, deleteUser, toggleUserStatus }) {
  const safeUsers = Array.isArray(users) ? users.filter(Boolean) : [];
  const emptyForm = { name: "", warName: "", register: "", unit: "", role: "Analista", email: "", phone: "", login: "", password: "", status: "Ativo" };
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");

  const activeUsers = safeUsers.filter((user) => (user?.status || "") === "Ativo").length;
  const inactiveUsers = safeUsers.length - activeUsers;
  const admins = safeUsers.filter((user) => (user?.role || "").toLowerCase().includes("administrador")).length;

  const filteredUsers = safeUsers.filter((user) => {
    const haystack = [
      user?.name,
      user?.warName,
      user?.login,
      user?.role,
      user?.unit,
      user?.email,
      user?.phone,
      user?.register,
    ].filter(Boolean).join(" ").toLowerCase();

    return haystack.includes((query || "").toLowerCase());
  });

  const updateForm = (field, value) => setForm({ ...form, [field]: value });

  const saveUser = () => {
    if (!form.name.trim() || !form.login.trim() || !form.password.trim()) {
      alert("Informe nome completo, login e senha provisória.");
      return;
    }
    addUser(form);
    setForm(emptyForm);
  };

  return (
    <SafeBlock title="Falha ao abrir cadastro de usuários">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-slate-950 to-black text-white shadow-2xl">
          <div className="relative p-7">
            <div className="absolute right-8 top-6 text-8xl opacity-10">🦉</div>
            <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-orange-300">Administração do sistema</p>
                <h2 className="mt-2 text-3xl font-black">Cadastro e gestão de usuários</h2>
                <p className="mt-2 max-w-2xl text-sm text-emerald-100">Gerencie perfis, responsáveis, gestores, analistas e colaboradores. Esta tela é exclusiva do administrador.</p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-3xl bg-white/10 px-5 py-4 ring-1 ring-white/10"><p className="text-3xl font-black">{safeUsers.length}</p><p className="text-xs text-emerald-100">Total</p></div>
                <div className="rounded-3xl bg-green-500/20 px-5 py-4 ring-1 ring-green-300/20"><p className="text-3xl font-black">{activeUsers}</p><p className="text-xs text-green-100">Ativos</p></div>
                <div className="rounded-3xl bg-orange-500/20 px-5 py-4 ring-1 ring-orange-300/20"><p className="text-3xl font-black">{admins}</p><p className="text-xs text-orange-100">Admins</p></div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[430px_1fr]">
          <Card className="rounded-[2rem] border-0 bg-white/95 soft-card ring-1 ring-slate-200/70">
            <CardContent className="p-6">
              <h3 className="mb-1 flex items-center gap-2 text-xl font-black"><Settings className="h-5 w-5 text-orange-600" /> Novo usuário</h3>
              <p className="mb-5 text-sm text-slate-500">Crie um usuário que poderá receber demandas e acessar o sistema.</p>
              <div className="grid gap-3">
                <Input placeholder="Nome completo" value={form.name} onChange={(e) => updateForm("name", e.target.value)} />
                <Input placeholder="Nome de guerra / identificação" value={form.warName} onChange={(e) => updateForm("warName", e.target.value)} />
                <div className="grid gap-3 md:grid-cols-2">
                  <Input placeholder="Matrícula" value={form.register} onChange={(e) => updateForm("register", e.target.value)} />
                  <Input placeholder="Unidade" value={form.unit} onChange={(e) => updateForm("unit", e.target.value)} />
                </div>
                <select value={form.role} onChange={(e) => updateForm("role", e.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">{userRoles.map((role)=><option key={role}>{role}</option>)}</select>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input placeholder="E-mail" value={form.email} onChange={(e) => updateForm("email", e.target.value)} />
                  <Input placeholder="Telefone" value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input placeholder="Login" value={form.login} onChange={(e) => updateForm("login", e.target.value)} />
                  <Input placeholder="Senha provisória" type="password" value={form.password} onChange={(e) => updateForm("password", e.target.value)} />
                </div>
                <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm"><option>Ativo</option><option>Inativo</option></select>
                <Button onClick={saveUser} className="h-11 bg-orange-600 text-white hover:bg-orange-700"><UserPlus className="mr-2 h-4 w-4" /> Cadastrar usuário</Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2rem] border-0 bg-white/95 soft-card ring-1 ring-slate-200/70">
            <CardContent className="p-6">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-black">Usuários cadastrados</h3>
                  <p className="text-sm text-slate-500">{filteredUsers.length} usuários exibidos</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input className="pl-9" placeholder="Pesquisar usuário" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
              </div>

              {safeUsers.length === 0 && (
                <div className="rounded-3xl border border-dashed bg-slate-50 p-8 text-center">
                  <Users className="mx-auto h-10 w-10 text-slate-400" />
                  <h4 className="mt-3 text-lg font-black">Nenhum usuário carregado</h4>
                  <p className="mt-1 text-sm text-slate-500">Verifique se a política RLS de SELECT da tabela app_users está ativa.</p>
                </div>
              )}

              <div className="grid gap-3">
                {filteredUsers.map((user) => {
                  const label = user?.warName || user?.name || "Usuário";
                  const initials = String(label).slice(0, 2).toUpperCase();

                  return (
                    <div key={user?.id || user?.login || label} className="group rounded-3xl border bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm transition hover:border-orange-200 hover:shadow-md">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex gap-4">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-950 text-lg font-black text-white">{initials}</div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-black">{label}</h3>
                              <Badge tone={user?.status === "Ativo" ? "low" : "default"}>{user?.status || "Ativo"}</Badge>
                              <Badge tone={user?.role === "Administrador" ? "high" : user?.role === "Gestor" ? "medium" : "default"}>{user?.role || "Colaborador"}</Badge>
                            </div>
                            <p className="mt-1 text-sm text-slate-600">{user?.name || "Nome não informado"} • Matrícula: {user?.register || "não informada"}</p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <span className="rounded-full bg-emerald-950 px-3 py-1 font-bold text-white"><Activity className="mr-1 inline h-3 w-3" /> {user?.login || "sem login"}</span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700"><Building2 className="mr-1 inline h-3 w-3" /> {user?.unit || "Unidade não informada"}</span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700"><Mail className="mr-1 inline h-3 w-3" /> {user?.email || "Sem e-mail"}</span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700"><Phone className="mr-1 inline h-3 w-3" /> {user?.phone || "Sem telefone"}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => toggleUserStatus(user)}>{user?.status === "Ativo" ? "Inativar" : "Ativar"}</Button>
                          <Button size="sm" variant="outline" onClick={() => deleteUser(user)} className="text-red-600"><Trash2 className="mr-1 h-3 w-3" /> Excluir</Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </SafeBlock>
  )
}
function DemandCenter({ status, tasks, onBack, updateTaskStatus, deleteTask, duplicateTask, toggleChecklistItem, postponeTask }) {
  const [selectedId, setSelectedId] = useState(tasks[0]?.id || null);
  const [query, setQuery] = useState("");
  const visibleTasks = tasks.filter((task) => `${task.title} ${task.responsible} ${task.workflow} ${task.notes}`.toLowerCase().includes(query.toLowerCase()));
  const selectedTask = visibleTasks.find((task) => task.id === selectedId) || visibleTasks[0];
  const title = status === "Todas" ? "CENTRAL DE DEMANDAS" : `DEMANDAS ${status.toUpperCase()}`;
  return (
    <Card className="rounded-[2rem] border-0 bg-white/90 soft-card ring-1 ring-slate-200/70">
      <CardContent className="p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="flex items-center gap-2 text-2xl font-black"><ClipboardCheck className="h-6 w-6 text-orange-600" /> {title}</h2><p className="text-sm text-slate-500">Tela aberta pelo card do dashboard, com demandas filtradas por status.</p></div><Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao painel</Button></div>
        <div className="mb-4 grid gap-3 md:grid-cols-4"><Input className="md:col-span-2" placeholder="Pesquisar demanda, responsável ou workflow" value={query} onChange={(e) => setQuery(e.target.value)} /><div className="rounded-2xl bg-emerald-950 px-4 py-3 text-center font-bold text-white">{visibleTasks.length} demandas</div><Button className="bg-orange-600 hover:bg-orange-700" onClick={() => alert("Use o calendário para criar uma nova demanda.")}><Plus className="mr-2 h-4 w-4" /> Nova demanda</Button></div>
        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className="space-y-3">{visibleTasks.length === 0 && <div className="rounded-2xl border bg-white p-5 text-sm text-slate-500">Nenhuma demanda encontrada neste status.</div>}{visibleTasks.map((task)=><button key={task.id} type="button" onClick={()=>setSelectedId(task.id)} className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md ${selectedTask?.id === task.id ? "border-orange-600 ring-2 ring-orange-100" : ""}`}><div className="flex items-start justify-between gap-3"><div><h3 className="font-black">{task.title}</h3><p className="mt-1 text-xs text-slate-500">Responsável: {task.responsible}</p></div><Badge tone={task.status === "Concluída" ? "low" : task.status === "Atrasada" ? "high" : "medium"}>{task.status}</Badge></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-50 p-2"><b>Interno:</b> {task.internalDeadline}</div><div className="rounded-lg bg-slate-50 p-2"><b>Oficial:</b> {task.officialDeadline}</div></div></button>)}</div>
          {selectedTask && <div className="rounded-3xl border bg-white p-5 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.25em] text-orange-600">Demanda</p><h3 className="mt-2 text-2xl font-black">{selectedTask.title}</h3><p className="mt-2 text-sm text-slate-600">{selectedTask.notes}</p></div><Badge tone={selectedTask.status === "Concluída" ? "low" : selectedTask.status === "Atrasada" ? "high" : "medium"}>{selectedTask.status}</Badge></div><div className="mt-5 grid gap-3 md:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><b>Tipo:</b> {selectedTask.type}</div><div className="rounded-2xl bg-slate-50 p-4"><b>Workflow:</b> {selectedTask.workflow}</div><div className="rounded-2xl bg-slate-50 p-4"><b>Responsável:</b> {selectedTask.responsible}</div><div className="rounded-2xl bg-slate-50 p-4"><b>Gestor:</b> {selectedTask.manager}</div><div className="rounded-2xl bg-slate-50 p-4"><b>Prazo interno:</b> {selectedTask.internalDeadline}</div><div className="rounded-2xl bg-slate-50 p-4"><b>Prazo oficial:</b> {selectedTask.officialDeadline}</div></div><div className="mt-5"><h4 className="mb-3 font-black"><ClipboardCheck className="mr-1 inline h-4 w-4 text-orange-600" /> Checklist da demanda</h4><div className="grid gap-2 md:grid-cols-2">{selectedTask.checklist.map((item,index)=><label key={item} className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm"><input type="checkbox" checked={selectedTask.done[index]} onChange={()=>toggleChecklistItem(selectedTask,index)} /> {item}</label>)}</div></div><div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" onClick={() => alert(`Visualizando demanda: ${selectedTask.title}`)}><Eye className="mr-1 h-4 w-4" /> Visualizar</Button><Button variant="outline" onClick={() => alert("Edição completa será adicionada em etapa futura.")}><Edit3 className="mr-1 h-4 w-4" /> Editar</Button><Button variant="outline" onClick={() => duplicateTask(selectedTask)}><Copy className="mr-1 h-4 w-4" /> Duplicar</Button><Button variant="outline" onClick={() => updateTaskStatus(selectedTask.id, "Concluída")}><Check className="mr-1 h-4 w-4" /> Encerrar</Button><Button variant="outline" onClick={() => updateTaskStatus(selectedTask.id, "A fazer")}><RotateCcw className="mr-1 h-4 w-4" /> Reabrir</Button><Button variant="outline" onClick={() => postponeTask(selectedTask)}><Clock className="mr-1 h-4 w-4" /> Postergar</Button><Button variant="outline" className="text-red-600" onClick={() => deleteTask(selectedTask.id)}><Trash2 className="mr-1 h-4 w-4" /> Excluir</Button></div></div>}
        </div>
      </CardContent>
    </Card>
  )
}

function ProcessTracker({ tasks, workflows, setTaskWorkflow, setTaskStatus }) {
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) || tasks[0];
  const currentStep = selectedTask ? Math.max(0, workflows.findIndex((w) => w.id === selectedTask.workflowId)) : 0;
  const progress = selectedTask && workflows.length > 0 ? Math.round(((currentStep + 1) / workflows.length) * 100) : 0;
  const advanceToStep = (workflow) => {
    if (!selectedTask) return;
    setTaskWorkflow(selectedTask, workflow);
    if (workflow.position === Math.max(...workflows.map((w) => w.position))) setTaskStatus(selectedTask.id, "Concluída");
    else if (selectedTask.status === "Concluída") setTaskStatus(selectedTask.id, "A fazer");
  };
  return (
    <Card className="rounded-3xl border-0 bg-emerald-950 text-white shadow-sm"><CardContent className="p-6"><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><h2 className="text-xl font-black">Acompanhamento do processo</h2><p className="mt-2 text-sm text-emerald-100">Selecione uma demanda e clique nas etapas até chegar a 100%.</p></div><div className="rounded-2xl bg-white/10 px-5 py-3 text-center"><p className="text-3xl font-black">{selectedTask ? progress : 0}%</p><p className="text-xs text-emerald-100">Andamento</p></div></div><select value={selectedTask?.id || ""} onChange={(e)=>setSelectedTaskId(e.target.value)} className="mb-5 h-11 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-sm text-white">{tasks.map((task)=><option key={task.id} value={task.id} className="text-slate-900">{task.title}</option>)}</select>{selectedTask && <div><div className="mb-4 rounded-2xl bg-white/10 p-4"><p className="text-sm text-emerald-100">Demanda selecionada</p><h3 className="text-lg font-black">{selectedTask.title}</h3><p className="mt-1 text-xs text-emerald-100">Responsável: {selectedTask.responsible} • Status: {selectedTask.status}</p></div><div className="mb-5 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-orange-500 transition-all" style={{width:`${progress}%`}} /></div><div className="grid gap-3 md:grid-cols-5">{workflows.map((workflow,index)=>{const reached=index<=currentStep;const current=workflow.id===selectedTask.workflowId;return <button key={workflow.id} type="button" onClick={()=>advanceToStep(workflow)} className={`rounded-2xl border p-4 text-left transition hover:scale-[1.02] ${reached ? "border-orange-400 bg-orange-500 text-white" : "border-white/10 bg-white/10 text-emerald-50"} ${current ? "ring-2 ring-white" : ""}`}><p className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-sm font-black">{index+1}</p><p className="text-sm font-black">{workflow.name}</p><p className="mt-1 text-xs opacity-80">{current ? "Etapa atual" : reached ? "Já alcançada" : "Clique para avançar"}</p></button>})}</div></div>}</CardContent></Card>
  )
}

function AuditPanel({ logs }) {
  return <Card className="rounded-[2rem] border-0 bg-white/90 soft-card ring-1 ring-slate-200/70"><CardContent className="p-6"><div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><h2 className="flex items-center gap-2 text-xl font-black"><Activity className="h-5 w-5 text-orange-600" /> Auditoria do sistema</h2><p className="text-sm text-slate-500">Histórico de ações registradas no Supabase.</p></div><Badge tone="dark">{logs.length} registros</Badge></div><div className="max-h-[520px] space-y-3 overflow-auto pr-1">{logs.length === 0 && <div className="rounded-2xl border bg-white p-5 text-sm text-slate-500">Nenhuma ação registrada ainda.</div>}{logs.map((log)=><div key={log.id} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"><div><p className="text-sm font-black text-slate-900">{log.action}</p><p className="mt-1 text-sm text-slate-600">{log.details}</p><p className="mt-2 text-xs text-slate-500">Usuário: <b>{log.user_name}</b> • Perfil: <b>{log.user_role}</b></p></div><Badge tone="medium">{new Date(log.created_at).toLocaleString("pt-BR")}</Badge></div></div>)}</div></CardContent></Card>
}

function TVPanel({ tasks, users, counts, onClose }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const pending = tasks.filter((t) => t.status !== "Concluída").length;
  const activeUsers = users.filter((u) => u.status === "Ativo").length;
  const lateTasks = tasks.filter((t) => t.status === "Atrasada");
  const riskTasks = tasks.filter((t) => t.status === "Risco de prazo");
  const todayTasks = tasks.filter((t) => t.date === today);
  const done = counts["Concluída"] || 0;
  const performance = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const topResponsible = users
    .filter((user) => user.status === "Ativo")
    .map((user) => {
      const label = user.warName || user.name;
      return { label, total: tasks.filter((task) => task.responsible === label && task.status !== "Concluída").length };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-[#020617] p-6 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(234,88,12,0.22),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(16,185,129,0.18),transparent_30%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-[1.7rem] bg-orange-600 text-4xl shadow-xl shadow-orange-950/40">🦉</div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.45em] text-orange-300">● Ao vivo • atualização automática</p>
                <h1 className="mt-1 text-5xl font-black tracking-tight">SI 6ª CIA</h1>
                <p className="mt-1 text-sm text-emerald-200">Demandas • prazos • responsáveis • risco operacional</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-3xl bg-white/10 px-5 py-3 text-right ring-1 ring-white/10">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-300">Atualizado</p>
                <p className="text-lg font-black">{now.toLocaleString("pt-BR")}</p>
              </div>
              <Button onClick={onClose} className="bg-white text-slate-950 hover:bg-slate-200">Fechar TV</Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-5">
          <div className="rounded-[1.7rem] bg-blue-600 p-6 shadow-xl"><p className="text-sm font-bold opacity-90">A fazer</p><p className="mt-2 text-5xl font-black">{counts["A fazer"]||0}</p></div>
          <div className="rounded-[1.7rem] bg-red-600 p-6 shadow-xl"><p className="text-sm font-bold opacity-90">Atrasadas</p><p className="mt-2 text-5xl font-black">{counts["Atrasada"]||0}</p></div>
          <div className="rounded-[1.7rem] bg-zinc-700 p-6 shadow-xl"><p className="text-sm font-bold opacity-90">Paralisadas</p><p className="mt-2 text-5xl font-black">{counts["Paralisada"]||0}</p></div>
          <div className="rounded-[1.7rem] bg-yellow-500 p-6 text-slate-950 shadow-xl"><p className="text-sm font-black opacity-90">Risco de prazo</p><p className="mt-2 text-5xl font-black">{counts["Risco de prazo"]||0}</p></div>
          <div className="rounded-[1.7rem] bg-green-600 p-6 shadow-xl"><p className="text-sm font-bold opacity-90">Concluídas</p><p className="mt-2 text-5xl font-black">{counts["Concluída"]||0}</p></div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr_1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-300">Resumo operacional</p>
            <div className="mt-5 grid gap-3">
              <div className="flex justify-between rounded-2xl bg-white/10 p-4"><span>Total de demandas</span><b>{tasks.length}</b></div>
              <div className="flex justify-between rounded-2xl bg-white/10 p-4"><span>Pendências</span><b>{pending}</b></div>
              <div className="flex justify-between rounded-2xl bg-white/10 p-4"><span>Usuários ativos</span><b>{activeUsers}</b></div>
              <div className="flex justify-between rounded-2xl bg-white/10 p-4"><span>Demandas de hoje</span><b>{todayTasks.length}</b></div>
            </div>
            <div className="mt-5">
              <div className="mb-2 flex justify-between text-sm"><span>Taxa de conclusão</span><b>{performance}%</b></div>
              <div className="h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-orange-500" style={{width:`${performance}%`}} /></div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-red-400/20 bg-red-500/10 p-6 backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-red-300">Demandas atrasadas</p>
            <div className="mt-5 space-y-3">
              {lateTasks.slice(0,6).map((t)=><div key={t.id} className="rounded-2xl bg-red-500/20 p-4 ring-1 ring-red-300/10"><p className="font-black">{t.title}</p><p className="text-xs text-red-100">{t.responsible} • atraso: {t.overdueDate || t.internalDeadline}</p></div>)}
              {lateTasks.length===0 && <p className="rounded-2xl bg-white/10 p-4 text-sm text-slate-300">Nenhuma demanda atrasada.</p>}
            </div>
          </div>

          <div className="rounded-[2rem] border border-yellow-300/20 bg-yellow-500/10 p-6 backdrop-blur">
            <p className="text-sm font-black uppercase tracking-[0.25em] text-yellow-300">Risco de prazo</p>
            <div className="mt-5 space-y-3">
              {riskTasks.slice(0,6).map((t)=><div key={t.id} className="rounded-2xl bg-yellow-500/20 p-4 ring-1 ring-yellow-300/10"><p className="font-black">{t.title}</p><p className="text-xs text-yellow-100">{t.responsible} • prazo: {t.officialDeadline}</p></div>)}
              {riskTasks.length===0 && <p className="rounded-2xl bg-white/10 p-4 text-sm text-slate-300">Nenhuma demanda em risco.</p>}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="mb-5 text-sm font-black uppercase tracking-[0.25em] text-emerald-300">Pendências por responsável</p>
          <div className="grid gap-3 md:grid-cols-5">
            {topResponsible.map((item)=><div key={item.label} className="rounded-3xl bg-white/10 p-5 text-center ring-1 ring-white/10"><p className="text-4xl font-black">{item.total}</p><p className="mt-1 text-sm text-slate-300">{item.label}</p></div>)}
            {topResponsible.length===0 && <p className="text-sm text-slate-300">Nenhum responsável ativo encontrado.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}

function SafeBlock({ children, title = "Falha ao carregar esta tela" }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handler = (event) => {
      console.error("Erro capturado:", event.error || event.message);
      setHasError(true);
    };
    window.addEventListener("error", handler);
    return () => window.removeEventListener("error", handler);
  }, []);

  if (hasError) {
    return (
      <Card className="rounded-[2rem] border-0 bg-white/95 soft-card ring-1 ring-red-200">
        <CardContent className="p-6">
          <h2 className="text-xl font-black text-red-600">{title}</h2>
          <p className="mt-2 text-sm text-slate-600">
            A tela encontrou um dado inválido vindo do banco. Atualize a página; se persistir, verifique os campos obrigatórios dos usuários no Supabase.
          </p>
          <Button className="mt-4 bg-orange-600 text-white hover:bg-orange-700" onClick={() => window.location.reload()}>
            Recarregar sistema
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}


export default function App() {
  const [logged, setLogged] = useState(() => Boolean(localStorage.getItem("si6_session_user")));
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("si6_session_user") || "null"); } catch { return null; }
  });
  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState("Todas");
  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newResponsible, setNewResponsible] = useState("");
  const [newWorkflow, setNewWorkflow] = useState("");
  const [workflows, setWorkflows] = useState([]);
  const [workflowName, setWorkflowName] = useState("");
  const [monthDate, setMonthDate] = useState(new Date());
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [message, setMessage] = useState("");
  const [demandScreenStatus, setDemandScreenStatus] = useState(null);
  const [currentView, setCurrentView] = useState("painel");
  const [tvOpen, setTvOpen] = useState(false);

  const counts = useMemo(() => getStatusCounts(tasks), [tasks]);
  const isAdmin = (currentUser?.role || "").toLowerCase().includes("administrador") || (currentUser?.login || "").toUpperCase() === "ADM6CIA";

  const notify = (text) => { setMessage(text); window.setTimeout(() => setMessage(""), 2500); };

  async function addAudit(action, details) {
    if (!currentUser) return;
    await supabase.from("audit_logs").insert({
      user_id: currentUser.id,
      user_name: currentUser.warName || currentUser.name,
      user_role: currentUser.role,
      action,
      details,
    });
  }

  async function loadData() {
    const [usersRes, workflowsRes, tasksRes, logsRes] = await Promise.all([
      supabase.from("app_users").select("id,name,war_name,register,unit,role,email,phone,login,status").order("created_at", { ascending: false }),
      supabase.from("workflows").select("*").order("position", { ascending: true }),
      supabase.from("demands").select("*, responsible:app_users!demands_responsible_id_fkey(*), manager:app_users!demands_manager_id_fkey(*), workflow:workflows(*)").order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    if (usersRes.error) {
      console.error("Erro ao carregar usuários:", usersRes.error);
      notify("Erro ao carregar usuários do Supabase. Verifique permissões RLS.");
    }
    if (usersRes.data) setUsers(usersRes.data.map(normalizeUser));
    if (workflowsRes.data) setWorkflows(workflowsRes.data.map(normalizeWorkflow));
    if (tasksRes.data) setTasks(tasksRes.data.map(normalizeTask));
    if (logsRes.data) setAuditLogs(logsRes.data);
  }

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const channel = supabase.channel("si6cia-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_users" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "workflows" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "demands" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, loadData)
      .subscribe();

    const refreshTimer = window.setInterval(() => {
      loadData();
    }, 15000);

    return () => {
      window.clearInterval(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, []);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const byDate = task.date === selectedDate;
    const byStatus = statusFilter === "Todas" || task.status === statusFilter;
    const bySearch = `${task.title} ${task.type} ${task.responsible} ${task.notes}`.toLowerCase().includes(search.toLowerCase());
    return byDate && byStatus && bySearch;
  }), [tasks, selectedDate, statusFilter, search]);

  async function handleLogin(login, password) {
    const { data, error } = await supabase.rpc("login_user", { p_login: login, p_password: password });
    if (error || !data || data.length === 0) return alert("Usuário ou senha inválidos, ou usuário inativo.");
    const user = normalizeUser(data[0]);
    setCurrentUser(user); setLogged(true); localStorage.setItem("si6_session_user", JSON.stringify(user));
    await addAudit("Login", `Usuário ${user.warName || user.name} acessou o sistema.`);
  }

  async function addUser(user) {
    const loginExists = users.some((item) => item.login.toLowerCase() === user.login.toLowerCase());
    if (loginExists) return notify("Já existe usuário com esse login.");
    const { error } = await supabase.rpc("create_app_user", {
      p_name: user.name,
      p_war_name: user.warName || user.name,
      p_register: user.register,
      p_unit: user.unit,
      p_role: user.role,
      p_email: user.email,
      p_phone: user.phone,
      p_login: user.login,
      p_password: user.password,
      p_status: user.status,
    });
    if (error) return notify("Erro ao cadastrar usuário.");
    await addAudit("Usuário cadastrado", `Cadastrou o usuário: ${user.warName || user.name}.`);
    notify("Usuário cadastrado com sucesso.");
    loadData();
  }

  async function deleteUser(user) {
    if ((user?.login || "").toUpperCase() === "ADM6CIA") return notify("O administrador principal não pode ser excluído.");
    const { error } = await supabase.from("app_users").delete().eq("id", user?.id);
    if (error) return notify("Erro ao excluir usuário.");
    await addAudit("Usuário removido", `Removeu o usuário: ${user.warName || user.name}.`);
    notify("Usuário removido.");
  }

  async function toggleUserStatus(user) {
    const status = user?.status === "Ativo" ? "Inativo" : "Ativo";
    const { error } = await supabase.from("app_users").update({ status }).eq("id", user?.id);
    if (error) return notify("Erro ao alterar usuário.");
    await addAudit("Situação de usuário alterada", `Alterou ${user.warName || user.name} para ${status}.`);
    notify("Situação do usuário alterada.");
  }

  async function addTask() {
    if (!newTitle.trim()) return notify("Informe o nome da tarefa antes de cadastrar.");
    if (!newResponsible) return notify("Selecione um responsável cadastrado.");
    const wf = workflows.find((w) => w.id === newWorkflow) || workflows[0];
    const { error } = await supabase.from("demands").insert({
      title: newTitle,
      type: "Inteligência",
      status: "A fazer",
      priority: "Média",
      responsible_id: newResponsible,
      manager_id: currentUser?.id || null,
      date: selectedDate,
      official_deadline: selectedDate,
      internal_deadline: selectedDate,
      overdue_date: selectedDate,
      workflow_id: wf?.id || null,
      checklist: ["Triar demanda", "Executar atividade", "Registrar conclusão"],
      done: [false, false, false],
      notes: "Nova demanda cadastrada no painel.",
    });
    if (error) return notify("Erro ao cadastrar tarefa.");
    await addAudit("Demanda criada", `Criou a demanda: ${newTitle}.`);
    setNewTitle(""); setNewResponsible("");
    notify("Tarefa cadastrada com sucesso.");
  }

  async function addQuickTask({ title, responsibleId, date, type = "Inteligência", priority = "Média", notes, overdueDate }) {
    if (!responsibleId) return notify("Selecione um responsável cadastrado.");
    const wf = workflows[0];
    const { error } = await supabase.from("demands").insert({
      title, type, status: "A fazer", priority, responsible_id: responsibleId, manager_id: currentUser?.id || null,
      date, official_deadline: date, internal_deadline: date, overdue_date: overdueDate || date,
      workflow_id: wf?.id || null,
      checklist: ["Triar demanda", "Executar atividade", "Registrar conclusão"],
      done: [false, false, false],
      notes,
    });
    if (error) return notify("Erro ao adicionar atividade.");
    await addAudit("Demanda criada pelo calendário", `Criou a demanda: ${title}.`);
    notify("Atividade adicionada ao calendário.");
  }

  async function deleteTask(id) {
    const { error } = await supabase.from("demands").delete().eq("id", id);
    if (error) return notify("Erro ao excluir tarefa.");
    await addAudit("Demanda excluída", "Excluiu uma demanda.");
    notify("Tarefa excluída.");
  }

  async function updateTaskStatus(id, status) {
    const task = tasks.find((item) => item.id === id);
    const values = { status };
    if (task && status === "Concluída") values.done = task.checklist.map(() => true);
    const { error } = await supabase.from("demands").update(values).eq("id", id);
    if (error) return notify("Erro ao atualizar status.");
    await addAudit("Status atualizado", `Alterou o status da demanda para: ${status}.`);
    notify("Status da tarefa atualizado.");
  }

  async function toggleChecklistItem(task, itemIndex) {
    const nextDone = task.done.map((done, index) => (index === itemIndex ? !done : done));
    const allDone = nextDone.every(Boolean);
    const { error } = await supabase.from("demands").update({ done: nextDone, status: allDone ? "Concluída" : task.status === "Concluída" ? "A fazer" : task.status }).eq("id", task.id);
    if (error) return notify("Erro ao alterar checklist.");
    await addAudit("Checklist alterado", `Alterou item de checklist da demanda: ${task.title}.`);
  }

  async function postponeTask(task) {
    const currentDate = task.overdueDate || task.internalDeadline || selectedDate;
    const newDate = window.prompt("Informe a nova data de atraso da demanda (AAAA-MM-DD):", currentDate);
    if (!newDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return notify("Data inválida. Use o formato AAAA-MM-DD.");
    const { error } = await supabase.from("demands").update({ overdue_date: newDate, internal_deadline: newDate, status: task.status === "Atrasada" ? "A fazer" : task.status }).eq("id", task.id);
    if (error) return notify("Erro ao postergar demanda.");
    await addAudit("Demanda postergada", `Postergou a demanda ${task.title} para ${newDate}.`);
    notify("Demanda postergada com sucesso.");
  }

  async function duplicateTask(task) {
    const wf = workflows.find((w) => w.name === task.workflow);
    const { error } = await supabase.from("demands").insert({
      title: `${task.title} - cópia`,
      type: task.type,
      status: "A fazer",
      priority: task.priority,
      responsible_id: task.responsibleId,
      manager_id: currentUser?.id || null,
      date: task.date,
      official_deadline: task.officialDeadline,
      internal_deadline: task.internalDeadline,
      overdue_date: task.overdueDate,
      workflow_id: wf?.id || task.workflowId,
      checklist: task.checklist,
      done: task.checklist.map(() => false),
      notes: task.notes,
    });
    if (error) return notify("Erro ao duplicar demanda.");
    await addAudit("Demanda duplicada", `Duplicou a demanda: ${task.title}.`);
    notify("Demanda duplicada.");
  }

  async function addWorkflow() {
    const name = workflowName.trim();
    if (!name) return notify("Informe o nome do workflow.");
    if (workflows.some((workflow) => workflow.name.toLowerCase() === name.toLowerCase())) return notify("Esse workflow já existe.");
    const { error } = await supabase.from("workflows").insert({ name, position: workflows.length + 1 });
    if (error) return notify("Erro ao criar workflow.");
    await addAudit("Workflow criado", `Criou o workflow: ${name}.`);
    setWorkflowName("");
    notify("Workflow criado com sucesso.");
  }

  async function deleteWorkflow(workflow) {
    const workflowInUse = tasks.some((task) => task.workflowId === workflow.id);
    if (workflowInUse) return notify("Não é possível excluir workflow em uso.");
    const { error } = await supabase.from("workflows").delete().eq("id", workflow.id);
    if (error) return notify("Erro ao excluir workflow.");
    await addAudit("Workflow excluído", `Excluiu o workflow: ${workflow.name}.`);
    notify("Workflow excluído.");
  }

  async function setTaskWorkflow(task, workflow) {
    const { error } = await supabase.from("demands").update({ workflow_id: workflow.id }).eq("id", task.id);
    if (error) return notify("Erro ao alterar etapa.");
    await addAudit("Workflow da demanda atualizado", `Alterou ${task.title} para ${workflow.name}.`);
    notify("Etapa do processo atualizada.");
  }

  const openDemandScreen = (status) => {
    setDemandScreenStatus(status);
    setStatusFilter(status);
    setCurrentView("painel");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!logged) return <Login onLogin={handleLogin} />;

  return (
    <div className="min-h-screen operational-bg text-slate-900">
      {tvOpen && <TVPanel tasks={tasks} users={users} counts={counts} onClose={() => setTvOpen(false)} />}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-emerald-950/95 px-6 py-5 shadow-2xl shadow-emerald-950/20 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <OwlLogo />
          <div className="flex flex-wrap items-center gap-3 text-sm text-emerald-100">
            <Badge tone="dark"><UserRound className="mr-1 inline h-3 w-3" /> {currentUser?.warName || currentUser?.name || "Usuário"}</Badge>
            <Badge tone="dark"><Users className="mr-1 inline h-3 w-3" /> {users.filter((user) => user.status === "Ativo").length} usuários ativos</Badge>
            <Button variant="secondary" className="!bg-white/10 !text-white hover:!bg-white/20 ring-1 ring-white/10" onClick={() => { setCurrentView("painel"); setDemandScreenStatus(null); }}>Painel</Button>
            {isAdmin && <Button variant="secondary" className="!bg-white/10 !text-white hover:!bg-white/20 ring-1 ring-white/10" onClick={() => { setCurrentView("usuarios"); setDemandScreenStatus(null); }}>Usuários</Button>}
            <Button variant="secondary" className="!bg-white/10 !text-white hover:!bg-white/20 ring-1 ring-white/10" onClick={() => { setCurrentView("auditoria"); setDemandScreenStatus(null); }}>Auditoria</Button>
            <Button variant="secondary" className="!bg-orange-600 !text-white hover:!bg-orange-700 shadow-lg shadow-orange-900/20" onClick={() => setTvOpen(true)}>Tela TV</Button>
            <Button variant="secondary" className="!bg-white/10 !text-white hover:!bg-white/20 ring-1 ring-white/10" onClick={() => { setLogged(false); setCurrentUser(null); localStorage.removeItem("si6_session_user"); }}>Sair</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {message && <div className="fixed right-6 top-6 z-50 flex items-center gap-2 rounded-2xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white shadow-2xl"><CheckCircle2 className="h-4 w-4 text-orange-300" /> {message}</div>}

        {currentView === "painel" && (
          <>
            <section className="grid gap-4 md:grid-cols-5">
              <button type="button" onClick={() => openDemandScreen("A fazer")}><StatCard label="A fazer" value={counts["A fazer"] || 0} icon={ListChecks} className="bg-blue-500" /></button>
              <button type="button" onClick={() => openDemandScreen("Atrasada")}><StatCard label="Atrasadas" value={counts["Atrasada"] || 0} icon={AlertTriangle} className="bg-red-500" /></button>
              <button type="button" onClick={() => openDemandScreen("Paralisada")}><StatCard label="Paralisadas" value={counts["Paralisada"] || 0} icon={PauseCircle} className="bg-zinc-600" /></button>
              <button type="button" onClick={() => openDemandScreen("Risco de prazo")}><StatCard label="Risco de prazo" value={counts["Risco de prazo"] || 0} icon={Clock} className="bg-yellow-500" /></button>
              <button type="button" onClick={() => openDemandScreen("Concluída")}><StatCard label="Concluídas" value={counts["Concluída"] || 0} icon={CheckCircle2} className="bg-green-600" /></button>
            </section>

            {demandScreenStatus ? (
              <DemandCenter status={demandScreenStatus} tasks={tasks.filter((task) => task.status === demandScreenStatus)} onBack={() => setDemandScreenStatus(null)} updateTaskStatus={updateTaskStatus} deleteTask={deleteTask} duplicateTask={duplicateTask} toggleChecklistItem={toggleChecklistItem} postponeTask={postponeTask} />
            ) : (
              <CalendarBoard tasks={tasks} selectedDate={selectedDate} setSelectedDate={setSelectedDate} monthDate={monthDate} setMonthDate={setMonthDate} addQuickTask={addQuickTask} updateTaskStatus={updateTaskStatus} deleteTask={deleteTask} postponeTask={postponeTask} users={users} />
            )}

            <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
              <Card className="rounded-[2rem] border-0 bg-white/90 soft-card ring-1 ring-slate-200/70">
                <CardContent className="space-y-5 p-6">
                  <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-orange-600" /><h2 className="text-xl font-black">Calendário e nova demanda</h2></div>
                  <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                  <Input placeholder="Tarefa do dia / demanda" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                  <select value={newResponsible} onChange={(e) => setNewResponsible(e.target.value)} className="h-11 w-full rounded-md border bg-white px-3 text-sm"><option value="">Selecione o responsável</option>{users.filter((u)=>u.status==="Ativo").map((u)=><option key={u.id} value={u.id}>{u.warName || u.name}</option>)}</select>
                  <select value={newWorkflow} onChange={(e) => setNewWorkflow(e.target.value)} className="h-11 w-full rounded-md border bg-white px-3 text-sm">{workflows.map((item)=><option key={item.id} value={item.id}>{item.name}</option>)}</select>
                  <Button onClick={addTask} className="w-full bg-orange-600 hover:bg-orange-700"><Plus className="mr-2 h-4 w-4" /> Cadastrar tarefa</Button>
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] border-0 bg-white/90 soft-card ring-1 ring-slate-200/70">
                <CardContent className="p-6">
                  <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div><h2 className="flex items-center gap-2 text-xl font-black"><LayoutDashboard className="h-5 w-5 text-orange-600" /> Tela de tarefas</h2><p className="text-sm text-slate-500">Demandas feitas, pendentes, workflow, checklist e responsáveis.</p></div>
                    <div className="flex gap-2"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Pesquisar" value={search} onChange={(e) => setSearch(e.target.value)} /></div><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm"><option>Todas</option>{statuses.map((s)=><option key={s}>{s}</option>)}</select></div>
                  </div>
                  <div className="space-y-4">
                    {filteredTasks.length === 0 && <div className="rounded-2xl border bg-white p-5 text-sm text-slate-500">Nenhuma tarefa encontrada para o filtro atual.</div>}
                    {filteredTasks.map((task) => {
                      const completed = task.done.filter(Boolean).length;
                      const percent = Math.round((completed / task.checklist.length) * 100);
                      return <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-black">{task.title}</h3><Badge tone={task.priority === "Crítica" || task.priority === "Alta" ? "high" : task.priority === "Média" ? "medium" : "low"}>{task.priority}</Badge><Badge>{task.status}</Badge></div><p className="mt-2 text-sm text-slate-600">{task.notes}</p></div><div className="text-right text-sm text-slate-500"><p><Users className="mr-1 inline h-4 w-4" /> {task.responsible}</p><p>Gestor: {task.manager}</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3 text-sm"><b>Workflow:</b> {task.workflow}</div><div className="rounded-xl bg-slate-50 p-3 text-sm"><b>Prazo interno:</b> {task.internalDeadline}</div><div className="rounded-xl bg-slate-50 p-3 text-sm"><b>Prazo oficial:</b> {task.officialDeadline}</div></div><div className="mt-4"><div className="mb-2 flex items-center justify-between text-sm"><span className="font-bold"><ClipboardCheck className="mr-1 inline h-4 w-4" /> Checklist</span><span>{percent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-orange-600" style={{ width: `${percent}%` }} /></div><div className="mt-3 grid gap-2 md:grid-cols-3">{task.checklist.map((item, index)=><label key={item} className="flex items-center gap-2 rounded-xl border p-2 text-sm"><input type="checkbox" checked={task.done[index]} onChange={() => toggleChecklistItem(task, index)} /> {item}</label>)}</div><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "Concluída")}><Check className="mr-1 h-3 w-3" /> Marcar feita</Button><Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "A fazer")}><RotateCcw className="mr-1 h-3 w-3" /> Reabrir</Button><Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "Paralisada")}><PauseCircle className="mr-1 h-3 w-3" /> Paralisar</Button><Button size="sm" variant="outline" onClick={() => postponeTask(task)}><Clock className="mr-1 h-3 w-3" /> Postergar</Button><Button size="sm" variant="outline" onClick={() => deleteTask(task.id)} className="text-red-600"><Trash2 className="mr-1 h-3 w-3" /> Excluir</Button></div></div></motion.div>
                    })}
                  </div>
                </CardContent>
              </Card>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Card className="rounded-[2rem] border-0 bg-white/90 soft-card ring-1 ring-slate-200/70">
                <CardContent className="p-6">
                  <h2 className="mb-2 flex items-center gap-2 text-xl font-black"><Filter className="h-5 w-5 text-orange-600" /> Workflow das tarefas</h2>
                  <p className="mb-4 text-sm text-slate-500">Crie novas etapas de workflow para organizar as demandas.</p>
                  <div className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]"><Input placeholder="Nome do novo workflow. Exemplo: Monitoramento" value={workflowName} onChange={(e)=>setWorkflowName(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&addWorkflow()} /><Button onClick={addWorkflow} className="bg-orange-600 hover:bg-orange-700"><Plus className="mr-2 h-4 w-4" /> Criar workflow</Button></div>
                  <div className="grid gap-3 md:grid-cols-5">{workflows.map((flow,index)=>{const inUse=tasks.some((t)=>t.workflowId===flow.id);return <div key={flow.id} className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-100"><p className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-950 text-sm font-black text-white">{index+1}</p><p className="text-sm font-bold">{flow.name}</p><p className="mt-1 text-xs text-slate-500">{inUse?"Em uso":"Livre"}</p>{!inUse&&<Button size="sm" variant="outline" onClick={()=>deleteWorkflow(flow)} className="mt-3 text-red-600"><Trash2 className="mr-1 h-3 w-3" /> Excluir</Button>}</div>})}</div>
                </CardContent>
              </Card>
              <ProcessTracker tasks={tasks} workflows={workflows} setTaskWorkflow={setTaskWorkflow} setTaskStatus={updateTaskStatus} />
            </section>
          </>
        )}

        {currentView === "usuarios" && isAdmin && <UserManagement users={users} addUser={addUser} deleteUser={deleteUser} toggleUserStatus={toggleUserStatus} />}
        {currentView === "usuarios" && !isAdmin && <Card className="rounded-[2rem] border-0 bg-white/90 soft-card ring-1 ring-slate-200/70"><CardContent className="p-6"><h2 className="text-xl font-black text-red-600">Acesso restrito</h2><p className="mt-2 text-sm text-slate-500">Somente o administrador pode acessar o cadastro e gestão de usuários.</p></CardContent></Card>}
        {currentView === "auditoria" && <AuditPanel logs={auditLogs} />}
      </main>
    </div>
  );
}
