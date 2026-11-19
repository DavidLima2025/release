import type { Author, AuthorFile } from "./domain";
import type { InvestigationItem } from "./investigation";

/**
 * "Envolvidos juntos": alvos que aparecem no mesmo REDS.
 * Fontes: BO anexado ao card (descrição "REDS nº — autor"), observações ("no REDS nº (dd/mm/aaaa)")
 * e fontes das investigações (BO com autores vinculados).
 */
const REDS = /\b(\d{4}-\d{9}-\d{3})\b/g;

export type Occurrence = { reds: string; date: string; role: string; otherRole: string };
export type Companion = { author: Author; occurrences: Occurrence[]; arrestedTogether: boolean };

const ARREST = /PRES|CONDUZ|AUTUAD|APREEND|FLAGRANTE/i;

function brToIso(d: string) {
  const m = d.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/** reds → { autor → papel } e reds → data */
export function indexReds(authors: Author[], reports: AuthorFile[], items: InvestigationItem[]) {
  const byReds = new Map<string, Map<string, string>>();
  const dates = new Map<string, string>();
  const add = (reds: string, authorId: string, role: string) => {
    const m = byReds.get(reds) || new Map<string, string>();
    if (!m.has(authorId) || (role && !m.get(authorId))) m.set(authorId, role);
    byReds.set(reds, m);
  };
  const known = new Set(authors.map((a) => a.id));
  for (const r of reports) {
    if (!known.has(r.authorId)) continue;
    const text = `${r.reds || ""} ${r.description} ${r.fileName}`;
    const role = (r.description.split("—")[1] || "").trim();
    for (const reds of new Set([...text.matchAll(REDS)].map((m) => m[1]))) {
      add(reds, r.authorId, role);
      if (r.eventDate && !dates.has(reds)) dates.set(reds, r.eventDate);
    }
  }
  for (const a of authors) {
    for (const m of (a.notes || "").matchAll(/(?:como\s+([\p{L} ]+?)\s+no\s+)?REDS\s+(\d{4}-\d{9}-\d{3})(?:\s*\((\d{2}\/\d{2}\/\d{4})\))?/giu)) {
      add(m[2], a.id, (m[1] || "").trim());
      if (m[3] && !dates.has(m[2])) dates.set(m[2], brToIso(m[3]));
    }
  }
  for (const i of items) {
    const ref = i.reference && i.reference.match(/\d{4}-\d{9}-\d{3}/)?.[0];
    if (!ref) continue;
    i.authorIds.filter((id) => known.has(id)).forEach((id) => add(ref, id, ""));
    if (i.itemDate) dates.set(ref, i.itemDate);
  }
  return { byReds, dates };
}

/** Quem esteve junto com o alvo, com as ocorrências em comum (mais vezes primeiro). */
export function companionsOf(authorId: string, authors: Author[], reports: AuthorFile[], items: InvestigationItem[]): Companion[] {
  const { byReds, dates } = indexReds(authors, reports, items);
  const byId = new Map(authors.map((a) => [a.id, a]));
  const out = new Map<string, Companion>();
  for (const [reds, people] of byReds) {
    if (!people.has(authorId)) continue;
    const myRole = people.get(authorId) || "";
    for (const [otherId, otherRole] of people) {
      if (otherId === authorId || !byId.has(otherId)) continue;
      const c = out.get(otherId) || { author: byId.get(otherId)!, occurrences: [], arrestedTogether: false };
      c.occurrences.push({ reds, date: dates.get(reds) || "", role: myRole, otherRole });
      if (ARREST.test(myRole) && ARREST.test(otherRole)) c.arrestedTogether = true;
      out.set(otherId, c);
    }
  }
  return [...out.values()]
    .map((c) => ({ ...c, occurrences: c.occurrences.sort((a, b) => (b.date || "").localeCompare(a.date || "")) }))
    .sort((a, b) => b.occurrences.length - a.occurrences.length || a.author.name.localeCompare(b.author.name));
}

/** Quantos REDS diferentes o alvo tem registrados (reincidência). */
export function redsCount(authorId: string, authors: Author[], reports: AuthorFile[], items: InvestigationItem[]) {
  const { byReds, dates } = indexReds(authors, reports, items);
  const list = [...byReds.entries()].filter(([, p]) => p.has(authorId)).map(([reds]) => ({ reds, date: dates.get(reds) || "", role: byReds.get(reds)!.get(authorId) || "" }));
  return list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
