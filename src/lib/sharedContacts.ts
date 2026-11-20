// Telefones e veículos em comum (dados adicionais do alvo): vínculo que aparece sozinho.
import type { Author } from "./domain";
import type { InvestigationTarget } from "./investigation";

export type SharedHit = { kind: "Telefone" | "Veículo"; value: string; a: Author; b: Author };

/** Telefones: compara os 8 últimos dígitos (ignora DDD, 9º dígito, espaços e traços). */
export function phonesOf(text: string) {
  const out = new Set<string>();
  for (const m of String(text || "").matchAll(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\s*\d{4}[\s.-]?\d{4}/g)) {
    const d = m[0].replace(/\D/g, "");
    if (d.length >= 8) out.add(d.slice(-8));
  }
  return [...out];
}
/** Placas: ABC1234 ou Mercosul ABC1D23. */
export function platesOf(text: string) {
  return [...new Set([...String(text || "").toUpperCase().matchAll(/\b([A-Z]{3})[\s-]?(\d[A-Z0-9]\d{2})\b/g)].map((m) => `${m[1]}${m[2]}`))];
}
const fmtPhone = (d: string) => `${d.slice(0, 4)}-${d.slice(4)}`;

function index(authors: Author[]) {
  const phones = new Map<string, Set<string>>(); const plates = new Map<string, Set<string>>();
  for (const a of authors) {
    const ex = a.extra || {};
    for (const p of phonesOf(`${ex.telefones || ""}`)) phones.set(p, (phones.get(p) || new Set()).add(a.id));
    for (const p of platesOf(`${ex.veiculos || ""}`)) plates.set(p, (plates.get(p) || new Set()).add(a.id));
  }
  return { phones, plates };
}

/** Pares que dividem telefone ou placa. `scope` limita os pares a quem tem pelo menos um lado nele. */
export function sharedContacts(authors: Author[], scope?: Set<string>): SharedHit[] {
  const byId = new Map(authors.map((a) => [a.id, a]));
  const { phones, plates } = index(authors);
  const out: SharedHit[] = [];
  const emit = (kind: SharedHit["kind"], value: string, ids: Set<string>) => {
    const list = [...ids];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      if (scope && !scope.has(list[i]) && !scope.has(list[j])) continue;
      out.push({ kind, value, a: byId.get(list[i])!, b: byId.get(list[j])! });
    }
  };
  for (const [p, ids] of phones) if (ids.size > 1) emit("Telefone", fmtPhone(p), ids);
  for (const [p, ids] of plates) if (ids.size > 1) emit("Veículo", p, ids);
  return out;
}

/** Vínculos automáticos entre alvos do dossiê (para desenhar no organograma). */
export function autoLinksFor(targets: InvestigationTarget[], authors: Author[]) {
  const tOf = new Map(targets.filter((t) => t.authorId).map((t) => [t.authorId, t.id]));
  const inDossier = authors.filter((a) => tOf.has(a.id));
  const merged = new Map<string, { a: string; b: string; label: string }>();
  for (const h of sharedContacts(inDossier)) {
    const a = tOf.get(h.a.id)!; const b = tOf.get(h.b.id)!; const k = [a, b].sort().join("|");
    const lab = h.kind === "Telefone" ? `MESMO TEL ${h.value}` : `MESMO VEÍCULO ${h.value}`;
    const cur = merged.get(k);
    merged.set(k, { a, b, label: cur ? `${cur.label} + ${h.kind === "Telefone" ? "TEL" : "VEÍC."}` : lab });
  }
  return [...merged.values()];
}
