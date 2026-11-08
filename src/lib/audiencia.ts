import type { Task } from "./domain";
import { addDays, daysBetween, formatBR } from "./dates";

/**
 * Audiência = demanda do tipo "Audiência".
 * Dia da demanda = recebimento da requisição (P.A.); prazo = dia da audiência.
 * A primeira linha das observações guarda os dados para o lembrete:
 *   [AUDIENCIA] 2026-12-10 14:00 | lembrar=3
 */
export const AUDIENCIA_TYPE = "Audiência";
export const AUDIENCIA_ITEMS = ["Fotos", "Vídeos", "Observação"];
export const LEMBRETE_OPCOES = [1, 2, 3, 5, 7, 10, 15];

export type AudienciaInfo = { date: string; time: string; remindDays: number; local: string; pa: string; reds: string };

const MARK = /^\[AUDIENCIA\]\s+(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?(?:\s*\|\s*lembrar=(\d+))?/m;
const line = (notes: string, label: string) => notes.match(new RegExp(`^${label}:\\s*(.+)$`, "mi"))?.[1]?.trim() || "";

export function audienciaMarker(date: string, time: string, remindDays: number) {
  return `[AUDIENCIA] ${date}${time ? ` ${time}` : ""} | lembrar=${remindDays}`;
}

export function parseAudiencia(task: Pick<Task, "type" | "notes" | "overdueDate">): AudienciaInfo | null {
  if (task.type !== AUDIENCIA_TYPE && !MARK.test(task.notes || "")) return null;
  const m = (task.notes || "").match(MARK);
  return {
    // O prazo da demanda manda: se a audiência for remarcada pela edição/adiamento, o lembrete acompanha.
    date: task.overdueDate || m?.[1] || "",
    time: m?.[2] || "",
    remindDays: Number(m?.[3] || 3),
    local: line(task.notes, "Local"),
    pa: line(task.notes, "P\\.A\\. / requisição"),
    reds: line(task.notes, "REDS"),
  };
}

/** Observações sem a linha técnica do marcador (para exibir). */
export const notesForDisplay = (notes: string) => (notes || "").replace(/^\[AUDIENCIA\][^\n]*\n?/m, "").trim();

export type UpcomingAudiencia = { task: Task; info: AudienciaInfo; days: number };

/** Audiências não concluídas de hoje em diante, mais próximas primeiro. */
export function upcomingAudiencias(tasks: Task[], today: string, horizonDays = 60): UpcomingAudiencia[] {
  return tasks
    .filter((t) => t.status !== "Concluída")
    .map((task) => ({ task, info: parseAudiencia(task) }))
    .filter((x): x is { task: Task; info: AudienciaInfo } => Boolean(x.info))
    .map(({ task, info }) => ({ task, info, days: daysBetween(info.date, today) ?? 9999 }))
    .filter((x) => x.days >= 0 && x.days <= horizonDays)
    .sort((a, b) => a.days - b.days || a.info.time.localeCompare(b.info.time));
}

/** Audiências dentro da janela de lembrete escolhida em cada uma. */
export const dueReminders = (tasks: Task[], today: string) => upcomingAudiencias(tasks, today).filter((x) => x.days <= x.info.remindDays);

export function whenText(days: number, time: string) {
  const at = time ? ` às ${time}` : "";
  if (days === 0) return `HOJE${at}`;
  if (days === 1) return `amanhã${at}`;
  return `em ${days} dias${at}`;
}

export const reminderDate = (date: string, remindDays: number) => addDays(date, -remindDays);
export const audienciaLabel = (info: AudienciaInfo) => `${formatBR(info.date)}${info.time ? ` ${info.time}` : ""}`;
