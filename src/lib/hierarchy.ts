// Sugestão de funções e de hierarquia do organograma a partir do histórico (BOs e parceiros).
// É uma proposta para o analista conferir: não substitui o conhecimento de campo.
import type { Author, AuthorFile } from "./domain";
import { TARGET_ROLES, type InvestigationItem, type InvestigationTarget } from "./investigation";
import { indexReds } from "./companions";

export type Proposal = {
  target: InvestigationTarget; author?: Author;
  role: string; parentId: string; area: string; areaWhy: string;
  score: number; bos: number; partners: number; arrested: number;
  reason: string;
};

const ARREST = /PRES|CONDUZ|AUTUAD|APREEND|FLAGRANTE/i;

/** Palavras que, num levantamento, vestígio ou fonte, indicam a função. */
const ROLE_WORDS: [string, RegExp][] = [
  ["Líder", /\b(LIDER|LIDERA|CHEFE|CHEFIA|PATRAO|DONO DA BOCA|MANDANTE|CABECA DO GRUPO|COMANDA|QUEM MANDA)\b/],
  ["Gerente", /\b(GERENTE|GERENCIA|FRENTE DA BOCA|BRACO DIREITO|SUBGERENTE|COORDENA)\b/],
  ["Financeiro", /\b(FINANCEIRO|CONTADOR|LAVAGEM|LARANJA|MOVIMENTA(CAO)? (DE )?DINHEIRO|PIX|CONTA BANCARIA|GUARDA O DINHEIRO)\b/],
  ["Receptador", /\b(RECEPTA\w*|COMPRA OS? (CELULARES|OBJETOS|PRODUTOS)|DESMANCHE|REVENDE)\b/],
  ["Olheiro", /\b(OLHEIRO|FOGUETEIRO|VIGIA|RADINHO|CAMPANA|AVISA A CHEGADA)\b/],
  ["Apoio / logística", /\b(MOTORISTA|LOGISTICA|TRANSPORT\w*|ESCONDE|DEPOSITO|GUARDA AS? (ARMAS|DROGAS|OBJETOS)|APOIO|FUGA)\b/],
  ["Executor", /\b(EXECUTOR|EXECUTA|VAPOR|AUTOR DO (FURTO|ROUBO)|ATIRADOR|PUNGUISTA|MAO LEVE|ABORDA AS VITIMAS)\b/],
];
/** Bairro/local a partir de "RUA X, 10 — BAIRRO — CIDADE/UF". */
function placeArea(place: string) {
  const parts = place.split(/\s+[—-]\s+/).map((p) => p.trim()).filter(Boolean);
  const bairro = parts.length >= 3 ? parts[1] : parts.length === 2 && !/\/[A-Z]{2}$/.test(parts[1]) ? parts[1] : "";
  return bairro.replace(/\s+/g, " ").toUpperCase();
}
export type EvidenceText = { authorId: string; text: string; source: string };
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

export function proposeHierarchy(targets: InvestigationTarget[], authors: Author[], reports: AuthorFile[], items: InvestigationItem[], photos: AuthorFile[] = []): Proposal[] {
  const { byReds } = indexReds(authors, reports, items);
  const authorOf = new Map(authors.map((a) => [a.id, a]));
  const tByAuthor = new Map(targets.map((t) => [t.authorId, t]));
  const inDossier = new Set(targets.map((t) => t.authorId));

  // Estatísticas por alvo e pesos entre pares do dossiê.
  const stats = new Map<string, { bos: number; roles: string[]; outside: number }>();
  const pair = new Map<string, { n: number; arrested: number }>();
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (const [, people] of byReds) {
    const ids = [...people.keys()];
    for (const id of ids) {
      if (!inDossier.has(id)) continue;
      const s = stats.get(id) || { bos: 0, roles: [], outside: 0 };
      s.bos += 1; s.roles.push(people.get(id) || ""); s.outside += ids.filter((x) => !inDossier.has(x)).length;
      stats.set(id, s);
    }
    const ins = ids.filter((id) => inDossier.has(id));
    for (let i = 0; i < ins.length; i++) for (let j = i + 1; j < ins.length; j++) {
      const k = key(ins[i], ins[j]); const p = pair.get(k) || { n: 0, arrested: 0 };
      p.n += 1; if (ARREST.test(people.get(ins[i]) || "") && ARREST.test(people.get(ins[j]) || "")) p.arrested += 1;
      pair.set(k, p);
    }
  }
  const partnersOf = (id: string) => targets.map((t) => t.authorId).filter((o) => o !== id && pair.has(key(id, o)))
    .map((o) => ({ id: o, ...pair.get(key(id, o))! }));

  // Pontuação: parceiros distintos no dossiê pesam mais que volume de BOs.
  const base = targets.map((t) => {
    const s = stats.get(t.authorId) || { bos: 0, roles: [], outside: 0 };
    const ps = partnersOf(t.authorId);
    const ties = ps.reduce((n, p) => n + p.n, 0);
    const arrested = ps.reduce((n, p) => n + p.arrested, 0);
    const score = ps.length * 3 + ties * 1.5 + s.bos * 0.8 + Math.min(s.outside, 6) * 0.3;
    return { t, s, ps, ties, arrested, score };
  });
  const ranked = [...base].sort((a, b) => b.score - a.score);
  const top = ranked[0]?.score || 0;

  // Indícios: o que o analista anotou, fontes que citam o alvo e fotos de levantamento/ocorrência.
  const clueRole = (t: InvestigationTarget): { role: string; why: string } | null => {
    const explicit = [...t.evidence].reverse().find((e) => e.role);
    if (explicit) return { role: explicit.role!, why: `indício: ${explicit.source || "anotação"}` };
    const texts: { text: string; source: string }[] = [
      ...t.evidence.map((e) => ({ text: e.note, source: e.source || "indício" })),
      ...items.filter((i) => i.authorIds.includes(t.authorId)).map((i) => ({ text: `${i.title} ${i.summary}`, source: `${i.kind} ${i.reference || i.title}`.trim() })),
      ...photos.filter((p) => p.authorId === t.authorId && (p.category === "levantamento" || p.category === "ocorrencia") && p.description).map((p) => ({ text: p.description, source: p.category === "levantamento" ? "foto de levantamento" : "foto de ocorrência" })),
    ];
    for (const [role, re] of ROLE_WORDS) {
      const hit = texts.find((x) => re.test(norm(x.text)));
      if (hit) return { role, why: `"${norm(hit.text).match(re)![0].toLowerCase()}" em ${hit.source}` };
    }
    return null;
  };
  const areaOf = (t: InvestigationTarget): { area: string; why: string } => {
    const ev = [...t.evidence].reverse().find((e) => e.area);
    if (ev) return { area: ev.area!, why: `indício: ${ev.source || "anotação"}` };
    const counts = new Map<string, number>();
    const places = [
      ...items.filter((i) => i.authorIds.includes(t.authorId) && i.place).map((i) => i.place),
      ...reports.filter((r) => r.authorId === t.authorId && r.place).map((r) => r.place),
    ];
    for (const pl of places) { const b = placeArea(pl); if (b) counts.set(b, (counts.get(b) || 0) + 1); }
    const best = [...counts.entries()].sort((x, y) => y[1] - x[1])[0];
    return best ? { area: best[0], why: `${best[1]} de ${places.length} BO(s) no bairro` } : { area: t.area, why: "" };
  };

  const guessRole = (b: (typeof base)[number], rank: number) => {
    const a = authorOf.get(b.t.authorId);
    const clue = clueRole(b.t);
    if (clue) return clue.role;
    const roles = b.s.roles.map(norm);
    const victim = roles.filter((r) => /VITIMA/.test(r)).length; const witness = roles.filter((r) => /TESTEMUNHA/.test(r)).length;
    if (b.s.bos && victim > b.s.bos / 2) return "Vítima";
    if (b.s.bos && witness > b.s.bos / 2) return "Testemunha";
    if (a && /RECEPTA/.test(norm(`${a.crimes} ${a.notes}`))) return "Receptador";
    if (rank === 0 && b.ps.length >= 2) return "Líder";
    if (b.ps.length >= 2 && b.score >= top * 0.55) return "Gerente";
    if (b.s.bos > 0) return "Executor";
    return b.t.role || "Associado";
  };
  // Só sugere papéis que ainda existem no catálogo (um papel excluído não volta pela sugestão): senão mantém o papel atual.
  const roleOf = (b: (typeof base)[number], rank: number) => {
    const r = guessRole(b, rank);
    return TARGET_ROLES.includes(r) ? r : b.t.role || r;
  };
  const roles = new Map(ranked.map((b, i) => [b.t.id, roleOf(b, i)]));
  const scoreOf = new Map(base.map((b) => [b.t.authorId, b.score]));

  // Superior: o parceiro do dossiê com maior pontuação que a sua (mais BOs juntos desempata). Vítimas/testemunhas ficam fora.
  const out: Proposal[] = [];
  for (const b of ranked) {
    const role = roles.get(b.t.id)!;
    let parentId = "";
    if (!["Vítima", "Testemunha", "Líder"].includes(role)) {
      const above = b.ps
        .filter((p) => (scoreOf.get(p.id) || 0) > b.score && !["Vítima", "Testemunha"].includes(roles.get(tByAuthor.get(p.id)!.id) || ""))
        .sort((x, y) => y.n - x.n || (scoreOf.get(y.id) || 0) - (scoreOf.get(x.id) || 0));
      if (above[0]) parentId = tByAuthor.get(above[0].id)!.id;
      // Sem BO em comum com ninguém do dossiê: mantém o superior que o analista já definiu.
      else if (!b.ps.length) parentId = b.t.parentId;
    }
    const clue = clueRole(b.t); const ar = areaOf(b.t);
    const names = b.ps.sort((x, y) => y.n - x.n).slice(0, 3).map((p) => `${authorOf.get(p.id)?.name.split(" ")[0] || "?"} ${p.n}×`);
    const reason = [
      `${b.s.bos} BO(s)`,
      b.ps.length ? `${b.ps.length} parceiro(s) no dossiê (${names.join(", ")})` : "sem BO em comum com o dossiê",
      b.arrested ? `${b.arrested} prisão(ões) junto` : "",
      clue && clue.role === role ? clue.why : role === "Receptador" ? "receptação no cadastro" : role === "Vítima" || role === "Testemunha" ? `aparece como ${role.toLowerCase()} nos BOs` : "",
    ].filter(Boolean).join(" · ");
    out.push({ target: b.t, author: authorOf.get(b.t.authorId), role, parentId, area: ar.area || b.t.area, areaWhy: ar.why, score: Math.round(b.score * 10) / 10, bos: b.s.bos, partners: b.ps.length, arrested: b.arrested, reason });
  }
  return out;
}

// ---------- Comparação entre investigações ----------
export type Comparison = {
  common: { author: Author; roleA: string; roleB: string }[];
  sharedReds: { reds: string; date: string; a: string[]; b: string[] }[];
  crossPartners: { a: Author; b: Author; reds: string[] }[];
};

export function compareInvestigations(
  ta: InvestigationTarget[], tb: InvestigationTarget[], authors: Author[], reports: AuthorFile[], items: InvestigationItem[], invA: string, invB: string,
): Comparison {
  const authorOf = new Map(authors.map((a) => [a.id, a]));
  const A = new Map(ta.map((t) => [t.authorId, t])); const B = new Map(tb.map((t) => [t.authorId, t]));
  const common = [...A.keys()].filter((id) => B.has(id) && authorOf.get(id)).map((id) => ({ author: authorOf.get(id)!, roleA: A.get(id)!.role, roleB: B.get(id)!.role }));
  const { byReds, dates } = indexReds(authors, reports, items);
  const refsOf = (inv: string) => new Set(items.filter((i) => i.investigationId === inv).map((i) => i.reference?.match(/\d{4}-\d{9}-\d{3}/)?.[0]).filter(Boolean) as string[]);
  const refA = refsOf(invA); const refB = refsOf(invB);
  const sharedReds: Comparison["sharedReds"] = [];
  const cross = new Map<string, { a: Author; b: Author; reds: string[] }>();
  for (const [reds, people] of byReds) {
    const ids = [...people.keys()];
    const inA = ids.filter((id) => A.has(id)); const inB = ids.filter((id) => B.has(id));
    if ((inA.length || refA.has(reds)) && (inB.length || refB.has(reds))) {
      sharedReds.push({ reds, date: dates.get(reds) || "", a: inA.map((id) => authorOf.get(id)?.name || "?"), b: inB.map((id) => authorOf.get(id)?.name || "?") });
    }
    for (const x of inA) for (const y of inB) {
      if (x === y || (A.has(y) && B.has(x)) || B.has(x) || A.has(y)) continue;
      const k = `${x}|${y}`; const c = cross.get(k) || { a: authorOf.get(x)!, b: authorOf.get(y)!, reds: [] };
      c.reds.push(reds); cross.set(k, c);
    }
  }
  sharedReds.sort((x, y) => (y.date || "").localeCompare(x.date || ""));
  return { common, sharedReds, crossPartners: [...cross.values()].filter((c) => c.a && c.b).sort((x, y) => y.reds.length - x.reds.length) };
}
