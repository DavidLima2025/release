import React, { useMemo, useState } from "react";

declare global {
  interface Window {
    __CORUJA_INTEL_TESTS__?: boolean;
  }
}
import { motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Eye,
  Filter,
  Lock,
  Plus,
  Search,
  Shield,
  Users,
  AlertTriangle,
  PauseCircle,
  LayoutDashboard,
  ListChecks,
  Repeat,
  UserRound,
  ChevronLeft,
  ChevronRight,
  FileText,
  Mail,
  Phone,
  Building2,
  UserPlus,
  Settings,
  Activity,
  Trash2,
  Check,
  RotateCcw,
  ArrowLeft,
  Edit3,
  Copy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const today = new Date().toISOString().slice(0, 10);

const workflows = ["Triagem", "Produção", "Validação", "Encaminhamento", "Conclusão"];
const statuses = ["A fazer", "Atrasada", "Paralisada", "Risco de prazo", "Concluída"];
const userRoles = ["Administrador", "Gestor", "Analista", "Colaborador"];

const initialTasks = [
  {
    id: 1,
    title: "Analisar denúncias recebidas",
    type: "Inteligência",
    status: "A fazer",
    priority: "Alta",
    responsible: "Sd Lima",
    manager: "Sgt Operacional",
    date: today,
    officialDeadline: "2026-06-05",
    internalDeadline: "2026-06-03",
    overdueDate: "2026-06-03",
    workflow: "Triagem",
    checklist: ["Conferir origem", "Validar vínculo", "Registrar providência"],
    done: [true, false, false],
    notes: "Demanda recebida para levantamento preliminar e organização das informações.",
  },
  {
    id: 2,
    title: "Consolidar alvos e vínculos",
    type: "Dossiê",
    status: "Atrasada",
    priority: "Crítica",
    responsible: "Equipe Intel",
    manager: "Gestor",
    date: today,
    officialDeadline: "2026-05-31",
    internalDeadline: "2026-05-29",
    overdueDate: "2026-05-29",
    workflow: "Produção",
    checklist: ["Separar imagens", "Criar linha do tempo", "Gerar relatório"],
    done: [true, true, false],
    notes: "Pendência de fechamento de relatório operacional.",
  },
  {
    id: 3,
    title: "Revisar checklist de campana",
    type: "Operacional",
    status: "Paralisada",
    priority: "Média",
    responsible: "Colaborador 01",
    manager: "Sd Lima",
    date: today,
    officialDeadline: "2026-06-08",
    internalDeadline: "2026-06-06",
    overdueDate: "2026-06-06",
    workflow: "Validação",
    checklist: ["Pontos de observação", "Canais de comunicação", "Plano de acionamento"],
    done: [true, false, false],
    notes: "Aguardando conferência do gestor.",
  },
  {
    id: 4,
    title: "Atualizar painel de demandas",
    type: "Gestão",
    status: "Concluída",
    priority: "Baixa",
    responsible: "Analista",
    manager: "Gestor",
    date: today,
    officialDeadline: "2026-06-01",
    internalDeadline: "2026-06-01",
    overdueDate: "2026-06-01",
    workflow: "Conclusão",
    checklist: ["Atualizar números", "Revisar pendências", "Publicar dashboard"],
    done: [true, true, true],
    notes: "Painel pronto para exibição em tela.",
  },
  {
    id: 5,
    title: "Conferir prazo de relatório sigiloso",
    type: "Relatório",
    status: "Risco de prazo",
    priority: "Alta",
    responsible: "Analista",
    manager: "Gestor",
    date: today,
    officialDeadline: "2026-06-02",
    internalDeadline: "2026-06-01",
    overdueDate: "2026-06-01",
    workflow: "Validação",
    checklist: ["Revisar minuta", "Conferir anexos", "Encaminhar gestor"],
    done: [true, false, false],
    notes: "Demanda com prazo crítico para fechamento e encaminhamento.",
  },
];

const initialUsers = [
  {
    id: 0,
    name: "Administrador SI 6ª CIA",
    warName: "ADM",
    register: "ADM-6CIA",
    unit: "SI 6ª CIA",
    role: "Administrador",
    email: "adm@si6cia.local",
    phone: "",
    login: "ADM6CIA",
    password: "123456",
    status: "Ativo",
  },
  {
    id: 1,
    name: "David Lima",
    warName: "Sd Lima",
    register: "PM-0001",
    unit: "1º BPM / GT6",
    role: "Gestor",
    email: "david@corujaintel.local",
    phone: "(31) 99999-0000",
    login: "sd.lima",
    password: "123456",
    status: "Ativo",
  },
  {
    id: 2,
    name: "Equipe Intel",
    warName: "Equipe Intel",
    register: "PM-0002",
    unit: "Núcleo de Inteligência",
    role: "Analista",
    email: "intel@corujaintel.local",
    phone: "(31) 98888-0000",
    login: "intel",
    password: "123456",
    status: "Ativo",
  },
  {
    id: 3,
    name: "Colaborador 01",
    warName: "Colaborador 01",
    register: "PM-0003",
    unit: "Apoio Operacional",
    role: "Colaborador",
    email: "apoio@corujaintel.local",
    phone: "(31) 97777-0000",
    login: "apoio01",
    password: "123456",
    status: "Inativo",
  },
];

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

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    const date = new Date(year, month, day);
    days.push(date.toISOString().slice(0, 10));
  }

  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function runSelfTests() {
  const feb2026 = buildCalendarDays(new Date(2026, 1, 1));
  console.assert(feb2026.includes("2026-02-01"), "Teste calendário: fevereiro/2026 deve conter 01/02/2026.");
  console.assert(feb2026.filter(Boolean).length === 28, "Teste calendário: fevereiro/2026 deve ter 28 dias.");

  const testCounts = getStatusCounts([
    { status: "A fazer" },
    { status: "A fazer" },
    { status: "Concluída" },
  ]);
  console.assert(testCounts["A fazer"] === 2, "Teste contadores: A fazer deve ser 2.");
  console.assert(testCounts["Concluída"] === 1, "Teste contadores: Concluída deve ser 1.");
}

if (typeof window !== "undefined" && !window.__CORUJA_INTEL_TESTS__) {
  window.__CORUJA_INTEL_TESTS__ = true;
  runSelfTests();
}

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

function Login({ onLogin, users }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  const submitLogin = () => {
    if (!login.trim() || !password.trim()) {
      alert("Informe usuário e senha para acessar.");
      return;
    }

    const foundUser = users.find((user) =>
      user.status === "Ativo" &&
      user.login.toLowerCase() === login.trim().toLowerCase() &&
      String(user.password || "") === password
    );

    if (!foundUser) {
      alert("Usuário ou senha inválidos, ou usuário inativo.");
      return;
    }

    onLogin(foundUser);
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black p-6 text-white">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "linear-gradient(135deg, #020617 0%, #111827 45%, #000000 100%)" }} />
      <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,88,12,0.34),transparent_34%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,rgba(0,0,0,0.25)_42%,rgba(0,0,0,0.92)_100%)]" />

      <motion.section initial={{ opacity: 0, scale: 0.96, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="relative z-10 w-full max-w-md">
        <div className="mb-5 text-center">
          <div className="mx-auto mb-4 inline-flex rounded-full border border-orange-500/40 bg-black/55 px-5 py-2 text-xs font-black uppercase tracking-[0.28em] text-orange-300 shadow-lg shadow-orange-950/40 backdrop-blur">
            Inteligência Operacional
          </div>
          <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-2xl">SI 6ª CIA</h1>
          <p className="mt-3 text-sm font-semibold uppercase tracking-[0.22em] text-orange-200">Observar • Analisar • Antecipar</p>
        </div>

        <div className="rounded-3xl border border-orange-500/30 bg-black/72 p-8 shadow-2xl shadow-orange-950/50 backdrop-blur-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-600 shadow-lg shadow-orange-700/40 ring-1 ring-orange-300/40">
              <Eye className="h-9 w-9 text-white" />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">Acesso Restrito</h2>
            <p className="mt-2 text-sm text-zinc-400">Sistema Integrado de Inteligência</p>
          </div>

          <div className="space-y-4">
            <Input value={login} onChange={(event) => setLogin(event.target.value)} placeholder="Usuário" className="h-12 border-white/10 bg-white/10 text-white placeholder:text-zinc-400" />
            <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha" type="password" className="h-12 border-white/10 bg-white/10 text-white placeholder:text-zinc-400" onKeyDown={(event) => event.key === "Enter" && submitLogin()} />
            <Button onClick={submitLogin} className="h-12 w-full bg-orange-600 text-base font-black uppercase tracking-wide hover:bg-orange-700">
              <Lock className="mr-2 h-4 w-4" /> Entrar
            </Button>
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Ambiente operacional</span>
              <button type="button" onClick={() => alert("Solicitação registrada. Procure o administrador do SI 6ª CIA para redefinir a senha.")} className="text-orange-300 hover:text-orange-200">
                Esqueci minha senha
              </button>
            </div>
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
        <div>
          <p className="text-sm font-bold opacity-90">{label}</p>
          <p className="mt-1 text-3xl font-black">{value}</p>
        </div>
        <Icon className="h-10 w-10 opacity-90" />
      </CardContent>
    </Card>
  );
}

function CalendarBoard({ tasks, selectedDate, setSelectedDate, monthDate, setMonthDate, addQuickTask, updateTaskStatus, deleteTask, postponeTask, users }) {
  const [quickTitle, setQuickTitle] = useState("");
  const activeUsers = users.filter((user) => user.status === "Ativo");
  const [quickResponsible, setQuickResponsible] = useState(activeUsers[0]?.warName || activeUsers[0]?.name || "");
  const [quickType, setQuickType] = useState("Inteligência");
  const [quickPriority, setQuickPriority] = useState("Média");
  const [quickOverdueDate, setQuickOverdueDate] = useState(selectedDate);
  const [quickNotes, setQuickNotes] = useState("");
  const [dayPanelOpen, setDayPanelOpen] = useState(false);
  const [dayPanelMode, setDayPanelMode] = useState("view");
  const selectedTasks = tasks.filter((task) => task.date === selectedDate);
  const monthDays = buildCalendarDays(monthDate);
  const monthLabel = monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const moveMonth = (amount) => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + amount, 1));

  const saveQuickTask = () => {
    if (!quickTitle.trim()) return;
    if (!quickResponsible) {
      alert("Selecione um responsável cadastrado.");
      return;
    }
    addQuickTask({
      title: quickTitle,
      responsible: quickResponsible,
      date: selectedDate,
      type: quickType,
      priority: quickPriority,
      overdueDate: quickOverdueDate || selectedDate,
      notes: quickNotes || "Demanda criada diretamente pelo calendário visual.",
    });
    setQuickTitle("");
    setQuickResponsible("");
    setQuickType("Inteligência");
    setQuickPriority("Média");
    setQuickOverdueDate(selectedDate);
    setQuickNotes("");
    setDayPanelMode("view");
  };

  const openDayPanel = (date, mode = "view") => {
    setSelectedDate(date);
    setDayPanelMode(mode);
    setDayPanelOpen(true);
  };

  return (
    <Card className="rounded-3xl border-0 shadow-sm">
      <CardContent className="p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black">
              <CalendarDays className="h-5 w-5 text-orange-600" /> Calendário visual de atividades
            </h2>
            <p className="text-sm text-slate-500">Clique em um dia para ver atividades feitas e cadastrar nova demanda direto no calendário.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => moveMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-44 rounded-xl bg-emerald-950 px-4 py-2 text-center text-sm font-bold capitalize text-white">{monthLabel}</div>
            <Button variant="outline" size="icon" onClick={() => moveMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-black uppercase text-slate-500">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-2">
              {monthDays.map((date, index) => {
                const dayTasks = date ? tasks.filter((task) => task.date === date) : [];
                const doneCount = dayTasks.filter((task) => task.status === "Concluída").length;
                const pendingCount = dayTasks.length - doneCount;
                const isSelected = date === selectedDate;
                const dayNumber = date ? Number(date.slice(8, 10)) : "";

                return (
                  <button
                    type="button"
                    key={`${date || "blank"}-${index}`}
                    disabled={!date}
                    onClick={() => date && openDayPanel(date, "view")}
                    className={`min-h-28 rounded-2xl border p-2 text-left transition hover:shadow-md ${isSelected ? "border-orange-600 bg-orange-50 ring-2 ring-orange-200" : "bg-white"} ${!date ? "cursor-default opacity-0" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${isSelected ? "bg-orange-600 text-white" : "bg-slate-100"}`}>{dayNumber}</span>
                      {dayTasks.length > 0 && <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs font-bold text-white">{dayTasks.length}</span>}
                    </div>
                    <div className="mt-2 space-y-1">
                      {dayTasks.slice(0, 3).map((task) => (
                        <div key={task.id} className={`truncate rounded-lg px-2 py-1 text-[11px] font-semibold ${task.status === "Concluída" ? "bg-green-100 text-green-700" : task.status === "Atrasada" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-700"}`}>
                          {task.title}
                        </div>
                      ))}
                    </div>
                    {dayTasks.length > 0 && (
                      <div className="mt-2 flex gap-1 text-[10px] font-bold">
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">{doneCount} feitas</span>
                        <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-yellow-700">{pendingCount} pend.</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl bg-emerald-950 p-4 text-white">
              <p className="text-sm text-emerald-100">Dia selecionado</p>
              <p className="text-2xl font-black">{selectedDate.split("-").reverse().join("/")}</p>
            </div>

            <div className="rounded-2xl border bg-white p-4">
              <h3 className="mb-3 flex items-center gap-2 font-black">
                <Plus className="h-4 w-4 text-orange-600" /> Ações do dia
              </h3>
              <div className="grid gap-2">
                <Button onClick={() => setDayPanelOpen(true) || setDayPanelMode("create")} className="w-full bg-orange-600 hover:bg-orange-700">
                  <Plus className="mr-2 h-4 w-4" /> Cadastrar demanda
                </Button>
                <Button variant="outline" onClick={() => setDayPanelOpen(true) || setDayPanelMode("view")} className="w-full">
                  <FileText className="mr-2 h-4 w-4" /> Visualizar demandas do dia
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-4">
              <h3 className="mb-3 flex items-center gap-2 font-black">
                <FileText className="h-4 w-4 text-orange-600" /> Atividades do dia
              </h3>
              <div className="max-h-80 space-y-2 overflow-auto pr-1">
                {selectedTasks.length === 0 && <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Nenhuma atividade cadastrada neste dia.</p>}
                {selectedTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-black">{task.title}</p>
                      <Badge tone={task.status === "Concluída" ? "low" : task.status === "Atrasada" ? "high" : "medium"}>{task.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{task.responsible} • {task.workflow}</p>
                    <p className="mt-2 text-xs text-slate-600">{task.notes}</p>
                    <p className="mt-2 text-xs font-bold text-red-600">Data para atraso: {task.overdueDate || task.internalDeadline}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "Concluída")}><Check className="mr-1 h-3 w-3" /> Feita</Button>
                      <Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "A fazer")}><RotateCcw className="mr-1 h-3 w-3" /> Reabrir</Button>
                      <Button size="sm" variant="outline" onClick={() => postponeTask(task.id)}><Clock className="mr-1 h-3 w-3" /> Postergar</Button>
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
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-300">Calendário visual</p>
                  <h3 className="text-2xl font-black">{selectedDate.split("-").reverse().join("/")}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => setDayPanelMode("create")} className="bg-orange-600 text-white hover:bg-orange-700">
                    <Plus className="mr-2 h-4 w-4" /> Cadastrar demanda
                  </Button>
                  <Button variant="secondary" onClick={() => setDayPanelMode("view")} className="bg-white/10 text-white hover:bg-white/20">
                    <FileText className="mr-2 h-4 w-4" /> Ver demandas
                  </Button>
                  <Button variant="secondary" onClick={() => setDayPanelOpen(false)} className="bg-white text-emerald-950 hover:bg-slate-100">
                    Fechar
                  </Button>
                </div>
              </div>

              <div className="p-5">
                {dayPanelMode === "create" && (
                  <div className="rounded-2xl border bg-slate-50 p-5">
                    <h4 className="mb-4 flex items-center gap-2 text-xl font-black"><Plus className="h-5 w-5 text-orange-600" /> Nova demanda para este dia</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input placeholder="Título da demanda" value={quickTitle} onChange={(event) => setQuickTitle(event.target.value)} />
                      <select value={quickResponsible} onChange={(event) => setQuickResponsible(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
                        <option value="">Selecione o responsável</option>
                        {activeUsers.map((user) => (
                          <option key={user.id} value={user.warName || user.name}>{user.warName || user.name}</option>
                        ))}
                      </select>
                      <select value={quickType} onChange={(event) => setQuickType(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
                        <option>Inteligência</option>
                        <option>Dossiê</option>
                        <option>Operacional</option>
                        <option>Relatório</option>
                        <option>Gestão</option>
                      </select>
                      <select value={quickPriority} onChange={(event) => setQuickPriority(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
                        <option>Baixa</option>
                        <option>Média</option>
                        <option>Alta</option>
                        <option>Crítica</option>
                      </select>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-500">Data para atraso da demanda</label>
                        <Input type="date" value={quickOverdueDate} onChange={(event) => setQuickOverdueDate(event.target.value)} />
                      </div>
                      <textarea
                        className="min-h-28 rounded-md border bg-white p-3 text-sm md:col-span-2"
                        placeholder="Informações da demanda, observações, providências ou contexto operacional"
                        value={quickNotes}
                        onChange={(event) => setQuickNotes(event.target.value)}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button onClick={saveQuickTask} className="bg-orange-600 hover:bg-orange-700"><Plus className="mr-2 h-4 w-4" /> Salvar demanda</Button>
                      <Button variant="outline" onClick={() => setDayPanelMode("view")}>Cancelar</Button>
                    </div>
                  </div>
                )}

                {dayPanelMode === "view" && (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="text-xl font-black">Demandas cadastradas neste dia</h4>
                      <Badge tone="dark">{selectedTasks.length} demandas</Badge>
                    </div>
                    <div className="grid gap-3">
                      {selectedTasks.length === 0 && <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Nenhuma demanda cadastrada neste dia. Clique em “Cadastrar demanda”.</p>}
                      {selectedTasks.map((task) => (
                        <div key={task.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h5 className="text-lg font-black">{task.title}</h5>
                                <Badge tone={task.status === "Concluída" ? "low" : task.status === "Atrasada" ? "high" : "medium"}>{task.status}</Badge>
                                <Badge tone={task.priority === "Crítica" || task.priority === "Alta" ? "high" : task.priority === "Média" ? "medium" : "low"}>{task.priority}</Badge>
                              </div>
                              <p className="mt-2 text-sm text-slate-600">{task.notes}</p>
                              <p className="mt-2 text-xs text-slate-500">Responsável: {task.responsible} • Workflow: {task.workflow}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "Concluída")}><Check className="mr-1 h-3 w-3" /> Feita</Button>
                              <Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "A fazer")}><RotateCcw className="mr-1 h-3 w-3" /> Reabrir</Button>
                              <Button size="sm" variant="outline" onClick={() => postponeTask(task.id)}><Clock className="mr-1 h-3 w-3" /> Postergar</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteTask(task.id)} className="text-red-600"><Trash2 className="mr-1 h-3 w-3" /> Excluir</Button>
                            </div>
                          </div>
                        </div>
                      ))}
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

function UserManagement({ users, addUser, deleteUser, toggleUserStatus }) {
  const emptyForm = {
    name: "",
    warName: "",
    register: "",
    unit: "",
    role: "Analista",
    email: "",
    phone: "",
    login: "",
    password: "",
    status: "Ativo",
  };

  const [form, setForm] = useState(emptyForm);
  const activeUsers = users.filter((user) => user.status === "Ativo").length;
  const inactiveUsers = users.length - activeUsers;

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
    <Card className="rounded-3xl border-0 shadow-sm">
      <CardContent className="p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-black"><UserPlus className="h-5 w-5 text-orange-600" /> Cadastro e gestão de usuários</h2>
            <p className="text-sm text-slate-500">Controle de acesso, responsáveis, gestores, analistas e colaboradores.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-2xl bg-emerald-950 px-4 py-3 text-white"><p className="text-2xl font-black">{users.length}</p><p>Total</p></div>
            <div className="rounded-2xl bg-green-600 px-4 py-3 text-white"><p className="text-2xl font-black">{activeUsers}</p><p>Ativos</p></div>
            <div className="rounded-2xl bg-zinc-600 px-4 py-3 text-white"><p className="text-2xl font-black">{inactiveUsers}</p><p>Inativos</p></div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className="rounded-2xl border bg-white p-4">
            <h3 className="mb-4 flex items-center gap-2 font-black"><Settings className="h-4 w-4 text-orange-600" /> Novo usuário</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
              <Input placeholder="Nome completo" value={form.name} onChange={(event) => updateForm("name", event.target.value)} />
              <Input placeholder="Nome de guerra" value={form.warName} onChange={(event) => updateForm("warName", event.target.value)} />
              <Input placeholder="Matrícula" value={form.register} onChange={(event) => updateForm("register", event.target.value)} />
              <Input placeholder="Unidade" value={form.unit} onChange={(event) => updateForm("unit", event.target.value)} />
              <select value={form.role} onChange={(event) => updateForm("role", event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
                {userRoles.map((role) => <option key={role}>{role}</option>)}
              </select>
              <Input placeholder="E-mail" value={form.email} onChange={(event) => updateForm("email", event.target.value)} />
              <Input placeholder="Telefone" value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} />
              <Input placeholder="Login" value={form.login} onChange={(event) => updateForm("login", event.target.value)} />
              <Input placeholder="Senha provisória" type="password" value={form.password} onChange={(event) => updateForm("password", event.target.value)} />
              <select value={form.status} onChange={(event) => updateForm("status", event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
                <option>Ativo</option>
                <option>Inativo</option>
              </select>
              <Button onClick={saveUser} className="bg-orange-600 hover:bg-orange-700"><UserPlus className="mr-2 h-4 w-4" /> Cadastrar usuário</Button>
            </div>
          </div>

          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-black">{user.warName || user.name}</h3>
                      <Badge tone={user.status === "Ativo" ? "low" : "default"}>{user.status}</Badge>
                      <Badge tone={user.role === "Administrador" ? "high" : user.role === "Gestor" ? "medium" : "default"}>{user.role}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{user.name} • Matrícula: {user.register || "não informada"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="rounded-2xl bg-emerald-950 px-4 py-2 text-sm font-bold text-white"><Activity className="mr-1 inline h-4 w-4" /> {user.login}</div>
                    <Button size="sm" variant="outline" onClick={() => toggleUserStatus(user.id)}>{user.status === "Ativo" ? "Inativar" : "Ativar"}</Button>
                    <Button size="sm" variant="outline" onClick={() => deleteUser(user.id)} className="text-red-600"><Trash2 className="mr-1 h-3 w-3" /> Excluir</Button>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm md:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3"><Building2 className="mr-1 inline h-4 w-4 text-orange-600" /> {user.unit || "Unidade não informada"}</div>
                  <div className="rounded-xl bg-slate-50 p-3"><Mail className="mr-1 inline h-4 w-4 text-orange-600" /> {user.email || "E-mail não informado"}</div>
                  <div className="rounded-xl bg-slate-50 p-3"><Phone className="mr-1 inline h-4 w-4 text-orange-600" /> {user.phone || "Telefone não informado"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DemandCenter({ status, tasks, onBack, updateTaskStatus, deleteTask, duplicateTask, toggleChecklistItem, postponeTask }) {
  const [selectedId, setSelectedId] = useState(tasks[0]?.id || null);
  const [query, setQuery] = useState("");
  const visibleTasks = tasks.filter((task) => `${task.title} ${task.responsible} ${task.workflow} ${task.notes}`.toLowerCase().includes(query.toLowerCase()));
  const selectedTask = visibleTasks.find((task) => task.id === selectedId) || visibleTasks[0];
  const title = status === "Todas" ? "CENTRAL DE DEMANDAS" : `DEMANDAS ${status.toUpperCase()}`;

  return (
    <Card className="rounded-3xl border-0 shadow-sm">
      <CardContent className="p-6">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-black"><ClipboardCheck className="h-6 w-6 text-orange-600" /> {title}</h2>
            <p className="text-sm text-slate-500">Tela aberta pelo card do dashboard, com demandas filtradas por status.</p>
          </div>
          <Button variant="outline" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao painel</Button>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-4">
          <Input className="md:col-span-2" placeholder="Pesquisar demanda, responsável ou workflow" value={query} onChange={(event) => setQuery(event.target.value)} />
          <div className="rounded-2xl bg-emerald-950 px-4 py-3 text-center font-bold text-white">{visibleTasks.length} demandas</div>
          <Button className="bg-orange-600 hover:bg-orange-700" onClick={() => alert("Use o calendário ou a tela de tarefas para criar uma nova demanda.")}><Plus className="mr-2 h-4 w-4" /> Nova demanda</Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className="space-y-3">
            {visibleTasks.length === 0 && <div className="rounded-2xl border bg-white p-5 text-sm text-slate-500">Nenhuma demanda encontrada neste status.</div>}
            {visibleTasks.map((task) => (
              <button key={task.id} type="button" onClick={() => setSelectedId(task.id)} className={`w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md ${selectedTask?.id === task.id ? "border-orange-600 ring-2 ring-orange-100" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black">{task.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">Responsável: {task.responsible}</p>
                  </div>
                  <Badge tone={task.status === "Concluída" ? "low" : task.status === "Atrasada" ? "high" : "medium"}>{task.status}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 p-2"><b>Interno:</b> {task.internalDeadline}</div>
                  <div className="rounded-lg bg-slate-50 p-2"><b>Oficial:</b> {task.officialDeadline}</div>
                </div>
              </button>
            ))}
          </div>

          {selectedTask && (
            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.25em] text-orange-600">Demanda #{selectedTask.id}</p>
                  <h3 className="mt-2 text-2xl font-black">{selectedTask.title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{selectedTask.notes}</p>
                </div>
                <Badge tone={selectedTask.status === "Concluída" ? "low" : selectedTask.status === "Atrasada" ? "high" : "medium"}>{selectedTask.status}</Badge>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4"><b>Tipo:</b> {selectedTask.type}</div>
                <div className="rounded-2xl bg-slate-50 p-4"><b>Workflow:</b> {selectedTask.workflow}</div>
                <div className="rounded-2xl bg-slate-50 p-4"><b>Responsável:</b> {selectedTask.responsible}</div>
                <div className="rounded-2xl bg-slate-50 p-4"><b>Gestor:</b> {selectedTask.manager}</div>
                <div className="rounded-2xl bg-slate-50 p-4"><b>Prazo interno:</b> {selectedTask.internalDeadline}</div>
                <div className="rounded-2xl bg-slate-50 p-4"><b>Prazo oficial:</b> {selectedTask.officialDeadline}</div>
              </div>

              <div className="mt-5">
                <h4 className="mb-3 font-black"><ClipboardCheck className="mr-1 inline h-4 w-4 text-orange-600" /> Checklist da demanda</h4>
                <div className="grid gap-2 md:grid-cols-2">
                  {selectedTask.checklist.map((item, index) => (
                    <label key={item} className="flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm">
                      <input type="checkbox" checked={selectedTask.done[index]} onChange={() => toggleChecklistItem(selectedTask.id, index)} /> {item}
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => alert(`Visualizando demanda: ${selectedTask.title}`)}><Eye className="mr-1 h-4 w-4" /> Visualizar</Button>
                <Button variant="outline" onClick={() => alert("Edição completa será ligada ao banco de dados na versão final.")}><Edit3 className="mr-1 h-4 w-4" /> Editar</Button>
                <Button variant="outline" onClick={() => duplicateTask(selectedTask.id)}><Copy className="mr-1 h-4 w-4" /> Duplicar</Button>
                <Button variant="outline" onClick={() => updateTaskStatus(selectedTask.id, "Concluída")}><Check className="mr-1 h-4 w-4" /> Encerrar</Button>
                <Button variant="outline" onClick={() => updateTaskStatus(selectedTask.id, "A fazer")}><RotateCcw className="mr-1 h-4 w-4" /> Reabrir</Button>
                <Button variant="outline" onClick={() => postponeTask(selectedTask.id)}><Clock className="mr-1 h-4 w-4" /> Postergar</Button>
                <Button variant="outline" className="text-red-600" onClick={() => deleteTask(selectedTask.id)}><Trash2 className="mr-1 h-4 w-4" /> Excluir</Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function App() {
  const [logged, setLogged] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedDate, setSelectedDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState("Todas");
  const [search, setSearch] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newResponsible, setNewResponsible] = useState("");
  const [newWorkflow, setNewWorkflow] = useState("Triagem");
  const [monthDate, setMonthDate] = useState(new Date());
  const [users, setUsers] = useState(initialUsers);
  const [message, setMessage] = useState("");
  const [demandScreenStatus, setDemandScreenStatus] = useState(null);

  const counts = useMemo(() => getStatusCounts(tasks), [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const byDate = task.date === selectedDate;
      const byStatus = statusFilter === "Todas" || task.status === statusFilter;
      const bySearch = `${task.title} ${task.type} ${task.responsible} ${task.notes}`.toLowerCase().includes(search.toLowerCase());
      return byDate && byStatus && bySearch;
    });
  }, [tasks, selectedDate, statusFilter, search]);

  const notify = (text) => {
    setMessage(text);
    window.setTimeout(() => setMessage(""), 2500);
  };

  const addTask = () => {
    if (!newTitle.trim()) {
      notify("Informe o nome da tarefa antes de cadastrar.");
      return;
    }

    if (!newResponsible) {
      notify("Selecione um responsável cadastrado.");
      return;
    }

    setTasks((currentTasks) => [
      {
        id: Date.now(),
        title: newTitle,
        type: "Inteligência",
        status: "A fazer",
        priority: "Média",
        responsible: newResponsible,
        manager: "Gestor",
        date: selectedDate,
        officialDeadline: selectedDate,
        internalDeadline: selectedDate,
        overdueDate: selectedDate,
        workflow: newWorkflow,
        checklist: ["Triar demanda", "Executar atividade", "Registrar conclusão"],
        done: [false, false, false],
        notes: "Nova demanda cadastrada no painel.",
      },
      ...currentTasks,
    ]);
    setNewTitle("");
    setNewResponsible("");
    notify("Tarefa cadastrada com sucesso.");
  };

  const addQuickTask = ({ title, responsible, date, type = "Inteligência", priority = "Média", notes = "Atividade criada diretamente pelo calendário visual.", overdueDate }) => {
    if (!responsible) {
      notify("Selecione um responsável cadastrado.");
      return;
    }

    setTasks((currentTasks) => [
      {
        id: Date.now(),
        title,
        type,
        status: "A fazer",
        priority,
        responsible,
        manager: "Gestor",
        date,
        officialDeadline: date,
        internalDeadline: date,
        overdueDate: overdueDate || date,
        workflow: "Triagem",
        checklist: ["Triar demanda", "Executar atividade", "Registrar conclusão"],
        done: [false, false, false],
        notes,
      },
      ...currentTasks,
    ]);
    notify("Atividade adicionada ao calendário.");
  };

  const addUser = (user) => {
    const loginExists = users.some((item) => item.login.toLowerCase() === user.login.toLowerCase());
    if (loginExists) {
      notify("Já existe usuário com esse login.");
      return;
    }
    setUsers((currentUsers) => [{ id: Date.now(), ...user }, ...currentUsers]);
    notify("Usuário cadastrado com sucesso.");
  };

  const deleteUser = (id) => {
    setUsers((currentUsers) => currentUsers.filter((user) => user.id !== id));
    notify("Usuário removido.");
  };

  const toggleUserStatus = (id) => {
    setUsers((currentUsers) => currentUsers.map((user) => (user.id === id ? { ...user, status: user.status === "Ativo" ? "Inativo" : "Ativo" } : user)));
    notify("Situação do usuário alterada.");
  };

  const deleteTask = (id) => {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));
    notify("Tarefa excluída.");
  };

  const updateTaskStatus = (id, status) => {
    setTasks((currentTasks) => currentTasks.map((task) => (task.id === id ? { ...task, status, done: status === "Concluída" ? task.checklist.map(() => true) : task.done } : task)));
    notify("Status da tarefa atualizado.");
  };

  const toggleChecklistItem = (taskId, itemIndex) => {
    setTasks((currentTasks) => currentTasks.map((task) => {
      if (task.id !== taskId) return task;
      const nextDone = task.done.map((done, index) => (index === itemIndex ? !done : done));
      const allDone = nextDone.every(Boolean);
      return { ...task, done: nextDone, status: allDone ? "Concluída" : task.status === "Concluída" ? "A fazer" : task.status };
    }));
  };

  const openDemandScreen = (status) => {
    setDemandScreenStatus(status);
    setStatusFilter(status);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  const postponeTask = (id) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;

    const currentDate = task.overdueDate || task.internalDeadline || selectedDate;
    const newDate = window.prompt("Informe a nova data de atraso da demanda (AAAA-MM-DD):", currentDate);

    if (!newDate) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      notify("Data inválida. Use o formato AAAA-MM-DD.");
      return;
    }

    setTasks((currentTasks) => currentTasks.map((item) => (
      item.id === id
        ? { ...item, overdueDate: newDate, internalDeadline: newDate, status: item.status === "Atrasada" ? "A fazer" : item.status }
        : item
    )));
    notify("Demanda postergada com sucesso.");
  };

  const duplicateTask = (id) => {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    setTasks((currentTasks) => [{ ...task, id: Date.now(), title: `${task.title} - cópia`, status: "A fazer" }, ...currentTasks]);
    notify("Demanda duplicada.");
  };

  if (!logged) return <Login users={users} onLogin={(user) => { setCurrentUser(user); setLogged(true); }} />;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="bg-emerald-950 px-6 py-5 shadow-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <OwlLogo />
          <div className="flex flex-wrap items-center gap-3 text-sm text-emerald-100">
            <Badge tone="dark"><UserRound className="mr-1 inline h-3 w-3" /> {currentUser?.warName || currentUser?.name || "Usuário"}</Badge>
            <Badge tone="dark"><Users className="mr-1 inline h-3 w-3" /> {users.filter((user) => user.status === "Ativo").length} usuários ativos</Badge>
            <Button variant="secondary" className="bg-white/10 text-white hover:bg-white/20" onClick={() => { setLogged(false); setCurrentUser(null); setStatusFilter("Todas"); setDemandScreenStatus(null); }}>Sair</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {message && (
          <div className="fixed right-6 top-6 z-50 flex items-center gap-2 rounded-2xl bg-emerald-950 px-5 py-3 text-sm font-bold text-white shadow-2xl">
            <CheckCircle2 className="h-4 w-4 text-orange-300" /> {message}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-5">
          <button type="button" onClick={() => openDemandScreen("A fazer")}><StatCard label="A fazer" value={counts["A fazer"] || 0} icon={ListChecks} className="bg-blue-500" /></button>
          <button type="button" onClick={() => openDemandScreen("Atrasada")}><StatCard label="Atrasadas" value={counts["Atrasada"] || 0} icon={AlertTriangle} className="bg-red-500" /></button>
          <button type="button" onClick={() => openDemandScreen("Paralisada")}><StatCard label="Paralisadas" value={counts["Paralisada"] || 0} icon={PauseCircle} className="bg-zinc-600" /></button>
          <button type="button" onClick={() => openDemandScreen("Risco de prazo")}><StatCard label="Risco de prazo" value={counts["Risco de prazo"] || 0} icon={Clock} className="bg-yellow-500" /></button>
          <button type="button" onClick={() => openDemandScreen("Concluída")}><StatCard label="Concluídas" value={counts["Concluída"] || 0} icon={CheckCircle2} className="bg-green-600" /></button>
        </section>

        {demandScreenStatus ? (
          <DemandCenter
            status={demandScreenStatus}
            tasks={tasks.filter((task) => task.status === demandScreenStatus)}
            onBack={() => setDemandScreenStatus(null)}
            updateTaskStatus={updateTaskStatus}
            deleteTask={deleteTask}
            duplicateTask={duplicateTask}
            toggleChecklistItem={toggleChecklistItem}
            postponeTask={postponeTask}
          />
        ) : (
          <CalendarBoard
            tasks={tasks}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            monthDate={monthDate}
            setMonthDate={setMonthDate}
            addQuickTask={addQuickTask}
            updateTaskStatus={updateTaskStatus}
            deleteTask={deleteTask}
            postponeTask={postponeTask}
            users={users}
          />
        )}

        <UserManagement users={users} addUser={addUser} deleteUser={deleteUser} toggleUserStatus={toggleUserStatus} />

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <Card className="rounded-3xl border-0 shadow-sm">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-orange-600" />
                <h2 className="text-xl font-black">Calendário e nova demanda</h2>
              </div>
              <Input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              <Input placeholder="Tarefa do dia / demanda" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
              <select value={newResponsible} onChange={(event) => setNewResponsible(event.target.value)} className="h-11 w-full rounded-md border bg-white px-3 text-sm">
                <option value="">Selecione o responsável</option>
                {users.filter((user) => user.status === "Ativo").map((user) => (
                  <option key={user.id} value={user.warName || user.name}>{user.warName || user.name}</option>
                ))}
              </select>
              <select value={newWorkflow} onChange={(event) => setNewWorkflow(event.target.value)} className="h-11 w-full rounded-md border bg-white px-3 text-sm">
                {workflows.map((item) => <option key={item}>{item}</option>)}
              </select>
              <Button onClick={addTask} className="w-full bg-orange-600 hover:bg-orange-700"><Plus className="mr-2 h-4 w-4" /> Cadastrar tarefa</Button>

              <div className="rounded-2xl bg-emerald-950 p-4 text-white">
                <p className="flex items-center gap-2 text-sm font-bold"><Repeat className="h-4 w-4" /> Tarefas recorrentes</p>
                <p className="mt-2 text-xs text-emerald-100">Modelo para criar rotinas diárias, semanais ou mensais, com responsáveis e prazos internos.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-black"><LayoutDashboard className="h-5 w-5 text-orange-600" /> Tela de tarefas</h2>
                  <p className="text-sm text-slate-500">Demandas feitas, pendentes, workflow, checklist e responsáveis.</p>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input className="pl-9" placeholder="Pesquisar" value={search} onChange={(event) => setSearch(event.target.value)} />
                  </div>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm">
                    <option>Todas</option>
                    {statuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {filteredTasks.length === 0 && <div className="rounded-2xl border bg-white p-5 text-sm text-slate-500">Nenhuma tarefa encontrada para o filtro atual.</div>}
                {filteredTasks.map((task) => {
                  const completed = task.done.filter(Boolean).length;
                  const percent = Math.round((completed / task.checklist.length) * 100);

                  return (
                    <motion.div key={task.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border bg-white p-4 shadow-sm">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-black">{task.title}</h3>
                            <Badge tone={task.priority === "Crítica" || task.priority === "Alta" ? "high" : task.priority === "Média" ? "medium" : "low"}>{task.priority}</Badge>
                            <Badge>{task.status}</Badge>
                          </div>
                          <p className="mt-2 text-sm text-slate-600">{task.notes}</p>
                        </div>
                        <div className="text-right text-sm text-slate-500">
                          <p><Users className="mr-1 inline h-4 w-4" /> {task.responsible}</p>
                          <p>Gestor: {task.manager}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl bg-slate-50 p-3 text-sm"><b>Workflow:</b> {task.workflow}</div>
                        <div className="rounded-xl bg-slate-50 p-3 text-sm"><b>Prazo interno:</b> {task.internalDeadline}</div>
                        <div className="rounded-xl bg-slate-50 p-3 text-sm"><b>Prazo oficial:</b> {task.officialDeadline}</div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="font-bold"><ClipboardCheck className="mr-1 inline h-4 w-4" /> Checklist</span>
                          <span>{percent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-orange-600" style={{ width: `${percent}%` }} /></div>
                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                          {task.checklist.map((item, index) => (
                            <label key={item} className="flex items-center gap-2 rounded-xl border p-2 text-sm">
                              <input type="checkbox" checked={task.done[index]} onChange={() => toggleChecklistItem(task.id, index)} /> {item}
                            </label>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "Concluída")}><Check className="mr-1 h-3 w-3" /> Marcar feita</Button>
                          <Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "A fazer")}><RotateCcw className="mr-1 h-3 w-3" /> Reabrir</Button>
                          <Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "Paralisada")}><PauseCircle className="mr-1 h-3 w-3" /> Paralisar</Button>
                          <Button size="sm" variant="outline" onClick={() => postponeTask(task.id)}><Clock className="mr-1 h-3 w-3" /> Postergar</Button>
                      <Button size="sm" variant="outline" onClick={() => deleteTask(task.id)} className="text-red-600"><Trash2 className="mr-1 h-3 w-3" /> Excluir</Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="rounded-3xl border-0 shadow-sm">
            <CardContent className="p-6">
              <h2 className="mb-4 flex items-center gap-2 text-xl font-black"><Filter className="h-5 w-5 text-orange-600" /> Workflow das tarefas</h2>
              <div className="grid gap-3 md:grid-cols-5">
                {workflows.map((flow, index) => (
                  <div key={flow} className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-100">
                    <p className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-950 text-sm font-black text-white">{index + 1}</p>
                    <p className="text-sm font-bold">{flow}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border-0 bg-emerald-950 text-white shadow-sm">
            <CardContent className="p-6">
              <h2 className="text-xl font-black">Dashboard para tela</h2>
              <p className="mt-2 text-sm text-emerald-100">Visão rápida para monitoramento integrado: volume de demandas, gargalos, responsáveis e risco de prazo.</p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/10 p-4"><p className="text-3xl font-black">{tasks.length}</p><p className="text-sm">Demandas totais</p></div>
                <div className="rounded-2xl bg-white/10 p-4"><p className="text-3xl font-black">{tasks.filter((task) => task.status !== "Concluída").length}</p><p className="text-sm">Pendências</p></div>
                <div className="rounded-2xl bg-white/10 p-4"><p className="text-3xl font-black">{users.filter((user) => user.status === "Ativo").length}</p><p className="text-sm">Usuários ativos</p></div>
                <div className="rounded-2xl bg-white/10 p-4"><p className="text-3xl font-black">{counts["Concluída"] || 0}</p><p className="text-sm">Concluídas</p></div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
