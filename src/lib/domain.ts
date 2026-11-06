import { daysBetween, todayISO } from "./dates";

export const STATUSES = ["A fazer", "Atrasada", "Paralisada", "Risco de prazo", "Concluída"] as const;
export type Status = (typeof STATUSES)[number];
/** Status que a pessoa escolhe; "Atrasada" e "Risco de prazo" são calculados pelo prazo. */
export const MANUAL_STATUSES: Status[] = ["A fazer", "Paralisada", "Concluída"];

export const TASK_TYPES = ["Inteligência", "Análise de BO", "Dossiê", "Operacional", "Relatório", "Gestão"];
export const PRIORITIES = ["Baixa", "Média", "Alta", "Crítica"];
export const USER_ROLES = ["Administrador", "Gestor", "Analista", "Colaborador"];
export const DEFAULT_CHECKLIST = ["Triar demanda", "Executar atividade", "Registrar conclusão"];
export const BO_CHECKLIST = ["Ler o BO", "Identificar envolvidos/alvos", "Lançar no banco de alvos", "Registrar conclusão"];

/** Dias antes do prazo em que a demanda passa a "Risco de prazo". */
export const RISK_WINDOW_DAYS = 2;

export const MAIN_ADMIN_LOGIN = "ADM6CIA";

export type Permissions = {
  users: boolean; audit: boolean; deleteDemand: boolean; deleteWorkflow: boolean;
  manageWorkflow: boolean; dashboard: boolean; tv: boolean; targets: boolean;
};

const PERMISSIONS: Record<string, Permissions> = {
  Administrador: { users: true, audit: true, deleteDemand: true, deleteWorkflow: true, manageWorkflow: true, dashboard: true, tv: true, targets: true },
  Gestor: { users: false, audit: true, deleteDemand: true, deleteWorkflow: false, manageWorkflow: true, dashboard: true, tv: true, targets: true },
  Analista: { users: false, audit: false, deleteDemand: false, deleteWorkflow: false, manageWorkflow: false, dashboard: true, tv: true, targets: true },
  Colaborador: { users: false, audit: false, deleteDemand: false, deleteWorkflow: false, manageWorkflow: false, dashboard: false, tv: false, targets: true },
};

export function getPermissions(user?: AppUser | null): Permissions {
  if ((user?.login || "").toUpperCase() === MAIN_ADMIN_LOGIN) return PERMISSIONS.Administrador;
  return PERMISSIONS[user?.role || ""] || PERMISSIONS.Colaborador;
}

export type AppUser = {
  id: string; name: string; warName: string; register: string; unit: string; role: string;
  email: string; phone: string; login: string; status: string;
  mustChangePassword: boolean; lastLoginAt: string;
};

export type Workflow = { id: string; name: string; position: number };

export type Task = {
  id: string; title: string; type: string; status: Status; storedStatus: string; priority: string;
  responsibleId: string; managerId: string; responsible: string; manager: string;
  date: string; officialDeadline: string; internalDeadline: string; overdueDate: string;
  workflowId: string; workflow: string; checklist: string[]; done: boolean[]; notes: string;
  createdAt: string;
};

export type Attachment = {
  id: string; demandId: string; fileName: string; filePath: string; fileSize: number;
  mimeType: string; uploadedBy: string; createdAt: string;
};

export type AuditLog = { id: string; action: string; details: string; user_name: string; user_role: string; created_at: string };

export type AuthorCategory = { id: string; name: string; description: string; createdAt?: string };
export type Author = {
  id: string; name: string; alias: string; motherName: string; birthDate: string; document: string;
  address: string; neighborhood: string; city: string; crimes: string; categoryId: string;
  status: string; riskLevel: string; notes: string; createdAt: string;
};
export type AuthorFile = {
  id: string; authorId: string; fileName: string; filePath: string; fileSize: number;
  mimeType: string; description: string; uploadedBy: string; createdAt: string;
};

/** Status exibido: concluída/paralisada ficam como estão; as demais seguem o prazo. */
export function computeStatus(stored: string, overdueDate: string, today = todayISO()): Status {
  if (stored === "Concluída" || stored === "Paralisada") return stored;
  if (!overdueDate) return "A fazer";
  const diff = daysBetween(overdueDate, today);
  if (diff === null) return "A fazer";
  if (diff < 0) return "Atrasada";
  if (diff <= RISK_WINDOW_DAYS) return "Risco de prazo";
  return "A fazer";
}

export function isOpen(task: Task) {
  return task.status !== "Concluída";
}

export function countByStatus(tasks: Task[]) {
  return STATUSES.reduce((acc, status) => {
    acc[status] = tasks.filter((task) => task.status === status).length;
    return acc;
  }, {} as Record<Status, number>);
}

export function checklistProgress(task: Task) {
  if (!task.checklist.length) return task.status === "Concluída" ? 100 : 0;
  return Math.round((task.done.filter(Boolean).length / task.checklist.length) * 100);
}

export function normalizeUser(row: any): AppUser {
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
    mustChangePassword: Boolean(row?.must_change_password),
    lastLoginAt: row?.last_login_at || "",
  };
}

export function normalizeWorkflow(row: any): Workflow {
  return { id: row.id, name: row.name || "Etapa", position: Number(row.position) || 0 };
}

export function normalizeTask(row: any, today = todayISO()): Task {
  const checklist: string[] = Array.isArray(row.checklist) && row.checklist.length ? row.checklist.map(String) : DEFAULT_CHECKLIST;
  const rawDone: unknown[] = Array.isArray(row.done) ? row.done : [];
  const done = checklist.map((_, index) => Boolean(rawDone[index]));
  const date = row.date || today;
  const overdueDate = row.overdue_date || row.internal_deadline || date;
  return {
    id: row.id,
    title: row.title || "Demanda sem título",
    type: row.type || "Inteligência",
    storedStatus: row.status || "A fazer",
    status: computeStatus(row.status || "A fazer", overdueDate, today),
    priority: row.priority || "Média",
    responsibleId: row.responsible_id || "",
    managerId: row.manager_id || "",
    responsible: row.responsible?.war_name || row.responsible?.name || "Sem responsável",
    manager: row.manager?.war_name || row.manager?.name || "—",
    date,
    officialDeadline: row.official_deadline || date,
    internalDeadline: row.internal_deadline || overdueDate,
    overdueDate,
    workflowId: row.workflow_id || "",
    workflow: row.workflow?.name || "Sem etapa",
    checklist,
    done,
    notes: row.notes || "",
    createdAt: row.created_at || "",
  };
}

export function normalizeAttachment(row: any): Attachment {
  return {
    id: row.id, demandId: row.demand_id, fileName: row.file_name, filePath: row.file_path,
    fileSize: row.file_size || 0, mimeType: row.mime_type || "", uploadedBy: row.uploaded_by || "", createdAt: row.created_at,
  };
}

export function normalizeAuthor(row: any): Author {
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

export function normalizeAuthorCategory(row: any): AuthorCategory {
  return { id: row.id, name: row.name || "Pasta sem nome", description: row.description || "", createdAt: row.created_at };
}

export function normalizeAuthorFile(row: any): AuthorFile {
  return {
    id: row.id, authorId: row.author_id, fileName: row.file_name, filePath: row.file_path, fileSize: row.file_size || 0,
    mimeType: row.mime_type || "", description: row.description || "", uploadedBy: row.uploaded_by || "", createdAt: row.created_at,
  };
}

export function formatBytes(bytes: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function safeFileName(name: string) {
  return name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function matchesText(haystack: (string | undefined | null)[], query: string) {
  const needle = query.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (!needle) return true;
  return haystack.filter(Boolean).join(" ").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(needle);
}
