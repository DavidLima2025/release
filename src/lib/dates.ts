// Datas sempre no fuso local (America/Sao_Paulo). `toISOString()` converte para UTC e,
// depois das 21h, devolvia o dia seguinte — por isso nada aqui usa toISOString.

export function toISODate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function parseISODate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, days: number) {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function addMonths(iso: string, months: number) {
  const date = parseISODate(iso);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return toISODate(date);
}

/** Diferença em dias inteiros (a - b). */
export function daysBetween(a: string, b: string) {
  if (!a || !b) return null;
  return Math.round((parseISODate(a).getTime() - parseISODate(b).getTime()) / 86400000);
}

export function formatBR(iso?: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function formatDateTimeBR(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function isValidISODate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseISODate(value).getTime());
}

export function buildCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const days: (string | null)[] = [];
  for (let i = 0; i < first.getDay(); i += 1) days.push(null);
  for (let day = 1; day <= last.getDate(); day += 1) days.push(toISODate(new Date(year, month, day)));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

export type Recurrence = "none" | "daily" | "weekdays" | "weekly" | "monthly";

export function buildRecurringDates(start: string, recurrence: Recurrence = "none", count = 1) {
  const total = recurrence === "none" ? 1 : Math.max(1, Math.min(Number(count) || 1, 60));
  const dates: string[] = [];
  let cursor = start;
  while (dates.length < total) {
    if (recurrence === "weekdays") {
      const weekday = parseISODate(cursor).getDay();
      if (weekday !== 0 && weekday !== 6) dates.push(cursor);
      cursor = addDays(cursor, 1);
      continue;
    }
    const index = dates.length;
    if (recurrence === "daily") dates.push(addDays(start, index));
    else if (recurrence === "weekly") dates.push(addDays(start, index * 7));
    else if (recurrence === "monthly") dates.push(addMonths(start, index));
    else dates.push(start);
  }
  return dates;
}

export function isSameMonth(iso: string, reference: Date) {
  if (!iso) return false;
  const date = parseISODate(iso);
  return date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth();
}

export function monthLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export function weekdayLabel(iso: string) {
  return parseISODate(iso).toLocaleDateString("pt-BR", { weekday: "long" });
}
