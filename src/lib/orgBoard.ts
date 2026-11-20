// Organograma em "quadro por núcleos" (estilo análise de vínculos).
// Regras de posição FIXAS e previsíveis: a linha de cada quadro depende só da função (ou do nível
// escolhido para o núcleo), nunca das setas. Assim, ligar um alvo a outro não faz o líder "descer"
// nem o receptador "subir": muda só a seta.
import { TARGET_ROLES, ROLE_COLOR, type InvestigationLink, type InvestigationTarget, type OrgGroup } from "./investigation";

export const CARD_W = 112;
export const CARD_H = 166;
const PAD = 12;
const HEAD = 28;
const GAP_CARD = 12;
const GAP_GROUP = 40;
const GAP_ROW = 92;
const MARGIN = 26;
const LANE = 10;
/** Faixa à esquerda com o grau de cada linha. */
const LEFT = 0;

/** Núcleo automático de cada função e a linha em que fica (0 = topo). */
export const AUTO_GROUPS: Record<string, { name: string; level: number }> = {
  "Líder": { name: "LIDERANÇA", level: 0 },
  "Gerente": { name: "GERÊNCIA", level: 1 },
  "Financeiro": { name: "OPERADORES FINANCEIROS", level: 1 },
  "Executor": { name: "EXECUTORES", level: 2 },
  "Apoio / logística": { name: "APOIO E LOGÍSTICA", level: 2 },
  "Olheiro": { name: "OLHEIROS / VIGILÂNCIA", level: 2 },
  "Receptador": { name: "RECEPTAÇÃO", level: 2 },
  "Associado": { name: "ASSOCIADOS", level: 3 },
  "Vítima": { name: "VÍTIMAS E TESTEMUNHAS", level: 4 },
  "Testemunha": { name: "VÍTIMAS E TESTEMUNHAS", level: 4 },
};
export const LEVEL_LABELS = ["1º — Topo (liderança)", "2º — Gerência / finanças", "3º — Execução / apoio", "4º — Associados", "5º — Vítimas / testemunhas", "6º", "7º"];
export const roleOfAutoGroup = (name: string) => Object.entries(AUTO_GROUPS).find(([, g]) => g.name === name)?.[0] || "";
export const GROUP_COLORS = ["#B3261E", "#C28A12", "#7A6C45", "#231F20", "#2F5D7C", "#5B3E8A", "#2E6B3A", "#8A3B12", "#0F6E6E"];
export const autoLevel = (role: string) => (AUTO_GROUPS[role] || AUTO_GROUPS["Associado"]).level;
export const MAX_GRADE = 7;
/** Grau do alvo (0 = topo): o definido pelo analista ou o da função. */
export const levelOf = (t: InvestigationTarget) => (t.grade ? Math.min(MAX_GRADE, t.grade) - 1 : autoLevel(t.role));
/** Nome do núcleo a partir da chave ("a:EXECUTORES|2" → "EXECUTORES"). */
export const groupNameOfKey = (key: string) => key.slice(2).split("|")[0];

export type BoardCard = { targetId: string; x: number; y: number };
export type BoardGroup = { key: string; name: string; custom: boolean; color: string; activities: string[]; level: number; order: number; x: number; y: number; w: number; h: number; cards: BoardCard[]; lanesTop: number; actTop: number };
/** from/to: alvos ligados pela seta (para destacar a cadeia de comando do alvo selecionado). */
export type BoardArrow = { d: string; kind: "chefia" | "vinculo" | "auto"; label?: string; lx?: number; ly?: number; id: string; from?: string; to?: string[] };
export type AutoLink = { a: string; b: string; label: string };
export type Board = { width: number; height: number; groups: BoardGroup[]; arrows: BoardArrow[]; groupOf: Map<string, string>; rows: { level: number; top: number; bottom: number }[] };

const rank = (role: string) => { const i = TARGET_ROLES.indexOf(role); return i < 0 ? 99 : i; };

export function groupKeyOf(t: InvestigationTarget, custom: OrgGroup[]) {
  if (t.cluster && custom.some((g) => g.name === t.cluster)) return `c:${t.cluster}`;
  // Mesmo núcleo da função em graus diferentes vira um quadro por grau.
  return `a:${(AUTO_GROUPS[t.role] || AUTO_GROUPS["Associado"]).name}|${levelOf(t)}`;
}

/** Quebra o texto em linhas de até `max` caracteres. */
export function wrapText(text: string, max: number) {
  const out: string[] = []; let line = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= max || !line) line = next; else { out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out;
}

export function buildBoard(targets: InvestigationTarget[], links: InvestigationLink[], custom: OrgGroup[], autoLinks: AutoLink[] = []): Board {
  const byId = new Map(targets.map((t) => [t.id, t]));
  const groupOf = new Map<string, string>();
  const groups = new Map<string, BoardGroup>();
  const sorted = [...targets].sort((a, b) => rank(a.role) - rank(b.role) || a.position - b.position || a.id.localeCompare(b.id));
  for (const t of sorted) {
    const key = groupKeyOf(t, custom);
    groupOf.set(t.id, key);
    if (!groups.has(key)) {
      const ci = custom.findIndex((g) => `c:${g.name}` === key); const c = ci >= 0 ? custom[ci] : undefined;
      const autoName = groupNameOfKey(key); const autoRole = roleOfAutoGroup(autoName);
      groups.set(key, {
        key, name: c ? c.name : autoName, custom: Boolean(c), color: c?.color || ROLE_COLOR[autoRole] || "#6B655A",
        activities: (c?.activities || "").split("\n").map((s) => s.trim()).filter(Boolean),
        level: c ? (Number.isFinite(c.level) ? c.level! : -1) : levelOf(t), order: c ? 100 + ci : rank(autoRole),
        x: 0, y: 0, w: 0, h: 0, cards: [], lanesTop: 0, actTop: 0,
      });
    }
    groups.get(key)!.cards.push({ targetId: t.id, x: 0, y: 0 });
  }
  // Núcleo do analista sem nível escolhido: fica na linha da função mais alta entre os membros.
  for (const g of groups.values()) if (g.level < 0) g.level = Math.min(...g.cards.map((c) => levelOf(byId.get(c.targetId)!)));

  // Ligações dentro do mesmo quadro usam "faixas" embaixo dos cartões.
  type Inner = { kind: "chefia" | "vinculo" | "auto"; a: string; b: string; label?: string; id: string };
  const inner = new Map<string, Inner[]>();
  const addInner = (g: string, v: Inner) => { inner.set(g, [...(inner.get(g) || []), v]); };
  for (const t of targets) if (t.parentId && byId.has(t.parentId) && groupOf.get(t.parentId) === groupOf.get(t.id)) addInner(groupOf.get(t.id)!, { kind: "chefia", a: t.parentId, b: t.id, id: `h-${t.id}` });
  for (const l of links) if (byId.has(l.fromTarget) && byId.has(l.toTarget) && groupOf.get(l.fromTarget) === groupOf.get(l.toTarget)) addInner(groupOf.get(l.fromTarget)!, { kind: "vinculo", a: l.fromTarget, b: l.toTarget, label: l.relation, id: `l-${l.id}` });
  for (const [i, l] of autoLinks.entries()) if (byId.has(l.a) && byId.has(l.b) && groupOf.get(l.a) === groupOf.get(l.b)) addInner(groupOf.get(l.a)!, { kind: "auto", a: l.a, b: l.b, label: l.label, id: `x-${i}` });

  // Tamanho de cada quadro.
  for (const g of groups.values()) {
    const n = g.cards.length;
    const perRow = Math.min(n, n > 8 ? 5 : n > 6 ? 4 : n > 4 ? 3 : n);
    const rows = Math.ceil(n / perRow);
    const innerW = perRow * CARD_W + (perRow - 1) * GAP_CARD;
    const titleW = g.name.length * 8 + 34;
    g.w = Math.max(innerW + PAD * 2, titleW, g.activities.length ? 230 : 0);
    const maxChars = Math.floor((g.w - 2 * PAD) / 5.9);
    g.activities = g.activities.flatMap((a, i) => wrapText(`${i + 1}. ${a.toUpperCase()}`, maxChars).map((l, k) => (k ? `   ${l}` : l)));
    const lanes = (inner.get(g.key) || []).length;
    g.lanesTop = HEAD + PAD + rows * CARD_H + (rows - 1) * GAP_CARD;
    g.actTop = g.lanesTop + (lanes ? lanes * LANE + 14 : 0);
    g.h = g.actTop + (g.activities.length ? 20 + g.activities.length * 12.5 + 4 : 0) + PAD;
    g.cards.forEach((c, i) => {
      const r = Math.floor(i / perRow); const col = i % perRow;
      const inRow = Math.min(perRow, n - r * perRow);
      const rowW = inRow * CARD_W + (inRow - 1) * GAP_CARD;
      c.x = (g.w - innerW) / 2 + (innerW - rowW) / 2 + col * (CARD_W + GAP_CARD);
      c.y = HEAD + PAD + r * (CARD_H + GAP_CARD);
    });
  }

  // Linhas fixas por nível, quadros em ordem fixa (função; núcleos do analista na ordem da lista).
  const levels = [...new Set([...groups.values()].map((g) => g.level))].sort((a, b) => a - b);
  const rows: { groups: BoardGroup[]; top: number; bottom: number; level: number }[] = [];
  let y = MARGIN;
  for (const lv of levels) {
    const row = [...groups.values()].filter((g) => g.level === lv).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    let x = MARGIN;
    for (const g of row) { g.x = x; g.y = y; x += g.w + GAP_GROUP; }
    const h = Math.max(...row.map((g) => g.h));
    rows.push({ groups: row, top: y, bottom: y + h, level: lv });
    y += h + GAP_ROW;
  }
  const width = LEFT + Math.max(360, ...rows.map((r) => r.groups.reduce((s, g) => s + g.w, 0) + GAP_GROUP * (r.groups.length - 1) + MARGIN * 2));
  for (const r of rows) {
    const rw = r.groups.reduce((s, g) => s + g.w, 0) + GAP_GROUP * (r.groups.length - 1);
    const off = LEFT + (width - LEFT - rw) / 2 - MARGIN;
    r.groups.forEach((g) => { g.x += off; });
  }
  const height = y - GAP_ROW + MARGIN + 24;
  const rowOf = (g: BoardGroup) => rows.findIndex((r) => r.groups.includes(g));

  const cardBox = (id: string) => { const g = groups.get(groupOf.get(id)!)!; const c = g.cards.find((k) => k.targetId === id)!; return { x: g.x + c.x, y: g.y + c.y, cx: g.x + c.x + CARD_W / 2, g }; };
  const arrows: BoardArrow[] = [];
  // Faixas de cada vão entre linhas, para as setas não se sobreporem.
  const laneCount = new Map<string, number>();
  const lane = (key: string) => { const n = laneCount.get(key) || 0; laneCount.set(key, n + 1); return (n % 5) * 7; };

  /** Uma vertical em x, entre y1 e y2, passa por algum quadro? */
  const all = [...groups.values()];
  const clear = (x: number, y1: number, y2: number, skip: BoardGroup[]) => {
    const [lo, hi] = y1 < y2 ? [y1, y2] : [y2, y1];
    return !all.some((g) => !skip.includes(g) && x > g.x - 6 && x < g.x + g.w + 6 && hi > g.y && lo < g.y + g.h);
  };
  /** Corredor livre (entre quadros ou nas margens) mais perto de x. */
  const corridor = (x: number, y1: number, y2: number, skip: BoardGroup[]) => {
    const xs = [LEFT + MARGIN / 2, width - MARGIN / 2, ...all.flatMap((g) => [g.x - GAP_GROUP / 2, g.x + g.w + GAP_GROUP / 2])];
    return xs.filter((cx) => clear(cx, y1, y2, skip)).sort((m, n) => Math.abs(m - x) - Math.abs(n - x))[0] ?? LEFT + MARGIN / 2;
  };
  /** Seta de comando entre quadros diferentes, sempre por fora dos quadros (contorna os do meio). */
  const route = (sx: number, pg: BoardGroup, tx: number, tg: BoardGroup, id: string, from: string, to: string[]) => {
    const pr = rowOf(pg); const tr = rowOf(tg);
    const skip = [pg, tg];
    let d: string;
    if (tr > pr) {
      const yA = rows[pr].bottom + GAP_ROW / 2 - 14 + lane(`gap${pr + 1}`);
      const yB = tr === pr + 1 ? yA : rows[tr].top - GAP_ROW / 2 - 14 + lane(`gap${tr}`);
      if (tr === pr + 1 || clear(tx, yA, tg.y, skip)) d = `M${sx},${pg.y + pg.h} V${yA} H${tx} V${tg.y - 2}`;
      else { const cx = corridor((sx + tx) / 2, yA, yB, skip); d = `M${sx},${pg.y + pg.h} V${yA} H${cx} V${yB} H${tx} V${tg.y - 2}`; }
    } else if (tr < pr) {
      // Subordinado acima do chefe (função mais alta que a do chefe): sobe pelo vão.
      const yA = rows[pr].top - GAP_ROW / 2 + 14 - lane(`up${pr}`);
      const yB = tr === pr - 1 ? yA : rows[tr].bottom + GAP_ROW / 2 + 14 - lane(`up${tr + 1}`);
      if (tr === pr - 1 || clear(tx, yA, tg.y + tg.h, skip)) d = `M${sx},${pg.y} V${yA} H${tx} V${tg.y + tg.h + 2}`;
      else { const cx = corridor((sx + tx) / 2, yA, yB, skip); d = `M${sx},${pg.y} V${yA} H${cx} V${yB} H${tx} V${tg.y + tg.h + 2}`; }
    } else {
      const yA = rows[pr].bottom + 16 + lane(`gap${pr + 1}`);
      d = `M${sx},${pg.y + pg.h} V${yA} H${tx} V${tg.y + tg.h + 2}`;
    }
    arrows.push({ id, kind: "chefia", d, from, to });
  };
  const handled = new Set<string>();
  // Um superior que comanda o quadro inteiro: uma seta só, até o quadro.
  for (const g of groups.values()) {
    const parents = new Set(g.cards.map((c) => byId.get(c.targetId)!.parentId));
    if (g.cards.length < 2 || parents.size !== 1) continue;
    const pid = [...parents][0];
    if (!pid || !byId.has(pid) || groupOf.get(pid) === g.key) continue;
    const p = cardBox(pid);
    route(p.cx, p.g, g.x + g.w / 2, g, `g-${g.key}`, pid, g.cards.map((c) => c.targetId));
    g.cards.forEach((c) => handled.add(c.targetId));
  }
  for (const t of targets) {
    if (!t.parentId || !byId.has(t.parentId) || handled.has(t.id) || groupOf.get(t.parentId) === groupOf.get(t.id)) continue;
    const p = cardBox(t.parentId); const c = cardBox(t.id);
    route(p.cx, p.g, c.cx, c.g, `h-${t.id}`, t.parentId, [t.id]);
  }
  // Ligações dentro do quadro: faixas embaixo dos cartões.
  for (const g of groups.values()) {
    (inner.get(g.key) || []).forEach((v, i) => {
      const a = cardBox(v.a); const b = cardBox(v.b);
      const ly = g.y + g.lanesTop + 10 + i * LANE;
      const ax = a.cx - 8 + (i % 3) * 8; const bx = b.cx + 8 - (i % 3) * 8;
      const d = `M${ax},${a.y + CARD_H} V${ly} H${bx} V${b.y + CARD_H + (v.kind === "chefia" ? 2 : 0)}`;
      arrows.push({ id: v.id, kind: v.kind, d, label: v.label, lx: (ax + bx) / 2, ly, from: v.a, to: [v.b] });
    });
  }
  // Vínculos entre quadros: linha reta entre os cartões, com o rótulo no meio.
  const straight = (ida: string, idb: string, kind: "vinculo" | "auto", label: string, id: string) => {
    const a = cardBox(ida); const b = cardBox(idb);
    const ay = a.y + 52; const by = b.y + 52;
    const x1 = a.cx + (b.cx > a.cx ? CARD_W / 2 : -CARD_W / 2); const x2 = b.cx + (a.cx > b.cx ? CARD_W / 2 : -CARD_W / 2);
    arrows.push({ id, kind, label, d: `M${x1},${ay} L${x2},${by}`, lx: (x1 + x2) / 2, ly: (ay + by) / 2, from: ida, to: [idb] });
  };
  for (const l of links) if (byId.has(l.fromTarget) && byId.has(l.toTarget) && groupOf.get(l.fromTarget) !== groupOf.get(l.toTarget)) straight(l.fromTarget, l.toTarget, "vinculo", l.relation, `l-${l.id}`);
  autoLinks.forEach((l, i) => { if (byId.has(l.a) && byId.has(l.b) && groupOf.get(l.a) !== groupOf.get(l.b)) straight(l.a, l.b, "auto", l.label, `x-${i}`); });
  return { width, height, groups: [...groups.values()], arrows, groupOf, rows: rows.map((r) => ({ level: r.level, top: r.top, bottom: r.bottom })) };
}
