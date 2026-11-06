import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMAND_BUCKET, INTEL_BUCKET, supabase } from "../supabase";
import {
  AppUser, Attachment, AuditLog, Author, AuthorCategory, AuthorFile, DEFAULT_CHECKLIST, MAIN_ADMIN_LOGIN, Task, Workflow,
  getPermissions, normalizeAttachment, normalizeAuthor, normalizeAuthorCategory, normalizeAuthorFile, normalizeTask,
  normalizeUser, normalizeWorkflow, safeFileName,
} from "../lib/domain";
import { Recurrence, addDays, buildRecurringDates, daysBetween, todayISO } from "../lib/dates";
import { isImageAttachment, parseTrelloAuthor, trelloAttachmentUrl } from "../lib/trello";

const SESSION_KEY = "si6_session_user";

export type Notify = (text: string, tone?: "success" | "error" | "info") => void;

export type TaskInput = {
  title: string; responsibleId: string; date: string; type?: string; priority?: string; notes?: string;
  overdueDate?: string; officialDeadline?: string; recurrence?: Recurrence; recurrenceCount?: number;
  workflowId?: string; checklist?: string[]; status?: string;
};

function readSession(): AppUser | null {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; }
}

export function useAppData(notify: Notify) {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(readSession);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(todayISO());
  const [users, setUsers] = useState<AppUser[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [taskRows, setTaskRows] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [authorCategories, setAuthorCategories] = useState<AuthorCategory[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [authorPhotos, setAuthorPhotos] = useState<AuthorFile[]>([]);
  const [authorReports, setAuthorReports] = useState<AuthorFile[]>([]);

  const userRef = useRef(currentUser);
  userRef.current = currentUser;
  const loadingRef = useRef(false);
  const pendingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  // Os status por prazo são recalculados sempre que o dia muda.
  const tasks = useMemo(() => taskRows.map((row) => normalizeTask(row, today)), [taskRows, today]);
  const permissions = getPermissions(currentUser);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setCurrentUser(null);
  }, []);

  const loadData = useCallback(async () => {
    if (loadingRef.current) { pendingRef.current = true; return; }
    loadingRef.current = true;
    try {
      const [usersRes, workflowsRes, tasksRes, logsRes, attachmentsRes, categoriesRes, authorsRes, photosRes, reportsRes] = await Promise.all([
        supabase.from("app_users").select("id,name,war_name,register,unit,role,email,phone,login,status").order("created_at", { ascending: false }),
        supabase.from("workflows").select("*").order("position", { ascending: true }),
        supabase.from("demands").select("*, responsible:app_users!demands_responsible_id_fkey(id,name,war_name), manager:app_users!demands_manager_id_fkey(id,name,war_name), workflow:workflows(id,name,position)").order("date", { ascending: true }),
        supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("demand_attachments").select("*").order("created_at", { ascending: false }),
        supabase.from("author_folders").select("*").order("name", { ascending: true }),
        supabase.from("crime_authors").select("*").order("created_at", { ascending: false }),
        supabase.from("author_photos").select("*").order("created_at", { ascending: true }),
        supabase.from("author_reports").select("*").order("created_at", { ascending: false }),
      ]);

      if (usersRes.error) notify("Erro ao carregar usuários. Verifique as políticas RLS da tabela app_users.", "error");
      if (tasksRes.error) notify("Erro ao carregar demandas do Supabase.", "error");

      if (usersRes.data) {
        const list = usersRes.data.map(normalizeUser);
        setUsers(list);
        const sessionUser = userRef.current;
        if (sessionUser?.id) {
          // A sessão local só vale enquanto o usuário existir e estiver ativo no banco.
          const fresh = list.find((user) => user.id === sessionUser.id);
          if (!fresh || fresh.status !== "Ativo") {
            logout();
            notify("Sua sessão foi encerrada: usuário removido ou inativo.", "error");
          } else {
            setCurrentUser(fresh);
            localStorage.setItem(SESSION_KEY, JSON.stringify(fresh));
          }
        }
      }
      if (workflowsRes.data) setWorkflows(workflowsRes.data.map(normalizeWorkflow).sort((a, b) => a.position - b.position));
      if (tasksRes.data) setTaskRows(tasksRes.data);
      if (logsRes.data) setAuditLogs(logsRes.data as AuditLog[]);
      if (attachmentsRes.data) setAttachments(attachmentsRes.data.map(normalizeAttachment));
      if (categoriesRes.data) setAuthorCategories(categoriesRes.data.map(normalizeAuthorCategory));
      if (authorsRes.data) setAuthors(authorsRes.data.map(normalizeAuthor));
      if (photosRes.data) setAuthorPhotos(photosRes.data.map(normalizeAuthorFile));
      if (reportsRes.data) setAuthorReports(reportsRes.data.map(normalizeAuthorFile));
    } catch (error) {
      console.error(error);
      notify("Falha de conexão com o Supabase.", "error");
    } finally {
      loadingRef.current = false;
      setLoading(false);
      if (pendingRef.current) { pendingRef.current = false; loadData(); }
    }
  }, [logout, notify]);

  /** Agrupa várias mudanças seguidas (realtime + ações) em uma única recarga. */
  const reload = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(loadData, 350);
  }, [loadData]);

  useEffect(() => {
    if (!currentUser) return undefined;
    loadData();
    const tables = ["app_users", "workflows", "demands", "audit_logs", "demand_attachments", "author_folders", "crime_authors", "author_photos", "author_reports"];
    const channel = tables.reduce((ch, table) => ch.on("postgres_changes" as any, { event: "*", schema: "public", table }, reload), supabase.channel("si6cia-live"));
    channel.subscribe();
    const poll = window.setInterval(loadData, 60000);
    const clock = window.setInterval(() => setToday(todayISO()), 60000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  async function addAudit(action: string, details: string) {
    const user = userRef.current;
    if (!user) return;
    await supabase.from("audit_logs").insert({
      user_id: user.id, user_name: user.warName || user.name, user_role: user.role, action, details, user_agent: navigator.userAgent,
    });
  }

  // ---------- Sessão ----------
  async function login(loginName: string, password: string) {
    const { data, error } = await supabase.rpc("login_user", { p_login: loginName, p_password: password });
    if (error || !data || data.length === 0) return false;
    const user = normalizeUser(data[0]);
    if (user.status !== "Ativo") return false;
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setCurrentUser(user);
    userRef.current = user;
    await addAudit("Login", `Usuário ${user.warName || user.name} acessou o sistema.`);
    return true;
  }

  // ---------- Usuários ----------
  async function addUser(user: any) {
    if (users.some((item) => item.login.toLowerCase() === user.login.toLowerCase())) { notify("Já existe usuário com esse login.", "error"); return false; }
    const { error } = await supabase.rpc("create_app_user", {
      p_name: user.name, p_war_name: user.warName || user.name, p_register: user.register, p_unit: user.unit, p_role: user.role,
      p_email: user.email, p_phone: user.phone, p_login: user.login, p_password: user.password, p_status: user.status,
    });
    if (error) { notify("Erro ao cadastrar usuário.", "error"); return false; }
    await addAudit("Usuário cadastrado", `Cadastrou o usuário: ${user.warName || user.name}.`);
    notify("Usuário cadastrado com sucesso.");
    reload();
    return true;
  }

  async function updateUser(id: string, values: Partial<AppUser>) {
    const { error } = await supabase.from("app_users").update({
      name: values.name, war_name: values.warName, register: values.register, unit: values.unit,
      role: values.role, email: values.email, phone: values.phone,
    }).eq("id", id);
    if (error) { notify("Erro ao atualizar usuário.", "error"); return false; }
    await addAudit("Usuário atualizado", `Atualizou o usuário: ${values.warName || values.name}.`);
    notify("Usuário atualizado.");
    reload();
    return true;
  }

  async function deleteUser(user: AppUser) {
    if (user.login.toUpperCase() === MAIN_ADMIN_LOGIN) return notify("O administrador principal não pode ser excluído.", "error");
    if (user.id === currentUser?.id) return notify("Você não pode excluir o próprio usuário.", "error");
    if (tasks.some((task) => task.responsibleId === user.id && task.status !== "Concluída")) return notify("Este usuário tem demandas em aberto. Transfira-as ou inative o usuário.", "error");
    if (!window.confirm(`Excluir o usuário ${user.warName || user.name}?`)) return;
    const { error } = await supabase.from("app_users").delete().eq("id", user.id);
    if (error) return notify("Erro ao excluir usuário (ele pode ter demandas vinculadas).", "error");
    await addAudit("Usuário removido", `Removeu o usuário: ${user.warName || user.name}.`);
    notify("Usuário removido.");
    reload();
  }

  async function toggleUserStatus(user: AppUser) {
    if (user.login.toUpperCase() === MAIN_ADMIN_LOGIN && user.status === "Ativo") return notify("O administrador principal não pode ser inativado.", "error");
    const status = user.status === "Ativo" ? "Inativo" : "Ativo";
    const { error } = await supabase.from("app_users").update({ status }).eq("id", user.id);
    if (error) return notify("Erro ao alterar usuário.", "error");
    await addAudit("Situação de usuário alterada", `Alterou ${user.warName || user.name} para ${status}.`);
    notify(`Usuário ${status === "Ativo" ? "ativado" : "inativado"}.`);
    reload();
  }

  // ---------- Demandas ----------
  async function createTasks(input: TaskInput, options: { silent?: boolean } = {}) {
    if (!input.title?.trim()) { notify("Informe o título da demanda.", "error"); return null; }
    if (!input.responsibleId) { notify("Selecione um responsável.", "error"); return null; }
    const dates = buildRecurringDates(input.date, input.recurrence || "none", input.recurrenceCount || 1);
    const checklist = input.checklist?.length ? input.checklist : DEFAULT_CHECKLIST;
    const workflowId = input.workflowId || workflows[0]?.id || null;
    // Em recorrências, cada cópia mantém a mesma folga entre data e prazo.
    const offset = input.overdueDate ? Math.max(0, daysBetween(input.overdueDate, input.date) || 0) : 0;
    const rows = dates.map((itemDate) => {
      const overdueISO = addDays(itemDate, offset);
      return {
        title: input.title.trim(), type: input.type || "Inteligência", status: input.status || "A fazer", priority: input.priority || "Média",
        responsible_id: input.responsibleId, manager_id: currentUser?.id || null,
        date: itemDate, official_deadline: input.officialDeadline || overdueISO, internal_deadline: overdueISO, overdue_date: overdueISO,
        workflow_id: workflowId, checklist, done: checklist.map(() => false), notes: input.notes || "",
      };
    });
    const { data, error } = await supabase.from("demands").insert(rows).select("id,title");
    if (error) { console.error(error); notify("Erro ao cadastrar demanda.", "error"); return null; }
    await addAudit("Demanda criada", `Criou a demanda: ${input.title}${rows.length > 1 ? ` (${rows.length} recorrências)` : ""}.`);
    if (!options.silent) notify(rows.length > 1 ? `${rows.length} demandas recorrentes cadastradas.` : "Demanda cadastrada.");
    reload();
    return data || [];
  }

  async function updateTask(id: string, values: TaskInput) {
    if (!values.title?.trim()) { notify("Informe o título da demanda.", "error"); return false; }
    if (!values.responsibleId) { notify("Selecione um responsável.", "error"); return false; }
    const overdue = values.overdueDate || values.date;
    const previous = tasks.find((task) => task.id === id);
    const extra: any = {};
    if (values.checklist?.length) {
      // Mantém marcados os itens que continuaram na lista.
      extra.checklist = values.checklist;
      extra.done = values.checklist.map((item) => {
        const index = previous ? previous.checklist.indexOf(item) : -1;
        return values.status === "Concluída" || (index >= 0 && Boolean(previous?.done[index]));
      });
    }
    const { error } = await supabase.from("demands").update({
      title: values.title.trim(), type: values.type, status: values.status, priority: values.priority,
      responsible_id: values.responsibleId, date: values.date,
      official_deadline: values.officialDeadline || overdue, internal_deadline: overdue, overdue_date: overdue,
      workflow_id: values.workflowId || null, notes: values.notes, ...extra,
    }).eq("id", id);
    if (error) { notify("Erro ao editar demanda.", "error"); return false; }
    await addAudit("Demanda editada", `Editou a demanda: ${values.title}.`);
    notify("Demanda atualizada.");
    reload();
    return true;
  }

  async function setTaskStatus(task: Task, status: string) {
    const values: any = { status };
    if (status === "Concluída") values.done = task.checklist.map(() => true);
    const { error } = await supabase.from("demands").update(values).eq("id", task.id);
    if (error) return notify("Erro ao atualizar status.", "error");
    await addAudit("Status atualizado", `Alterou ${task.title} para: ${status}.`);
    notify(status === "Concluída" ? "Demanda concluída." : `Status: ${status}.`);
    reload();
  }

  async function deleteTask(task: Task) {
    if (!permissions.deleteDemand) return notify("Seu perfil não pode excluir demandas.", "error");
    if (!window.confirm(`Excluir a demanda "${task.title}"?`)) return;
    const files = attachments.filter((file) => file.demandId === task.id).map((file) => file.filePath);
    const { error } = await supabase.from("demands").delete().eq("id", task.id);
    if (error) return notify("Erro ao excluir demanda.", "error");
    if (files.length) await supabase.storage.from(DEMAND_BUCKET).remove(files);
    await addAudit("Demanda excluída", `Excluiu a demanda: ${task.title}.`);
    notify("Demanda excluída.");
    reload();
  }

  async function toggleChecklistItem(task: Task, index: number) {
    const done = task.done.map((value, i) => (i === index ? !value : value));
    const allDone = done.every(Boolean);
    const status = allDone ? "Concluída" : task.storedStatus === "Concluída" ? "A fazer" : task.storedStatus;
    // Atualização otimista: o checkbox responde na hora.
    setTaskRows((rows) => rows.map((row) => (row.id === task.id ? { ...row, done, status } : row)));
    const { error } = await supabase.from("demands").update({ done, status }).eq("id", task.id);
    if (error) { notify("Erro ao alterar checklist.", "error"); reload(); return; }
    if (allDone) notify("Checklist completo: demanda concluída.");
    await addAudit("Checklist alterado", `Alterou o checklist de: ${task.title}.`);
  }

  async function postponeTask(task: Task, newDate: string) {
    const { error } = await supabase.from("demands").update({
      overdue_date: newDate, internal_deadline: newDate,
      status: task.storedStatus === "Atrasada" || task.storedStatus === "Risco de prazo" ? "A fazer" : task.storedStatus,
    }).eq("id", task.id);
    if (error) return notify("Erro ao postergar demanda.", "error");
    await addAudit("Demanda postergada", `Postergou ${task.title} para ${newDate}.`);
    notify("Prazo postergado.");
    reload();
  }

  async function duplicateTask(task: Task) {
    const { error } = await supabase.from("demands").insert({
      title: `${task.title} (cópia)`, type: task.type, status: "A fazer", priority: task.priority,
      responsible_id: task.responsibleId || null, manager_id: currentUser?.id || null, date: task.date,
      official_deadline: task.officialDeadline, internal_deadline: task.internalDeadline, overdue_date: task.overdueDate,
      workflow_id: task.workflowId || null, checklist: task.checklist, done: task.checklist.map(() => false), notes: task.notes,
    });
    if (error) return notify("Erro ao duplicar demanda.", "error");
    await addAudit("Demanda duplicada", `Duplicou a demanda: ${task.title}.`);
    notify("Demanda duplicada.");
    reload();
  }

  async function setTaskWorkflow(task: Task, workflow: Workflow) {
    const last = workflows[workflows.length - 1];
    const values: any = { workflow_id: workflow.id };
    if (last && workflow.id === last.id) { values.status = "Concluída"; values.done = task.checklist.map(() => true); }
    else if (task.storedStatus === "Concluída") values.status = "A fazer";
    const { error } = await supabase.from("demands").update(values).eq("id", task.id);
    if (error) return notify("Erro ao alterar etapa.", "error");
    await addAudit("Etapa da demanda atualizada", `Moveu ${task.title} para ${workflow.name}.`);
    notify(values.status === "Concluída" ? "Última etapa: demanda concluída." : "Etapa atualizada.");
    reload();
  }

  // ---------- Anexos ----------
  function getAttachmentUrl(path: string) {
    return supabase.storage.from(DEMAND_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function uploadDemandFile(task: { id: string; title: string }, file: File, silent = false) {
    if (!file) return false;
    const path = `${task.id}/${Date.now()}-${safeFileName(file.name)}`;
    const upload = await supabase.storage.from(DEMAND_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (upload.error) { notify("Erro ao subir arquivo. Verifique se o bucket demand-files existe.", "error"); return false; }
    const { error } = await supabase.from("demand_attachments").insert({
      demand_id: task.id, file_name: file.name, file_path: path, file_size: file.size, mime_type: file.type, uploaded_by: currentUser?.id || null,
    });
    if (error) { notify("Arquivo enviado, mas houve erro ao registrar o anexo.", "error"); return false; }
    await addAudit("Arquivo anexado", `Anexou ${file.name} na demanda: ${task.title}.`);
    if (!silent) notify("Arquivo anexado.");
    reload();
    return true;
  }

  async function deleteAttachment(file: Attachment) {
    if (!window.confirm(`Remover o anexo ${file.fileName}?`)) return;
    await supabase.storage.from(DEMAND_BUCKET).remove([file.filePath]);
    const { error } = await supabase.from("demand_attachments").delete().eq("id", file.id);
    if (error) return notify("Erro ao remover anexo.", "error");
    await addAudit("Anexo removido", `Removeu o anexo ${file.fileName}.`);
    notify("Anexo removido.");
    reload();
  }

  // ---------- Workflow ----------
  async function addWorkflow(name: string) {
    if (!permissions.manageWorkflow) { notify("Seu perfil não pode criar etapas.", "error"); return false; }
    const clean = name.trim();
    if (!clean) { notify("Informe o nome da etapa.", "error"); return false; }
    if (workflows.some((w) => w.name.toLowerCase() === clean.toLowerCase())) { notify("Essa etapa já existe.", "error"); return false; }
    const position = Math.max(0, ...workflows.map((w) => w.position)) + 1;
    const { error } = await supabase.from("workflows").insert({ name: clean, position });
    if (error) { notify("Erro ao criar etapa.", "error"); return false; }
    await addAudit("Workflow criado", `Criou a etapa: ${clean}.`);
    notify("Etapa criada.");
    reload();
    return true;
  }

  async function deleteWorkflow(workflow: Workflow) {
    if (!permissions.deleteWorkflow) return notify("Seu perfil não pode excluir etapas.", "error");
    if (tasks.some((task) => task.workflowId === workflow.id)) return notify("Etapa em uso por demandas.", "error");
    if (!window.confirm(`Excluir a etapa ${workflow.name}?`)) return;
    const { error } = await supabase.from("workflows").delete().eq("id", workflow.id);
    if (error) return notify("Erro ao excluir etapa.", "error");
    await addAudit("Workflow excluído", `Excluiu a etapa: ${workflow.name}.`);
    notify("Etapa excluída.");
    reload();
  }

  async function moveWorkflow(workflow: Workflow, direction: -1 | 1) {
    const index = workflows.findIndex((w) => w.id === workflow.id);
    const other = workflows[index + direction];
    if (!other) return;
    const a = await supabase.from("workflows").update({ position: other.position }).eq("id", workflow.id);
    const b = await supabase.from("workflows").update({ position: workflow.position }).eq("id", other.id);
    if (a.error || b.error) return notify("Erro ao reordenar etapas.", "error");
    reload();
  }

  // ---------- Banco de alvos ----------
  function getIntelFileUrl(path: string) {
    if (!path) return "";
    if (/^https?:\/\//i.test(path)) return path;
    return supabase.storage.from(INTEL_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function addAuthorCategory(category: { name: string; description: string }) {
    const name = category.name?.trim();
    if (!name) { notify("Informe o nome da pasta.", "error"); return null; }
    const { data, error } = await supabase.from("author_folders").insert({ name, description: category.description || "", created_by: currentUser?.id || null }).select("*").single();
    if (error) { notify("Erro ao criar pasta (o nome pode já existir).", "error"); return null; }
    await addAudit("Pasta criminal criada", `Criou a pasta: ${name}.`);
    notify("Pasta criada.");
    reload();
    return normalizeAuthorCategory(data);
  }

  async function deleteAuthorCategory(id: string) {
    if (authors.some((author) => author.categoryId === id)) return notify("A pasta possui cards e não pode ser excluída.", "error");
    if (!window.confirm("Excluir esta pasta vazia?")) return;
    const { error } = await supabase.from("author_folders").delete().eq("id", id);
    if (error) return notify("Erro ao excluir pasta.", "error");
    await addAudit("Pasta criminal excluída", "Excluiu uma pasta vazia do Banco de Alvos.");
    notify("Pasta excluída.");
    reload();
  }

  function authorPayload(form: any) {
    return {
      name: form.name.trim(), alias: form.alias, mother_name: form.motherName, birth_date: form.birthDate || null, document: form.document,
      address: form.address, neighborhood: form.neighborhood, city: form.city, crimes: form.crimes, folder_id: form.categoryId || null,
      status: form.status, risk_level: form.riskLevel, notes: form.notes,
    };
  }

  async function addAuthor(form: any) {
    if (!form?.name?.trim()) { notify("Informe o nome do alvo.", "error"); return null; }
    const { data, error } = await supabase.from("crime_authors").insert({ ...authorPayload(form), created_by: currentUser?.id || null }).select("*").single();
    if (error) { notify("Erro ao criar card do alvo.", "error"); return null; }
    await addAudit("Alvo cadastrado", `Criou o card de: ${form.name}.`);
    notify("Card do alvo criado.");
    reload();
    return normalizeAuthor(data);
  }

  async function updateAuthor(id: string, form: any) {
    if (!form?.name?.trim()) { notify("Informe o nome do alvo.", "error"); return false; }
    const { error } = await supabase.from("crime_authors").update(authorPayload(form)).eq("id", id);
    if (error) { notify("Erro ao atualizar card.", "error"); return false; }
    await addAudit("Alvo atualizado", `Atualizou dados de: ${form.name}.`);
    notify("Card atualizado.");
    reload();
    return true;
  }

  async function deleteAuthor(author: Author) {
    if (!window.confirm(`Excluir o card de ${author.name} e seus anexos?`)) return;
    const { error } = await supabase.from("crime_authors").delete().eq("id", author.id);
    if (error) return notify("Erro ao excluir card.", "error");
    await addAudit("Alvo excluído", `Excluiu o card de: ${author.name}.`);
    notify("Card excluído.");
    reload();
  }

  async function uploadAuthorFile(author: { id: string; name: string }, file: File | undefined | null, kind: "photo" | "report" = "report") {
    if (!file || !author?.id) return;
    const table = kind === "photo" ? "author_photos" : "author_reports";
    const path = `${author.id}/${kind === "photo" ? "fotos" : "relatorios"}/${Date.now()}-${safeFileName(file.name)}`;
    const upload = await supabase.storage.from(INTEL_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (upload.error) return notify("Erro ao subir arquivo. Verifique se o bucket intelligence-files existe.", "error");
    const { error } = await supabase.from(table).insert({
      author_id: author.id, file_name: file.name, file_path: path, file_size: file.size, mime_type: file.type, uploaded_by: currentUser?.id || null,
    });
    if (error) return notify("Arquivo enviado, mas houve erro ao registrar no banco.", "error");
    await addAudit(kind === "photo" ? "Foto anexada" : "Relatório anexado", `Anexou ${file.name} no card: ${author.name}.`);
    notify(kind === "photo" ? "Foto anexada." : "Relatório anexado.");
    reload();
  }

  async function importTrelloBoard(board: any) {
    if (!board?.lists || !board?.cards) { notify("JSON do Trello inválido.", "error"); return null; }
    const folderName = String(board.name || "Importado do Trello").trim();
    let folderId: string | null = null;
    const existing = await supabase.from("author_folders").select("*").eq("name", folderName).maybeSingle();
    if (existing.data?.id) folderId = existing.data.id;
    else {
      const created = await supabase.from("author_folders").insert({ name: folderName, description: "Importado do JSON do Trello", created_by: currentUser?.id || null }).select("*").single();
      if (created.error) { notify("Erro ao criar pasta de importação.", "error"); return null; }
      folderId = created.data.id;
    }

    const cardsByList: Record<string, any[]> = {};
    (board.cards || []).forEach((card: any) => {
      if (card.closed) return;
      (cardsByList[card.idList] ||= []).push(card);
    });

    let importedAuthors = 0;
    let importedFiles = 0;
    for (const list of board.lists || []) {
      if (list.closed) continue;
      const cards = cardsByList[list.id] || [];
      const parsed = parseTrelloAuthor(list.name, cards);
      if (!parsed.name || parsed.name === "Autor sem nome") continue;
      const found = await supabase.from("crime_authors").select("*").eq("name", parsed.name).eq("folder_id", folderId).maybeSingle();
      let row = found.data;
      if (!row?.id) {
        const created = await supabase.from("crime_authors").insert({
          name: parsed.name, alias: parsed.alias, document: parsed.document, crimes: parsed.crimes || folderName, folder_id: folderId,
          status: parsed.status, risk_level: parsed.riskLevel, notes: parsed.notes, created_by: currentUser?.id || null,
        }).select("*").single();
        if (created.error) continue;
        row = created.data;
        importedAuthors += 1;
      } else if (parsed.notes && !(row.notes || "").includes(parsed.notes)) {
        await supabase.from("crime_authors").update({
          alias: row.alias || parsed.alias, document: row.document || parsed.document, crimes: row.crimes || parsed.crimes,
          notes: [row.notes, parsed.notes].filter(Boolean).join("\n\n"),
        }).eq("id", row.id);
      }
      const files = cards.flatMap((card) => (card.attachments || []).map((attachment: any) => ({ ...attachment, cardName: card.name })));
      for (const attachment of files) {
        const url = trelloAttachmentUrl(attachment);
        if (!url) continue;
        const table = isImageAttachment(attachment) ? "author_photos" : "author_reports";
        const exists = await supabase.from(table).select("id").eq("author_id", row.id).eq("file_path", url).maybeSingle();
        if (exists.data?.id) continue;
        const inserted = await supabase.from(table).insert({
          author_id: row.id, file_name: attachment.name || attachment.cardName || "Anexo Trello", file_path: url,
          file_size: attachment.bytes || 0, mime_type: attachment.mimeType || (isImageAttachment(attachment) ? "image/*" : ""),
          description: "Importado do Trello", uploaded_by: currentUser?.id || null,
        });
        if (!inserted.error) importedFiles += 1;
      }
    }
    await addAudit("Importação Trello", `Importou ${importedAuthors} alvo(s) e ${importedFiles} anexo(s) do quadro ${folderName}.`);
    notify(`Importação concluída: ${importedAuthors} alvo(s) e ${importedFiles} anexo(s).`);
    reload();
    return folderId;
  }

  return {
    // estado
    currentUser, loading, today, users, workflows, tasks, auditLogs, attachments, authorCategories, authors, authorPhotos, authorReports, permissions,
    // sessão
    login, logout, reload,
    // usuários
    addUser, updateUser, deleteUser, toggleUserStatus,
    // demandas
    createTasks, updateTask, setTaskStatus, deleteTask, toggleChecklistItem, postponeTask, duplicateTask, setTaskWorkflow,
    getAttachmentUrl, uploadDemandFile, deleteAttachment,
    // workflow
    addWorkflow, deleteWorkflow, moveWorkflow,
    // alvos
    getIntelFileUrl, addAuthorCategory, deleteAuthorCategory, addAuthor, updateAuthor, deleteAuthor, uploadAuthorFile, importTrelloBoard,
  };
}

export type AppData = ReturnType<typeof useAppData>;
