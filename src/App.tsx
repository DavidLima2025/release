
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, ArrowLeft, Building2, CalendarDays, Camera, Check, CheckCircle2, ChevronLeft, ChevronRight,
  ClipboardCheck, Clock, Copy, Edit3, Eye, FileText, Filter, FolderOpen, Image as ImageIcon, LayoutDashboard, ListChecks, Lock, Mail, PauseCircle,
  Paperclip, Phone, Plus, RotateCcw, Search,
  Settings, Shield, Trash2, Upload, UserPlus, UserRound, Users
} from "lucide-react";
import { supabase } from "./supabase";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

const today = new Date().toISOString().slice(0, 10);
const statuses = ["A fazer", "Atrasada", "Paralisada", "Risco de prazo", "Concluída"];
const userRoles = ["Administrador", "Gestor", "Analista", "Colaborador"];

const permissionsByRole = {
  Administrador: {
    users: true,
    audit: true,
    deleteDemand: true,
    deleteWorkflow: true,
    manageWorkflow: true,
    dashboard: true,
    tv: true,
  },
  Gestor: {
    users: false,
    audit: true,
    deleteDemand: true,
    deleteWorkflow: false,
    manageWorkflow: true,
    dashboard: true,
    tv: true,
  },
  Analista: {
    users: false,
    audit: false,
    deleteDemand: false,
    deleteWorkflow: false,
    manageWorkflow: false,
    dashboard: true,
    tv: true,
  },
  Colaborador: {
    users: false,
    audit: false,
    deleteDemand: false,
    deleteWorkflow: false,
    manageWorkflow: false,
    dashboard: false,
    tv: false,
  },
};

function getPermissions(user) {
  const role = user?.role || "Colaborador";
  const adminByLogin = (user?.login || "").toUpperCase() === "ADM6CIA";
  if (adminByLogin) return permissionsByRole.Administrador;
  return permissionsByRole[role] || permissionsByRole.Colaborador;
}

function daysBetween(dateA, dateB) {
  if (!dateA || !dateB) return null;
  const a = new Date(dateA + "T00:00:00");
  const b = new Date(dateB + "T00:00:00");
  return Math.ceil((a.getTime() - b.getTime()) / 86400000);
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

function normalizeAttachment(row) {
  return {
    id: row.id,
    demandId: row.demand_id,
    fileName: row.file_name,
    filePath: row.file_path,
    fileSize: row.file_size || 0,
    mimeType: row.mime_type || "",
    uploadedBy: row.uploaded_by || "",
    createdAt: row.created_at,
  };
}

function normalizeAuthor(row) {
  return {
    id: row.id,
    name: row.name || "Autor sem nome",
    alias: row.alias || "",
    motherName: row.mother_name || "",
    birthDate: row.birth_date || "",
    document: row.document || "",
    address: row.address || "",
    neighborhood: row.neighborhood || "",
    city: row.city || "",
    crimes: row.crimes || "",
    categoryId: row.category_id || row.folder_id || "",
    status: row.status || "Suspeito",
    riskLevel: row.risk_level || "Médio",
    notes: row.notes || "",
    createdAt: row.created_at,
  };
}


function normalizeAuthorCategory(row) {
  return {
    id: row.id,
    name: row.name || "Pasta sem nome",
    description: row.description || "",
    createdAt: row.created_at,
  };
}

function normalizeAuthorFile(row) {
  return {
    id: row.id,
    authorId: row.author_id,
    fileName: row.file_name,
    filePath: row.file_path,
    fileSize: row.file_size || 0,
    mimeType: row.mime_type || "",
    description: row.description || "",
    uploadedBy: row.uploaded_by || "",
    createdAt: row.created_at,
  };
}

function cleanTrelloText(text = "") {
  return String(text || "")
    .replace(/[•●]/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function firstNonEmptyLine(text = "") {
  return cleanTrelloText(text).split("\n").map((line) => line.trim()).filter(Boolean)[0] || "";
}

function extractField(text = "", labels = []) {
  const normalized = cleanTrelloText(text);
  for (const label of labels) {
    const regex = new RegExp(`${label}\\s*[:：-]?\\s*([^\\n]+)`, "i");
    const match = normalized.match(regex);
    if (match?.[1]) return match[1].trim().replace(/^[-:]+/, "").trim();
  }
  return "";
}

function extractDocument(text = "") {
  const normalized = cleanTrelloText(text);
  const explicit = normalized.match(/(?:RG|CPF|DOCUMENTO)\s*[:：-]?\s*([A-Z]{0,3}\s*-?\s*[0-9.\-\/]{6,})/i);
  if (explicit?.[1]) return explicit[1].replace(/\s+/g, " ").trim();
  const standalone = normalized.match(/\b\d{7,11}\b/);
  return standalone?.[0] || "";
}

function normalizeSuspectName(raw = "") {
  let text = cleanTrelloText(raw);
  text = text.replace(/NOME\s*[:：-]?/i, "");
  text = text.replace(/(?:RG|CPF|DOCUMENTO)\s*[:：-]?.*$/i, "");
  text = text.replace(/\b\d{7,11}\b/g, "");
  text = text.replace(/[-–—]+$/g, "").trim();
  return text || "Autor sem nome";
}

function parseTrelloAuthor(listName = "", cards = []) {
  const cardTexts = cards.map((card) => [card?.name, card?.desc].filter(Boolean).join("\n")).filter(Boolean);
  const merged = [listName, ...cardTexts].join("\n");
  const nameFromField = extractField(merged, ["NOME"]);
  const nameBase = nameFromField || firstNonEmptyLine(listName) || firstNonEmptyLine(merged);
  const alias = extractField(merged, ["VULGO", "ALCUNHA"]);
  const crimes = extractField(merged, ["FUNÇÃO", "FUNCAO", "CRIME", "CRIMES", "MODUS OPERANDI"]);
  const document = extractDocument(merged);
  const usefulDescriptions = cards
    .map((card) => cleanTrelloText(card?.desc || ""))
    .filter(Boolean);
  const notes = usefulDescriptions.join("\n\n");
  return {
    name: normalizeSuspectName(nameBase),
    alias: /^(nao|não|n[aã]o tem|sem|informado|não informado)$/i.test(alias) ? "" : alias,
    document,
    crimes: crimes || "Furto de correntinha/celular/arrombamento/roubo",
    notes,
    status: "Suspeito",
    riskLevel: "Médio",
  };
}

function isImageAttachment(attachment) {
  const name = String(attachment?.name || attachment?.url || "").toLowerCase();
  return /\.(png|jpe?g|webp|gif|bmp)$/i.test(name) || String(attachment?.mimeType || "").startsWith("image/");
}

function getTrelloAttachmentUrl(attachment) {
  return attachment?.url || attachment?.previewUrl2x || attachment?.previewUrl || "";
}

function addDaysToDate(date, days) {
  const next = new Date(date + "T00:00:00");
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function addMonthsToDate(date, months) {
  const next = new Date(date + "T00:00:00");
  next.setMonth(next.getMonth() + months);
  return next.toISOString().slice(0, 10);
}

function buildRecurringDates(startDate, recurrence = "none", count = 1) {
  const safeCount = Math.max(1, Math.min(Number(count) || 1, 60));
  return Array.from({ length: recurrence === "none" ? 1 : safeCount }, (_, index) => {
    if (recurrence === "daily") return addDaysToDate(startDate, index);
    if (recurrence === "weekly") return addDaysToDate(startDate, index * 7);
    if (recurrence === "monthly") return addMonthsToDate(startDate, index);
    return startDate;
  });
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
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

function isSameMonthDate(date, referenceDate = new Date()) {
  if (!date) return false;
  const current = new Date(date + "T00:00:00");
  return current.getFullYear() === referenceDate.getFullYear() && current.getMonth() === referenceDate.getMonth();
}

function isOpenTask(task) {
  return task?.status !== "Concluída";
}

function OwlLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-orange-600 to-emerald-950 shadow-lg shadow-orange-950/30 ring-1 ring-orange-200/30">
        <div className="absolute top-3 flex gap-1">
          <span className="grid h-4 w-4 place-items-center rounded-full bg-white text-[10px] font-black text-emerald-950">●</span>
          <span className="grid h-4 w-4 place-items-center rounded-full bg-white text-[10px] font-black text-emerald-950">●</span>
        </div>
        <div className="absolute top-[18px] h-3 w-3 rotate-45 bg-orange-200" />
        <Shield className="mt-7 h-5 w-5 text-emerald-100" />
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

function CalendarBoard({ tasks, selectedDate, setSelectedDate, monthDate, setMonthDate, addQuickTask, updateTask, updateTaskStatus, deleteTask, postponeTask, users, attachments, uploadDemandFile, getAttachmentUrl }) {
  const [quickTitle, setQuickTitle] = useState("");
  const [quickResponsible, setQuickResponsible] = useState("");
  const [quickType, setQuickType] = useState("Inteligência");
  const [quickPriority, setQuickPriority] = useState("Média");
  const [quickOverdueDate, setQuickOverdueDate] = useState(selectedDate);
  const [quickNotes, setQuickNotes] = useState("");
  const [quickRecurrence, setQuickRecurrence] = useState("none");
  const [quickRecurrenceCount, setQuickRecurrenceCount] = useState(1);
  const [editingTask, setEditingTask] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [dayPanelOpen, setDayPanelOpen] = useState(false);
  const [dayPanelMode, setDayPanelMode] = useState("view");
  const selectedTasks = tasks.filter((task) => task.date === selectedDate);
  const monthDays = buildCalendarDays(monthDate);
  const monthLabel = monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const activeUsers = users.filter((u) => u.status === "Ativo");

  useEffect(() => setQuickOverdueDate(selectedDate), [selectedDate]);

  const startEditTask = (task) => {
    setEditingTask(task);
    setEditForm({
      title: task.title || "",
      responsibleId: task.responsibleId || "",
      type: task.type || "Inteligência",
      priority: task.priority || "Média",
      status: task.status || "A fazer",
      date: task.date || selectedDate,
      overdueDate: task.overdueDate || task.internalDeadline || task.date || selectedDate,
      notes: task.notes || "",
    });
    setDayPanelOpen(true);
    setDayPanelMode("edit");
  };

  const saveEditTask = () => {
    if (!editingTask || !editForm?.title?.trim()) return;
    updateTask(editingTask.id, editForm);
    setEditingTask(null);
    setEditForm(null);
    setDayPanelMode("view");
  };

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
      recurrence: quickRecurrence,
      recurrenceCount: quickRecurrenceCount,
    });
    setQuickTitle(""); setQuickResponsible(""); setQuickType("Inteligência"); setQuickPriority("Média"); setQuickNotes(""); setQuickRecurrence("none"); setQuickRecurrenceCount(1); setDayPanelMode("view");
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
        <div className="mb-4 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">Azul: futuras/abertas</span>
          <span className="rounded-full bg-yellow-100 px-3 py-1 text-yellow-700">Amarelo: risco</span>
          <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">Vermelho: atrasada</span>
          <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">Verde: concluída</span>
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
                const hasLate = dayTasks.some((task) => task.status === "Atrasada");
                const hasRisk = dayTasks.some((task) => task.status === "Risco de prazo");
                const allDone = dayTasks.length > 0 && dayTasks.every((task) => task.status === "Concluída");
                const statusClass = hasLate ? "border-red-300 bg-red-50" : hasRisk ? "border-yellow-300 bg-yellow-50" : allDone ? "border-green-300 bg-green-50" : dayTasks.length > 0 ? "border-blue-300 bg-blue-50" : "bg-white";
                return (
                  <button type="button" key={`${date || "blank"}-${index}`} disabled={!date} onClick={() => date && (setSelectedDate(date), setDayPanelMode("view"), setDayPanelOpen(true))}
                    className={`min-h-28 rounded-2xl border p-2 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${isSelected ? "border-orange-600 bg-orange-50 ring-2 ring-orange-200" : statusClass} ${!date ? "cursor-default opacity-0" : ""}`}>
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
                      <select value={quickRecurrence} onChange={(e) => setQuickRecurrence(e.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm"><option value="none">Sem recorrência</option><option value="daily">Diária</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option></select>
                      <div><label className="mb-1 block text-xs font-bold text-slate-500">Quantidade de repetições</label><Input type="number" min="1" max="60" value={quickRecurrenceCount} onChange={(e) => setQuickRecurrenceCount(e.target.value)} disabled={quickRecurrence === "none"} /></div>
                      <textarea className="min-h-28 rounded-md border bg-white p-3 text-sm md:col-span-2" placeholder="Informações da demanda" value={quickNotes} onChange={(e) => setQuickNotes(e.target.value)} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2"><Button onClick={saveQuickTask} className="bg-orange-600 hover:bg-orange-700"><Plus className="mr-2 h-4 w-4" /> Salvar demanda</Button><Button variant="outline" onClick={() => setDayPanelMode("view")}>Cancelar</Button></div>
                  </div>
                ) : dayPanelMode === "edit" && editForm ? (
                  <div className="rounded-2xl border bg-slate-50 p-5">
                    <h4 className="mb-4 flex items-center gap-2 text-xl font-black"><Edit3 className="h-5 w-5 text-orange-600" /> Editar demanda</h4>
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input placeholder="Título da demanda" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                      <select value={editForm.responsibleId} onChange={(e) => setEditForm({ ...editForm, responsibleId: e.target.value })} className="h-10 rounded-md border bg-white px-3 text-sm"><option value="">Selecione o responsável</option>{activeUsers.map((u)=><option key={u.id} value={u.id}>{u.warName || u.name}</option>)}</select>
                      <select value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} className="h-10 rounded-md border bg-white px-3 text-sm"><option>Inteligência</option><option>Dossiê</option><option>Operacional</option><option>Relatório</option><option>Gestão</option></select>
                      <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })} className="h-10 rounded-md border bg-white px-3 text-sm"><option>Baixa</option><option>Média</option><option>Alta</option><option>Crítica</option></select>
                      <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="h-10 rounded-md border bg-white px-3 text-sm">{statuses.map((s)=><option key={s}>{s}</option>)}</select>
                      <div><label className="mb-1 block text-xs font-bold text-slate-500">Data no calendário</label><Input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} /></div>
                      <div><label className="mb-1 block text-xs font-bold text-slate-500">Data para atraso</label><Input type="date" value={editForm.overdueDate} onChange={(e) => setEditForm({ ...editForm, overdueDate: e.target.value })} /></div>
                      <textarea className="min-h-28 rounded-md border bg-white p-3 text-sm md:col-span-2" placeholder="Informações da demanda" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2"><Button onClick={saveEditTask} className="bg-orange-600 hover:bg-orange-700"><Check className="mr-2 h-4 w-4" /> Salvar alterações</Button><Button variant="outline" onClick={() => setDayPanelMode("view")}>Cancelar</Button></div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-4 flex items-center justify-between"><h4 className="text-xl font-black">Demandas cadastradas neste dia</h4><Badge tone="dark">{selectedTasks.length} demandas</Badge></div>
                    <div className="grid gap-3">
                      {selectedTasks.length === 0 && <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Nenhuma demanda cadastrada neste dia.</p>}
                      {selectedTasks.map((task)=>{
                        const taskAttachments = attachments.filter((file) => file.demandId === task.id);
                        return <div key={task.id} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h5 className="text-lg font-black">{task.title}</h5><Badge tone={task.status === "Concluída" ? "low" : task.status === "Atrasada" ? "high" : "medium"}>{task.status}</Badge></div><p className="mt-2 text-sm text-slate-600">{task.notes}</p><p className="mt-2 text-xs text-slate-500">Responsável: {task.responsible} • Workflow: {task.workflow}</p>{taskAttachments.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{taskAttachments.map((file)=><a key={file.id} href={getAttachmentUrl(file.filePath)} target="_blank" rel="noreferrer" className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">{file.fileName} {formatBytes(file.fileSize)}</a>)}</div>}</div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => startEditTask(task)}><Edit3 className="mr-1 h-3 w-3" /> Editar</Button><label className="inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm font-medium"><Upload className="mr-1 h-3 w-3" /> Anexar<input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadDemandFile(task, e.target.files[0])} /></label><Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "Concluída")}><Check className="mr-1 h-3 w-3" /> Feita</Button><Button size="sm" variant="outline" onClick={() => updateTaskStatus(task.id, "A fazer")}><RotateCcw className="mr-1 h-3 w-3" /> Reabrir</Button><Button size="sm" variant="outline" onClick={() => postponeTask(task)}><Clock className="mr-1 h-3 w-3" /> Postergar</Button><Button size="sm" variant="outline" onClick={() => deleteTask(task.id)} className="text-red-600"><Trash2 className="mr-1 h-3 w-3" /> Excluir</Button></div></div></div>
                      })}
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
    <Card className="rounded-3xl border-0 bg-emerald-950 text-white shadow-sm"><CardContent className="p-6"><div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><h2 className="text-xl font-black">Acompanhamento do processo</h2><p className="mt-2 text-sm text-emerald-100">Selecione uma demanda em aberto e clique nas etapas até chegar a 100%.</p></div><div className="rounded-2xl bg-white/10 px-5 py-3 text-center"><p className="text-3xl font-black">{selectedTask ? progress : 0}%</p><p className="text-xs text-emerald-100">Andamento</p></div></div>{tasks.length === 0 && <div className="rounded-2xl bg-white/10 p-4 text-sm text-emerald-100">Nenhuma demanda em aberto no workflow.</div>}{tasks.length > 0 && <select value={selectedTask?.id || ""} onChange={(e)=>setSelectedTaskId(e.target.value)} className="mb-5 h-11 w-full rounded-xl border border-white/10 bg-white/10 px-3 text-sm text-white">{tasks.map((task)=><option key={task.id} value={task.id} className="text-slate-900">{task.title}</option>)}</select>}{selectedTask && <div><div className="mb-4 rounded-2xl bg-white/10 p-4"><p className="text-sm text-emerald-100">Demanda selecionada</p><h3 className="text-lg font-black">{selectedTask.title}</h3><p className="mt-1 text-xs text-emerald-100">Responsável: {selectedTask.responsible} • Status: {selectedTask.status}</p></div><div className="mb-5 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-orange-500 transition-all" style={{width:`${progress}%`}} /></div><div className="grid gap-3 md:grid-cols-5">{workflows.map((workflow,index)=>{const reached=index<=currentStep;const current=workflow.id===selectedTask.workflowId;return <button key={workflow.id} type="button" onClick={()=>advanceToStep(workflow)} className={`rounded-2xl border p-4 text-left transition hover:scale-[1.02] ${reached ? "border-orange-400 bg-orange-500 text-white" : "border-white/10 bg-white/10 text-emerald-50"} ${current ? "ring-2 ring-white" : ""}`}><p className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-sm font-black">{index+1}</p><p className="text-sm font-black">{workflow.name}</p><p className="mt-1 text-xs opacity-80">{current ? "Etapa atual" : reached ? "Já alcançada" : "Clique para avançar"}</p></button>})}</div></div>}</CardContent></Card>
  )
}

function AuditPanel({ logs }) {
  return <Card className="rounded-[2rem] border-0 bg-white/90 soft-card ring-1 ring-slate-200/70"><CardContent className="p-6"><div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><h2 className="flex items-center gap-2 text-xl font-black"><Activity className="h-5 w-5 text-orange-600" /> Auditoria do sistema</h2><p className="text-sm text-slate-500">Histórico de ações registradas no Supabase.</p></div><Badge tone="dark">{logs.length} registros</Badge></div><div className="max-h-[520px] space-y-3 overflow-auto pr-1">{logs.length === 0 && <div className="rounded-2xl border bg-white p-5 text-sm text-slate-500">Nenhuma ação registrada ainda.</div>}{logs.map((log)=><div key={log.id} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between"><div><p className="text-sm font-black text-slate-900">{log.action}</p><p className="mt-1 text-sm text-slate-600">{log.details}</p><p className="mt-2 text-xs text-slate-500">Usuário: <b>{log.user_name}</b> • Perfil: <b>{log.user_role}</b></p></div><Badge tone="medium">{new Date(log.created_at).toLocaleString("pt-BR")}</Badge></div></div>)}</div></CardContent></Card>
}

function AuthorIntelligencePanel({ categories, authors, photos, reports, addAuthorCategory, deleteAuthorCategory, addAuthor, updateAuthor, deleteAuthor, uploadAuthorFile, importTrelloBoard, getIntelFileUrl }) {
  const defaultCategoryId = categories[0]?.id || "all";
  const emptyAuthor = { name: "", alias: "", motherName: "", birthDate: "", document: "", address: "", neighborhood: "", city: "", crimes: "", categoryId: defaultCategoryId === "all" ? "" : defaultCategoryId, status: "Suspeito", riskLevel: "Médio", notes: "" };
  const [query, setQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(defaultCategoryId);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyAuthor);
  const [editing, setEditing] = useState(false);
  const [pendingPhoto, setPendingPhoto] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");
  const [importingTrello, setImportingTrello] = useState(false);
  const authorFormRef = useRef(null);

  const fallbackFolders = useMemo(() => {
    if (categories.length > 0) return categories;
    const names = ["Tráfico de drogas", "Receptação", "Arrombamento", "Furto de correntinha"];
    return names.map((name) => ({ id: name, name, description: "Pasta padrão" }));
  }, [categories]);

  useEffect(() => {
    if (!selectedCategoryId && fallbackFolders[0]?.id) setSelectedCategoryId(fallbackFolders[0].id);
  }, [fallbackFolders, selectedCategoryId]);

  useEffect(() => {
    if (!editing && !form.categoryId && selectedCategoryId !== "all") setForm((current) => ({ ...current, categoryId: selectedCategoryId }));
  }, [selectedCategoryId, editing, form.categoryId]);

  const authorsInFolder = authors.filter((author) => selectedCategoryId === "all" ? true : (author.categoryId === selectedCategoryId || (!author.categoryId && author.crimes === selectedCategoryId)));
  const visibleAuthors = authorsInFolder.filter((author) => `${author.name} ${author.alias} ${author.motherName} ${author.document} ${author.address} ${author.neighborhood} ${author.city} ${author.crimes} ${author.notes}`.toLowerCase().includes(query.toLowerCase()));
  const selectedAuthor = visibleAuthors.find((author) => author.id === selectedId) || visibleAuthors[0] || null;
  const selectedPhotos = selectedAuthor ? photos.filter((file) => file.authorId === selectedAuthor.id) : [];
  const selectedReports = selectedAuthor ? reports.filter((file) => file.authorId === selectedAuthor.id) : [];
  const selectedFolder = fallbackFolders.find((folder) => folder.id === selectedCategoryId);

  const updateForm = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const resetForm = () => { setForm({ ...emptyAuthor, categoryId: selectedCategoryId === "all" ? "" : selectedCategoryId }); setEditing(false); setPendingPhoto(null); };
  const startEdit = (author) => {
    setForm({ name: author.name, alias: author.alias, motherName: author.motherName, birthDate: author.birthDate, document: author.document, address: author.address, neighborhood: author.neighborhood, city: author.city, crimes: author.crimes, categoryId: author.categoryId || "", status: author.status, riskLevel: author.riskLevel, notes: author.notes });
    setSelectedId(author.id);
    if (author.categoryId && selectedCategoryId === "all") setSelectedCategoryId(author.categoryId);
    setEditing(true);
    window.setTimeout(() => authorFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  };
  const createCategory = async () => {
    const created = await addAuthorCategory({ name: newCategoryName, description: newCategoryDescription });
    if (created?.id) {
      setSelectedCategoryId(created.id);
      setForm((current) => ({ ...current, categoryId: created.id }));
      setNewCategoryName("");
      setNewCategoryDescription("");
    }
  };

  const handleTrelloImport = async (file) => {
    if (!file || !importTrelloBoard) return;
    setImportingTrello(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const folderId = await importTrelloBoard(parsed);
      if (folderId) setSelectedCategoryId(folderId);
    } catch (error) {
      alert("Erro ao ler o JSON do Trello. Verifique se o arquivo exportado está correto.");
    } finally {
      setImportingTrello(false);
    }
  };
  const submit = async () => {
    const preparedForm = { ...form, categoryId: form.categoryId || (selectedCategoryId === "all" ? "" : selectedCategoryId) };
    if (editing && selectedAuthor) {
      await updateAuthor(selectedAuthor.id, preparedForm);
      if (pendingPhoto) await uploadAuthorFile(selectedAuthor, pendingPhoto, "photo");
    } else {
      const createdAuthor = await addAuthor(preparedForm);
      if (createdAuthor && pendingPhoto) {
        await uploadAuthorFile(createdAuthor, pendingPhoto, "photo");
        setSelectedId(createdAuthor.id);
      }
    }
    resetForm();
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <Card className="rounded-[2rem] border-0 bg-white/90 soft-card ring-1 ring-slate-200/70">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-black"><FolderOpen className="h-5 w-5 text-orange-600" /> Banco de Alvos</h2>
                <p className="mt-1 text-sm text-slate-500">Pastas por modalidade criminal, com cards de autores/suspeitos dentro.</p>
              </div>
              <Badge tone="dark">{authors.length} alvos</Badge>
            </div>
            <div className="mb-4 rounded-2xl bg-emerald-950 p-4 text-white">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-100">Criar nova pasta</p>
              <div className="space-y-2">
                <Input className="bg-white text-slate-900" placeholder="Ex.: Tráfico de drogas" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
                <Input className="bg-white text-slate-900" placeholder="Observação da pasta" value={newCategoryDescription} onChange={(e) => setNewCategoryDescription(e.target.value)} />
                <Button onClick={createCategory} className="w-full bg-orange-600 hover:bg-orange-700"><Plus className="mr-2 h-4 w-4" /> Criar pasta</Button>
              </div>
            </div>
            <div className="mb-4 rounded-2xl border border-dashed border-orange-300 bg-orange-50 p-4">
              <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-orange-700">Importar Trello</p>
              <p className="mb-3 text-xs text-slate-600">Importa listas como alvos, cartões como dados e anexos como fotos/relatórios.</p>
              <label className={`flex cursor-pointer items-center justify-center rounded-xl px-4 py-3 text-sm font-black text-white ${importingTrello ? "bg-slate-400" : "bg-orange-600 hover:bg-orange-700"}`}>
                <Upload className="mr-2 h-4 w-4" /> {importingTrello ? "Importando..." : "Escolher JSON do Trello"}
                <input type="file" accept="application/json,.json" className="hidden" disabled={importingTrello} onChange={(e) => handleTrelloImport(e.target.files?.[0])} />
              </label>
            </div>
            <div className="space-y-2">
              <button type="button" onClick={() => { setSelectedCategoryId("all"); setSelectedId(null); }} className={`w-full rounded-2xl border p-4 text-left shadow-sm transition hover:shadow-md ${selectedCategoryId === "all" ? "border-orange-600 bg-orange-50 ring-2 ring-orange-100" : "bg-white"}`}>
                <div className="flex items-center justify-between gap-3"><span className="font-black">Todas as pastas</span><Badge>{authors.length}</Badge></div>
                <p className="mt-1 text-xs text-slate-500">Pesquisa geral do banco.</p>
              </button>
              {fallbackFolders.map((folder) => {
                const total = authors.filter((author) => author.categoryId === folder.id || (!author.categoryId && author.crimes === folder.id)).length;
                return <div key={folder.id} className={`rounded-2xl border p-4 shadow-sm transition ${selectedCategoryId === folder.id ? "border-orange-600 bg-orange-50 ring-2 ring-orange-100" : "bg-white"}`}>
                  <button type="button" onClick={() => { setSelectedCategoryId(folder.id); setSelectedId(null); setForm((current) => ({ ...current, categoryId: folder.id })); }} className="w-full text-left">
                    <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 font-black"><FolderOpen className="h-4 w-4 text-orange-600" /> {folder.name}</span><Badge>{total}</Badge></div>
                    <p className="mt-1 text-xs text-slate-500">{folder.description || "Sem observação."}</p>
                  </button>
                  {categories.some((item) => item.id === folder.id) && total === 0 && <Button size="sm" variant="outline" className="mt-3 text-red-600" onClick={() => deleteAuthorCategory(folder.id)}><Trash2 className="mr-1 h-3 w-3" /> Excluir pasta</Button>}
                </div>;
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="rounded-[2rem] border-0 bg-white/90 soft-card ring-1 ring-slate-200/70">
          <CardContent className="p-6">
            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div><p className="text-xs font-black uppercase tracking-[0.25em] text-orange-600">{selectedCategoryId === "all" ? "Visão geral" : "Pasta"}</p><h2 className="mt-1 text-2xl font-black">{selectedCategoryId === "all" ? "Todas as pastas" : selectedFolder?.name}</h2><p className="text-sm text-slate-500">Os cards abaixo pertencem à pasta selecionada.</p></div>
              <Badge tone="dark">{visibleAuthors.length} cards</Badge>
            </div>
            <div className="relative mb-4"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Pesquisar nome, vulgo, documento, bairro..." value={query} onChange={(e) => setQuery(e.target.value)} /></div>
            <div className="grid gap-4 lg:grid-cols-2">
              {visibleAuthors.length === 0 && <div className="rounded-2xl border bg-white p-5 text-sm text-slate-500 lg:col-span-2">Nenhum card encontrado nesta pasta.</div>}
              {visibleAuthors.map((author) => {
                const cover = photos.find((file) => file.authorId === author.id);
                const authorFolder = fallbackFolders.find((folder) => folder.id === author.categoryId);
                return <button key={author.id} type="button" onClick={() => setSelectedId(author.id)} className={`group rounded-3xl border bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg ${selectedAuthor?.id === author.id ? "border-orange-600 ring-2 ring-orange-100" : "border-slate-200"}`}>
                  <div className="flex gap-4">
                    <div className="grid h-28 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                      {cover ? <img src={getIntelFileUrl(cover.filePath)} alt={author.name} className="h-full w-full object-cover" /> : <UserRound className="h-10 w-10 text-slate-400" />}
                    </div>
                    <div className="min-w-0 flex-1 py-1">
                      <div className="mb-2 flex flex-wrap gap-1"><Badge>{author.status}</Badge><Badge tone={author.riskLevel === "Alto" ? "high" : author.riskLevel === "Médio" ? "medium" : "low"}>{author.riskLevel}</Badge></div>
                      <h3 className="truncate text-lg font-black text-slate-950">{author.name}</h3>
                      <p className="truncate text-sm text-slate-600"><b>Vulgo:</b> {author.alias || "Não informado"}</p>
                      <p className="truncate text-xs text-slate-500"><b>Pasta:</b> {authorFolder?.name || "Não vinculada"}</p>
                      <p className="mt-2 line-clamp-2 text-xs text-slate-500">{author.crimes || author.notes || "Sem informações complementares."}</p>
                    </div>
                  </div>
                </button>;
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-0 bg-white/90 soft-card ring-1 ring-slate-200/70">
          <CardContent className="p-6">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div><h2 className="flex items-center gap-2 text-xl font-black"><UserPlus className="h-5 w-5 text-orange-600" /> {editing ? "Editar card do alvo" : "Novo card do alvo"}</h2><p className="text-sm text-slate-500">Escolha a pasta e cadastre o autor/suspeito.</p></div>
              {editing && <Button variant="outline" onClick={resetForm}>Cancelar edição</Button>}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <select value={form.categoryId} onChange={(e) => updateForm("categoryId", e.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm md:col-span-3"><option value="">Selecione a pasta do card</option>{fallbackFolders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select>
              <Input placeholder="Nome completo" value={form.name} onChange={(e) => updateForm("name", e.target.value)} />
              <Input placeholder="Vulgo / alcunha" value={form.alias} onChange={(e) => updateForm("alias", e.target.value)} />
              <Input placeholder="Nome da mãe" value={form.motherName} onChange={(e) => updateForm("motherName", e.target.value)} />
              <Input type="date" value={form.birthDate} onChange={(e) => updateForm("birthDate", e.target.value)} />
              <Input placeholder="Documento / RG / CPF" value={form.document} onChange={(e) => updateForm("document", e.target.value)} />
              <select value={form.status} onChange={(e) => updateForm("status", e.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm"><option>Suspeito</option><option>Autor</option><option>Monitorado</option><option>Foragido</option><option>Preso</option></select>
              <Input placeholder="Endereço" value={form.address} onChange={(e) => updateForm("address", e.target.value)} />
              <Input placeholder="Bairro" value={form.neighborhood} onChange={(e) => updateForm("neighborhood", e.target.value)} />
              <Input placeholder="Cidade" value={form.city} onChange={(e) => updateForm("city", e.target.value)} />
              <Input placeholder="Crimes vinculados / modus operandi" value={form.crimes} onChange={(e) => updateForm("crimes", e.target.value)} />
              <select value={form.riskLevel} onChange={(e) => updateForm("riskLevel", e.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm"><option>Baixo</option><option>Médio</option><option>Alto</option></select>
              <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-md border bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
                <Camera className="h-4 w-4 text-orange-600" /> {pendingPhoto ? pendingPhoto.name : "Escolher foto"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setPendingPhoto(e.target.files?.[0] || null)} />
              </label>
              <Button onClick={submit} className="bg-orange-600 hover:bg-orange-700"><Plus className="mr-2 h-4 w-4" /> {editing ? "Salvar alterações" : "Criar card"}</Button>
              <textarea className="min-h-24 rounded-md border bg-white px-3 py-2 text-sm md:col-span-3" placeholder="Observações / vínculos / modus operandi" value={form.notes} onChange={(e) => updateForm("notes", e.target.value)} />
            </div>
          </CardContent>
        </Card>

        {selectedAuthor ? <Card className="rounded-[2rem] border-0 bg-white/90 soft-card ring-1 ring-slate-200/70">
          <CardContent className="p-6">
            <div className="mb-6 overflow-hidden rounded-3xl border bg-white shadow-sm">
              <div className="grid gap-0 md:grid-cols-[260px_1fr]">
                <div className="relative min-h-72 bg-slate-100">
                  {selectedPhotos[0] ? <a href={getIntelFileUrl(selectedPhotos[0].filePath)} target="_blank" rel="noreferrer"><img src={getIntelFileUrl(selectedPhotos[0].filePath)} alt={selectedAuthor.name} className="h-full min-h-72 w-full object-cover" /></a> : <div className="grid h-full min-h-72 place-items-center text-slate-400"><UserRound className="h-20 w-20" /></div>}
                  <div className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-black text-emerald-950 shadow">Foto principal</div>
                </div>
                <div className="p-6">
                  <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div><p className="text-xs font-black uppercase tracking-[0.25em] text-orange-600">Card selecionado</p><h2 className="mt-2 text-3xl font-black text-slate-950">{selectedAuthor.name}</h2><p className="mt-1 text-sm text-slate-500">Vulgo: <b>{selectedAuthor.alias || "Não informado"}</b></p></div>
                    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => startEdit(selectedAuthor)}><Edit3 className="mr-1 h-4 w-4" /> Editar dados</Button><Button variant="outline" className="text-red-600" onClick={() => deleteAuthor(selectedAuthor.id)}><Trash2 className="mr-1 h-4 w-4" /> Excluir card</Button></div>
                  </div>
                  <div className="mb-4 flex flex-wrap gap-2"><Badge>{selectedAuthor.status}</Badge><Badge tone={selectedAuthor.riskLevel === "Alto" ? "high" : selectedAuthor.riskLevel === "Médio" ? "medium" : "low"}>Risco: {selectedAuthor.riskLevel}</Badge><Badge tone="dark">{selectedPhotos.length} foto(s)</Badge></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 p-4"><b>Pasta:</b><br />{fallbackFolders.find((folder) => folder.id === selectedAuthor.categoryId)?.name || "Não vinculada"}</div>
                    <div className="rounded-2xl bg-slate-50 p-4"><b>Crimes:</b><br />{selectedAuthor.crimes || "Não informado"}</div>
                  </div>
                  <div className="mt-4 rounded-2xl bg-slate-50 p-4"><b>Observações:</b><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{selectedAuthor.notes || "Sem observações."}</p></div>
                </div>
              </div>
            </div>

            <div className="mb-6 rounded-3xl bg-emerald-950 p-5 text-white">
              <div className="mb-3 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-black"><ImageIcon className="h-5 w-5 text-orange-300" /> Galeria de fotos</h3><label className="cursor-pointer rounded-xl bg-orange-600 px-4 py-2 text-sm font-bold hover:bg-orange-700"><Upload className="mr-1 inline h-4 w-4" /> Subir foto<input type="file" accept="image/*" className="hidden" onChange={(e) => uploadAuthorFile(selectedAuthor, e.target.files?.[0], "photo")} /></label></div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {selectedPhotos.length === 0 && <div className="rounded-2xl bg-white/10 p-5 text-sm text-emerald-100">Nenhuma foto anexada.</div>}
                {selectedPhotos.map((file, index) => <a key={file.id} href={getIntelFileUrl(file.filePath)} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/10"><div className="relative"><img src={getIntelFileUrl(file.filePath)} alt={file.fileName} className="h-36 w-full object-cover transition group-hover:scale-105" />{index === 0 && <span className="absolute left-2 top-2 rounded-full bg-orange-600 px-2 py-1 text-[10px] font-black">Principal</span>}</div><p className="truncate p-2 text-xs text-emerald-50">{file.fileName}</p></a>)}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4"><b>Pasta:</b> {fallbackFolders.find((folder) => folder.id === selectedAuthor.categoryId)?.name || "Não vinculada"}</div>
              <div className="rounded-2xl bg-slate-50 p-4"><b>Status:</b> {selectedAuthor.status}</div>
              <div className="rounded-2xl bg-slate-50 p-4"><b>Risco:</b> {selectedAuthor.riskLevel}</div>
              <div className="rounded-2xl bg-slate-50 p-4"><b>Nascimento:</b> {selectedAuthor.birthDate || "Não informado"}</div>
              <div className="rounded-2xl bg-slate-50 p-4"><b>Mãe:</b> {selectedAuthor.motherName || "Não informado"}</div>
              <div className="rounded-2xl bg-slate-50 p-4"><b>Documento:</b> {selectedAuthor.document || "Não informado"}</div>
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-3"><b>Cidade/Bairro:</b> {[selectedAuthor.city, selectedAuthor.neighborhood].filter(Boolean).join(" / ") || "Não informado"}</div>
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-3"><b>Endereço:</b> {selectedAuthor.address || "Não informado"}</div>
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-3"><b>Crimes vinculados:</b> {selectedAuthor.crimes || "Não informado"}</div>
              <div className="rounded-2xl bg-slate-50 p-4 md:col-span-3"><b>Observações:</b><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{selectedAuthor.notes || "Sem observações."}</p></div>
            </div>

            <div className="mt-6 rounded-3xl border bg-white p-5">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><h3 className="flex items-center gap-2 font-black"><Paperclip className="h-5 w-5 text-orange-600" /> Relatórios de inteligência anexados</h3><label className="cursor-pointer rounded-xl border px-4 py-2 text-sm font-bold hover:bg-slate-50"><Upload className="mr-1 inline h-4 w-4" /> Subir relatório<input type="file" className="hidden" onChange={(e) => uploadAuthorFile(selectedAuthor, e.target.files?.[0], "report")} /></label></div>
              <div className="space-y-2">
                {selectedReports.length === 0 && <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Nenhum relatório anexado.</p>}
                {selectedReports.map((file) => <a key={file.id} href={getIntelFileUrl(file.filePath)} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border p-3 text-sm hover:bg-slate-50"><span className="flex items-center gap-2"><FileText className="h-4 w-4 text-orange-600" /> {file.fileName}</span><span className="text-xs text-slate-500">{formatBytes(file.fileSize)}</span></a>)}
              </div>
            </div>
          </CardContent>
        </Card> : <Card className="rounded-[2rem] border-0 bg-white/90 soft-card ring-1 ring-slate-200/70"><CardContent className="p-8 text-center text-sm text-slate-500">Crie ou selecione um card para visualizar os dados.</CardContent></Card>}
      </div>
    </section>
  );
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



function PermissionCard({ title, description }) {
  return (
    <Card className="rounded-[2rem] border-0 bg-white/95 soft-card ring-1 ring-red-200">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-700">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-red-700">{title}</h2>
            <p className="mt-2 text-sm text-slate-600">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExecutiveDashboard({ tasks, users, counts }) {
  const pending = tasks.filter((task) => task.status !== "Concluída").length;
  const done = counts["Concluída"] || 0;
  const late = counts["Atrasada"] || 0;
  const risk = counts["Risco de prazo"] || 0;
  const performance = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const avgChecklist = tasks.length
    ? Math.round(tasks.reduce((sum, task) => {
        const total = task.checklist?.length || 1;
        const completed = task.done?.filter(Boolean).length || 0;
        return sum + Math.round((completed / total) * 100);
      }, 0) / tasks.length)
    : 0;

  const ranking = users
    .filter((user) => user.status === "Ativo")
    .map((user) => {
      const label = user.warName || user.name;
      const assigned = tasks.filter((task) => task.responsible === label);
      const completed = assigned.filter((task) => task.status === "Concluída").length;
      const open = assigned.length - completed;
      return { label, assigned: assigned.length, completed, open };
    })
    .sort((a, b) => b.assigned - a.assigned)
    .slice(0, 6);

  const byType = ["Inteligência", "Dossiê", "Operacional", "Relatório", "Gestão"].map((type) => ({
    type,
    total: tasks.filter((task) => task.type === type).length,
  }));

  return (
    <section className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-slate-950 to-black text-white shadow-2xl">
        <div className="relative p-7">
          <div className="absolute right-8 top-6 text-8xl opacity-10">📊</div>
          <p className="text-xs font-black uppercase tracking-[0.35em] text-orange-300">Dashboard executivo</p>
          <h2 className="mt-2 text-3xl font-black">Indicadores operacionais</h2>
          <p className="mt-2 max-w-2xl text-sm text-emerald-100">Visão consolidada de produtividade, prazos, risco e volume de demandas.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-[1.7rem] bg-white/95 p-5 soft-card ring-1 ring-slate-200/70">
          <BarChart3 className="mb-3 h-6 w-6 text-orange-600" />
          <p className="text-sm font-bold text-slate-500">Total</p>
          <p className="text-4xl font-black">{tasks.length}</p>
        </div>
        <div className="rounded-[1.7rem] bg-white/95 p-5 soft-card ring-1 ring-slate-200/70">
          <TimerReset className="mb-3 h-6 w-6 text-blue-600" />
          <p className="text-sm font-bold text-slate-500">Pendências</p>
          <p className="text-4xl font-black">{pending}</p>
        </div>
        <div className="rounded-[1.7rem] bg-white/95 p-5 soft-card ring-1 ring-slate-200/70">
          <AlertTriangle className="mb-3 h-6 w-6 text-red-600" />
          <p className="text-sm font-bold text-slate-500">Atrasadas</p>
          <p className="text-4xl font-black">{late}</p>
        </div>
        <div className="rounded-[1.7rem] bg-white/95 p-5 soft-card ring-1 ring-slate-200/70">
          <TrendingUp className="mb-3 h-6 w-6 text-emerald-600" />
          <p className="text-sm font-bold text-slate-500">Conclusão</p>
          <p className="text-4xl font-black">{performance}%</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card className="rounded-[2rem] border-0 bg-white/95 soft-card ring-1 ring-slate-200/70">
          <CardContent className="p-6">
            <h3 className="mb-5 text-xl font-black">Produtividade por responsável</h3>
            <div className="space-y-3">
              {ranking.map((item) => {
                const percent = item.assigned ? Math.round((item.completed / item.assigned) * 100) : 0;
                return (
                  <div key={item.label} className="rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-black">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.assigned} demandas • {item.open} abertas • {item.completed} concluídas</p>
                      </div>
                      <Badge tone={percent >= 70 ? "low" : percent >= 40 ? "medium" : "default"}>{percent}%</Badge>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-orange-600" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
              {ranking.length === 0 && <p className="text-sm text-slate-500">Nenhum responsável ativo.</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-0 bg-white/95 soft-card ring-1 ring-slate-200/70">
          <CardContent className="p-6">
            <h3 className="mb-5 text-xl font-black">Distribuição por tipo</h3>
            <div className="space-y-3">
              {byType.map((item) => {
                const percent = tasks.length ? Math.round((item.total / tasks.length) * 100) : 0;
                return (
                  <div key={item.type}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-bold">{item.type}</span>
                      <span>{item.total} • {percent}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-700" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 rounded-2xl bg-emerald-950 p-4 text-white">
              <p className="text-sm text-emerald-100">Progresso médio de checklist</p>
              <p className="text-3xl font-black">{avgChecklist}%</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
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
  const [searchDate, setSearchDate] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newResponsible, setNewResponsible] = useState("");
  const [newWorkflow, setNewWorkflow] = useState("");
  const [workflows, setWorkflows] = useState([]);
  const [workflowName, setWorkflowName] = useState("");
  const [monthDate, setMonthDate] = useState(new Date());
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [authorCategories, setAuthorCategories] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [authorPhotos, setAuthorPhotos] = useState([]);
  const [authorReports, setAuthorReports] = useState([]);
  const [message, setMessage] = useState("");
  const [demandScreenStatus, setDemandScreenStatus] = useState(null);
  const [currentView, setCurrentView] = useState("painel");
  const [tvOpen, setTvOpen] = useState(false);

  const counts = useMemo(() => getStatusCounts(tasks), [tasks]);
  const permissions = getPermissions(currentUser);
  const isAdmin = Boolean(permissions.users);

  const notify = (text) => { setMessage(text); window.setTimeout(() => setMessage(""), 2500); };

  async function addAudit(action, details) {
    if (!currentUser) return;
    await supabase.from("audit_logs").insert({
      user_id: currentUser.id,
      user_name: currentUser.warName || currentUser.name,
      user_role: currentUser.role,
      action,
      details,
      user_agent: navigator.userAgent,
    });
  }

  async function loadData() {
    const [usersRes, workflowsRes, tasksRes, logsRes, attachmentsRes, authorCategoriesRes, authorsRes, authorPhotosRes, authorReportsRes] = await Promise.all([
      supabase.from("app_users").select("id,name,war_name,register,unit,role,email,phone,login,status").order("created_at", { ascending: false }),
      supabase.from("workflows").select("*").order("position", { ascending: true }),
      supabase.from("demands").select("*, responsible:app_users!demands_responsible_id_fkey(*), manager:app_users!demands_manager_id_fkey(*), workflow:workflows(*)").order("created_at", { ascending: false }),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("demand_attachments").select("*").order("created_at", { ascending: false }),
      supabase.from("author_folders").select("*").order("name", { ascending: true }),
      supabase.from("crime_authors").select("*").order("created_at", { ascending: false }),
      supabase.from("author_photos").select("*").order("created_at", { ascending: false }),
      supabase.from("author_reports").select("*").order("created_at", { ascending: false }),
    ]);
    if (usersRes.error) {
      console.error("Erro ao carregar usuários:", usersRes.error);
      notify("Erro ao carregar usuários do Supabase. Verifique permissões RLS.");
    }
    if (usersRes.data) {
      const normalizedUsers = usersRes.data.map(normalizeUser);
      setUsers(normalizedUsers);
      if (currentUser?.id) {
        const freshUser = normalizedUsers.find((u) => u.id === currentUser.id);
        if (freshUser) {
          setCurrentUser(freshUser);
          localStorage.setItem("si6_session_user", JSON.stringify(freshUser));
        }
      }
    }
    if (workflowsRes.data) setWorkflows(workflowsRes.data.map(normalizeWorkflow));
    if (tasksRes.data) setTasks(tasksRes.data.map(normalizeTask));
    if (logsRes.data) setAuditLogs(logsRes.data);
    if (attachmentsRes.data) setAttachments(attachmentsRes.data.map(normalizeAttachment));
    if (authorCategoriesRes.data) setAuthorCategories(authorCategoriesRes.data.map(normalizeAuthorCategory));
    if (authorsRes.data) setAuthors(authorsRes.data.map(normalizeAuthor));
    if (authorPhotosRes.data) setAuthorPhotos(authorPhotosRes.data.map(normalizeAuthorFile));
    if (authorReportsRes.data) setAuthorReports(authorReportsRes.data.map(normalizeAuthorFile));
  }

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const channel = supabase.channel("si6cia-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "app_users" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "workflows" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "demands" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "demand_attachments" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "author_folders" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "crime_authors" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "author_photos" }, loadData)
      .on("postgres_changes", { event: "*", schema: "public", table: "author_reports" }, loadData)
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
    const normalizedSearch = search.trim().toLowerCase();
    const hasSearch = normalizedSearch.length > 0 || Boolean(searchDate);
    const isVisibleInDefaultList = isOpenTask(task) || isSameMonthDate(task.date, monthDate);
    const byDefaultVisibility = hasSearch ? true : isVisibleInDefaultList;
    const byStatus = statusFilter === "Todas" || task.status === statusFilter;
    const bySearch = !normalizedSearch || `${task.title} ${task.type} ${task.responsible} ${task.manager} ${task.workflow} ${task.notes}`.toLowerCase().includes(normalizedSearch);
    const bySearchDate = !searchDate || task.date === searchDate || task.internalDeadline === searchDate || task.officialDeadline === searchDate || task.overdueDate === searchDate;
    return byDefaultVisibility && byStatus && bySearch && bySearchDate;
  }), [tasks, monthDate, statusFilter, search, searchDate]);

  const openTasks = useMemo(() => tasks.filter(isOpenTask), [tasks]);

  async function handleLogin(login, password) {
    const { data, error } = await supabase.rpc("login_user", { p_login: login, p_password: password });
    if (error || !data || data.length === 0) return alert("Usuário ou senha inválidos, ou usuário inativo.");
    const user = normalizeUser(data[0]);
    setCurrentUser(user); setLogged(true); localStorage.setItem("si6_session_user", JSON.stringify(user));
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      user_name: user.warName || user.name,
      user_role: user.role,
      action: "Login",
      details: `Usuário ${user.warName || user.name} acessou o sistema.`,
    });
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

  async function addQuickTask({ title, responsibleId, date, type = "Inteligência", priority = "Média", notes, overdueDate, recurrence = "none", recurrenceCount = 1 }) {
    if (!responsibleId) return notify("Selecione um responsável cadastrado.");
    const wf = workflows[0];
    const dates = buildRecurringDates(date, recurrence, recurrenceCount);
    const rows = dates.map((itemDate) => ({
      title, type, status: "A fazer", priority, responsible_id: responsibleId, manager_id: currentUser?.id || null,
      date: itemDate, official_deadline: itemDate, internal_deadline: itemDate, overdue_date: recurrence === "none" ? (overdueDate || itemDate) : itemDate,
      workflow_id: wf?.id || null,
      checklist: ["Triar demanda", "Executar atividade", "Registrar conclusão"],
      done: [false, false, false],
      notes,
    }));
    const { error } = await supabase.from("demands").insert(rows);
    if (error) return notify("Erro ao adicionar atividade.");
    await addAudit("Demanda criada pelo calendário", `Criou a demanda: ${title}${rows.length > 1 ? ` (${rows.length} recorrências)` : ""}.`);
    notify(rows.length > 1 ? "Demandas recorrentes adicionadas ao calendário." : "Atividade adicionada ao calendário.");
  }

  async function updateTask(id, values) {
    if (!values?.title?.trim()) return notify("Informe o título da demanda.");
    if (!values?.responsibleId) return notify("Selecione um responsável cadastrado.");
    const { error } = await supabase.from("demands").update({
      title: values.title,
      type: values.type,
      status: values.status,
      priority: values.priority,
      responsible_id: values.responsibleId,
      date: values.date,
      official_deadline: values.date,
      internal_deadline: values.overdueDate || values.date,
      overdue_date: values.overdueDate || values.date,
      notes: values.notes,
    }).eq("id", id);
    if (error) return notify("Erro ao editar demanda.");
    await addAudit("Demanda editada", `Editou a demanda: ${values.title}.`);
    notify("Demanda editada com sucesso.");
  }

  function getAttachmentUrl(path) {
    return supabase.storage.from("demand-files").getPublicUrl(path).data.publicUrl;
  }

  async function uploadDemandFile(task, file) {
    if (!file) return;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${task.id}/${Date.now()}-${safeName}`;
    const upload = await supabase.storage.from("demand-files").upload(path, file, { upsert: false });
    if (upload.error) return notify("Erro ao subir arquivo. Verifique se o bucket demand-files existe.");
    const { error } = await supabase.from("demand_attachments").insert({
      demand_id: task.id,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: currentUser?.id || null,
    });
    if (error) return notify("Arquivo enviado, mas houve erro ao registrar o anexo.");
    await addAudit("Arquivo anexado", `Anexou arquivo na demanda: ${task.title}.`);
    notify("Arquivo anexado com sucesso.");
  }

  function getIntelFileUrl(path) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return supabase.storage.from("intelligence-files").getPublicUrl(path).data.publicUrl;
  }

  async function addAuthorCategory(category) {
    const name = category?.name?.trim();
    if (!name) return notify("Informe o nome da pasta.");
    const { data, error } = await supabase.from("author_folders").insert({
      name,
      description: category.description || "",
      created_by: currentUser?.id || null,
    }).select("*").single();
    if (error) { notify("Erro ao criar pasta. Execute o SQL atualizado no Supabase."); return null; }
    await addAudit("Pasta criminal criada", `Criou a pasta: ${name}.`);
    notify("Pasta criada com sucesso.");
    await loadData();
    return normalizeAuthorCategory(data);
  }

  async function deleteAuthorCategory(id) {
    const inUse = authors.some((author) => author.categoryId === id);
    if (inUse) return notify("Esta pasta possui cards vinculados e não pode ser excluída.");
    if (!window.confirm("Excluir esta pasta vazia?")) return;
    const { error } = await supabase.from("author_folders").delete().eq("id", id);
    if (error) return notify("Erro ao excluir pasta.");
    await addAudit("Pasta criminal excluída", "Excluiu uma pasta vazia do Banco de Alvos.");
    notify("Pasta excluída.");
  }

  async function addAuthor(form) {
    if (!form?.name?.trim()) return notify("Informe o nome do autor/suspeito.");
    const { data, error } = await supabase.from("crime_authors").insert({
      name: form.name,
      alias: form.alias,
      mother_name: form.motherName,
      birth_date: form.birthDate || null,
      document: form.document,
      address: form.address,
      neighborhood: form.neighborhood,
      city: form.city,
      crimes: form.crimes,
      folder_id: form.categoryId || null,
      status: form.status,
      risk_level: form.riskLevel,
      notes: form.notes,
      created_by: currentUser?.id || null,
    }).select("*").single();
    if (error) { notify("Erro ao criar pasta do autor/suspeito."); return null; }
    await addAudit("Pasta de autor criada", `Criou pasta de inteligência para: ${form.name}.`);
    notify("Pasta criada com sucesso.");
    await loadData();
    return normalizeAuthor(data);
  }

  async function updateAuthor(id, form) {
    if (!form?.name?.trim()) return notify("Informe o nome do autor/suspeito.");
    const { error } = await supabase.from("crime_authors").update({
      name: form.name,
      alias: form.alias,
      mother_name: form.motherName,
      birth_date: form.birthDate || null,
      document: form.document,
      address: form.address,
      neighborhood: form.neighborhood,
      city: form.city,
      crimes: form.crimes,
      folder_id: form.categoryId || null,
      status: form.status,
      risk_level: form.riskLevel,
      notes: form.notes,
    }).eq("id", id);
    if (error) return notify("Erro ao atualizar pasta.");
    await addAudit("Pasta de autor atualizada", `Atualizou dados de: ${form.name}.`);
    notify("Pasta atualizada com sucesso.");
    await loadData();
    return true;
  }

  async function deleteAuthor(id) {
    if (!window.confirm("Excluir esta pasta e seus registros do banco?")) return;
    const { error } = await supabase.from("crime_authors").delete().eq("id", id);
    if (error) return notify("Erro ao excluir pasta.");
    await addAudit("Pasta de autor excluída", "Excluiu uma pasta de autor/suspeito.");
    notify("Pasta excluída.");
  }

  async function uploadAuthorFile(author, file, kind = "report") {
    if (!file || !author?.id) return;
    const table = kind === "photo" ? "author_photos" : "author_reports";
    const folder = kind === "photo" ? "fotos" : "relatorios";
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${author.id}/${folder}/${Date.now()}-${safeName}`;
    const upload = await supabase.storage.from("intelligence-files").upload(path, file, { upsert: false });
    if (upload.error) return notify("Erro ao subir arquivo. Verifique se o bucket intelligence-files existe.");
    const { error } = await supabase.from(table).insert({
      author_id: author.id,
      file_name: file.name,
      file_path: path,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: currentUser?.id || null,
    });
    if (error) return notify("Arquivo enviado, mas houve erro ao registrar no banco.");
    await addAudit(kind === "photo" ? "Foto anexada" : "Relatório anexado", `Anexou arquivo na pasta: ${author.name}.`);
    notify(kind === "photo" ? "Foto anexada com sucesso." : "Relatório anexado com sucesso.");
    await loadData();
  }

  async function importTrelloBoard(board) {
    if (!board?.lists || !board?.cards) return notify("JSON do Trello inválido.");
    const folderName = (board.name || "Importado do Trello").trim();
    let folderId = null;
    const existingFolder = await supabase.from("author_folders").select("*").eq("name", folderName).maybeSingle();
    if (existingFolder.data?.id) {
      folderId = existingFolder.data.id;
    } else {
      const createdFolder = await supabase.from("author_folders").insert({ name: folderName, description: "Importado do JSON do Trello", created_by: currentUser?.id || null }).select("*").single();
      if (createdFolder.error) return notify("Erro ao criar pasta de importação do Trello.");
      folderId = createdFolder.data.id;
    }

    const cardsByList = (board.cards || []).reduce((acc, card) => {
      if (card.closed) return acc;
      const listId = card.idList;
      if (!acc[listId]) acc[listId] = [];
      acc[listId].push(card);
      return acc;
    }, {});

    let importedAuthors = 0;
    let importedFiles = 0;
    for (const list of board.lists || []) {
      if (list.closed) continue;
      const listCards = cardsByList[list.id] || [];
      const parsed = parseTrelloAuthor(list.name, listCards);
      if (!parsed.name || parsed.name === "Autor sem nome") continue;

      const maybeExisting = await supabase
        .from("crime_authors")
        .select("*")
        .eq("name", parsed.name)
        .eq("folder_id", folderId)
        .maybeSingle();

      let authorRow = maybeExisting.data;
      if (!authorRow?.id) {
        const created = await supabase.from("crime_authors").insert({
          name: parsed.name,
          alias: parsed.alias,
          document: parsed.document,
          crimes: parsed.crimes,
          folder_id: folderId,
          status: parsed.status,
          risk_level: parsed.riskLevel,
          notes: parsed.notes,
          created_by: currentUser?.id || null,
        }).select("*").single();
        if (created.error) continue;
        authorRow = created.data;
        importedAuthors += 1;
      } else {
        await supabase.from("crime_authors").update({
          alias: authorRow.alias || parsed.alias,
          document: authorRow.document || parsed.document,
          crimes: authorRow.crimes || parsed.crimes,
          notes: [authorRow.notes, parsed.notes].filter(Boolean).join("\n\n"),
        }).eq("id", authorRow.id);
      }

      const attachments = listCards.flatMap((card) => (card.attachments || []).map((attachment) => ({ ...attachment, cardName: card.name })));
      for (const attachment of attachments) {
        const url = getTrelloAttachmentUrl(attachment);
        if (!url) continue;
        const table = isImageAttachment(attachment) ? "author_photos" : "author_reports";
        const exists = await supabase.from(table).select("id").eq("author_id", authorRow.id).eq("file_path", url).maybeSingle();
        if (exists.data?.id) continue;
        const insertedFile = await supabase.from(table).insert({
          author_id: authorRow.id,
          file_name: attachment.name || attachment.cardName || "Anexo Trello",
          file_path: url,
          file_size: attachment.bytes || 0,
          mime_type: attachment.mimeType || (isImageAttachment(attachment) ? "image/*" : ""),
          description: "Importado do Trello",
          uploaded_by: currentUser?.id || null,
        });
        if (!insertedFile.error) importedFiles += 1;
      }
    }

    await addAudit("Importação Trello", `Importou ${importedAuthors} alvo(s) e ${importedFiles} anexo(s) do quadro ${folderName}.`);
    notify(`Importação concluída: ${importedAuthors} alvo(s) e ${importedFiles} anexo(s).`);
    await loadData();
    return folderId;
  }

  async function deleteTask(id) {
    if (!permissions.deleteDemand) return notify("Seu perfil não possui permissão para excluir demandas.");
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
    if (!permissions.manageWorkflow) return notify("Seu perfil não possui permissão para criar workflow.");
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
    if (!permissions.deleteWorkflow) return notify("Seu perfil não possui permissão para excluir workflow.");
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
            <Button variant="secondary" className="!bg-white/10 !text-white hover:!bg-white/20 ring-1 ring-white/10" onClick={() => { setCurrentView("suspeitos"); setDemandScreenStatus(null); }}>Autores/Suspeitos</Button>
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
              <CalendarBoard tasks={tasks} selectedDate={selectedDate} setSelectedDate={setSelectedDate} monthDate={monthDate} setMonthDate={setMonthDate} addQuickTask={addQuickTask} updateTask={updateTask} updateTaskStatus={updateTaskStatus} deleteTask={deleteTask} postponeTask={postponeTask} users={users} attachments={attachments} uploadDemandFile={uploadDemandFile} getAttachmentUrl={getAttachmentUrl} />
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
                    <div><h2 className="flex items-center gap-2 text-xl font-black"><LayoutDashboard className="h-5 w-5 text-orange-600" /> Tela de tarefas</h2><p className="text-sm text-slate-500">Em aberto sempre visíveis; concluídas aparecem somente no mês atual. A pesquisa consulta todo o histórico.</p></div>
                    <div className="flex flex-wrap gap-2"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input className="pl-9" placeholder="Pesquisar em todas" value={search} onChange={(e) => setSearch(e.target.value)} /></div><Input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} className="w-40" title="Pesquisar por data" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-md border bg-white px-3 text-sm"><option>Todas</option>{statuses.map((s)=><option key={s}>{s}</option>)}</select>{(search || searchDate) && <Button variant="outline" onClick={() => { setSearch(""); setSearchDate(""); }}>Limpar</Button>}</div>
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
                  <div className="grid gap-3 md:grid-cols-5">{workflows.map((flow,index)=>{const inUse=openTasks.some((t)=>t.workflowId===flow.id);return <div key={flow.id} className="rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-slate-100"><p className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-950 text-sm font-black text-white">{index+1}</p><p className="text-sm font-bold">{flow.name}</p><p className="mt-1 text-xs text-slate-500">{inUse?"Em uso":"Livre"}</p>{!inUse&&<Button size="sm" variant="outline" onClick={()=>deleteWorkflow(flow)} className="mt-3 text-red-600"><Trash2 className="mr-1 h-3 w-3" /> Excluir</Button>}</div>})}</div>
                </CardContent>
              </Card>
              <ProcessTracker tasks={openTasks} workflows={workflows} setTaskWorkflow={setTaskWorkflow} setTaskStatus={updateTaskStatus} />
            </section>
          </>
        )}

        {currentView === "dashboard" && permissions.dashboard && <ExecutiveDashboard tasks={tasks} users={users} counts={counts} />}
        {currentView === "dashboard" && !permissions.dashboard && <PermissionCard title="Acesso restrito" description="Seu perfil não possui permissão para acessar o dashboard executivo." />}
        {currentView === "usuarios" && isAdmin && <UserManagement users={users} addUser={addUser} deleteUser={deleteUser} toggleUserStatus={toggleUserStatus} />}
        {currentView === "usuarios" && !isAdmin && <Card className="rounded-[2rem] border-0 bg-white/90 soft-card ring-1 ring-slate-200/70"><CardContent className="p-6"><h2 className="text-xl font-black text-red-600">Acesso restrito</h2><p className="mt-2 text-sm text-slate-500">Somente o administrador pode acessar o cadastro e gestão de usuários.</p></CardContent></Card>}
        {currentView === "suspeitos" && <AuthorIntelligencePanel categories={authorCategories} authors={authors} photos={authorPhotos} reports={authorReports} addAuthorCategory={addAuthorCategory} deleteAuthorCategory={deleteAuthorCategory} addAuthor={addAuthor} updateAuthor={updateAuthor} deleteAuthor={deleteAuthor} uploadAuthorFile={uploadAuthorFile} importTrelloBoard={importTrelloBoard} getIntelFileUrl={getIntelFileUrl} />}
      </main>
    </div>
  );
}
