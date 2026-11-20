// Organograma em "quadro por núcleos" (estilo análise de vínculos): cada núcleo é um quadro com título,
// os alvos aparecem como cartões com foto, setas vermelhas mostram quem comanda quem e as
// atividades criminosas do núcleo ficam listadas dentro do quadro.
import { ROLE_COLOR, TARGET_ROLES, type InvestigationLink, type InvestigationTarget, type OrgGroup } from "./investigation";

export const CARD_W = 108;
export const CARD_H = 150;
const PAD = 12;
const HEAD = 28;
const GAP_CARD = 10;
const GAP_GROUP = 36;
const GAP_ROW = 78;
const MARGIN = 24;

/** Núcleo automático de cada função e o nível em que costuma ficar. */
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
export const roleOfAutoGroup = (name: string) => Object.entries(AUTO_GROUPS).find(([, g]) => g.name === name)?.[0] || "";
export const GROUP_COLORS = ["#B3261E", "#C28A12", "#7A6C45", "#231F20", "#2F5D7C", "#5B3E8A", "#2E6B3A", "#8A3B12", "#0F6E6E"];

export type BoardCard = { targetId: string; x: number; y: number };
export type BoardGroup = { key: string; name: string; custom: boolean; color: string; activities: string[]; level: number; x: number; y: number; w: number; h: number; cards: BoardCard[] };
export type BoardArrow = { d: string; kind: "chefia" | "vinculo"; label?: string; lx?: number; ly?: number; id: string };
export type Board = { width: number; height: number; groups: BoardGroup[]; arrows: BoardArrow[]; groupOf: Map<string, string> };

const rank = (role: string) => { const i = TARGET_ROLES.indexOf(role); return i < 0 ? 99 : i; };

export function groupKeyOf(t: InvestigationTarget, custom: OrgGroup[]) {
  if (t.cluster && custom.some((g) => g.name === t.cluster)) return `c:${t.cluster}`;
  return `a:${(AUTO_GROUPS[t.role] || AUTO_GROUPS["Associado"]).name}`;
}

export function buildBoard(targets: InvestigationTarget[], links: InvestigationLink[], custom: OrgGroup[]): Board {
  const byId = new Map(targets.map((t) => [t.id, t]));
  const groupOf = new Map<string, string>();
  const groups = new Map<string, BoardGroup>();
  const sorted = [...targets].sort((a, b) => rank(a.role) - rank(b.role) || a.position - b.position);
  for (const t of sorted) {
    const key = groupKeyOf(t, custom);
    groupOf.set(t.id, key);
    if (!groups.has(key)) {
      const c = key.startsWith("c:") ? custom.find((g) => `c:${g.name}` === key) : undefined;
      const autoName = key.slice(2);
      groups.set(key, {
        key, name: c ? c.name : autoName, custom: Boolean(c), color: c?.color || ROLE_COLOR[roleOfAutoGroup(autoName)] || ROLE_COLOR[t.role] || "#6B655A",
        activities: (c?.activities || "").split("\n").map((s) => s.trim()).filter(Boolean),
        level: 0, x: 0, y: 0, w: 0, h: 0, cards: [],
      });
    }
    groups.get(key)!.cards.push({ targetId: t.id, x: 0, y: 0 });
  }

  // Nível de cada núcleo: profundidade na hierarquia (quem comanda fica acima); sem hierarquia, pela função.
  const depth = (t: InvestigationTarget) => { let d = 0; let cur = t; const seen = new Set<string>(); while (cur.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) { seen.add(cur.id); cur = byId.get(cur.parentId)!; d += 1; } return d; };
  const inTree = (t: InvestigationTarget) => Boolean(t.parentId && byId.has(t.parentId)) || targets.some((x) => x.parentId === t.id);
  for (const g of groups.values()) {
    const levels = g.cards.map((c) => { const t = byId.get(c.targetId)!; return inTree(t) ? depth(t) : (AUTO_GROUPS[t.role] || AUTO_GROUPS["Associado"]).level; });
    g.level = Math.min(...levels);
  }
  // Núcleo subordinado fica sempre abaixo do núcleo de quem o comanda.
  for (let round = 0; round < 12; round++) {
    let changed = false;
    for (const t of targets) {
      if (!t.parentId || !byId.has(t.parentId)) continue;
      const g = groups.get(groupOf.get(t.id)!)!; const pg = groups.get(groupOf.get(t.parentId)!)!;
      if (g !== pg && g.level <= pg.level) { g.level = pg.level + 1; changed = true; }
    }
    if (!changed) break;
  }

  // Quadros com vínculo entre os próprios alvos ganham espaço embaixo para a curva do vínculo.
  const innerLink = new Set<string>();
  for (const l of links) { const a = groupOf.get(l.fromTarget); if (a && a === groupOf.get(l.toTarget)) innerLink.add(a); }
  // Tamanho de cada quadro.
  for (const g of groups.values()) {
    const n = g.cards.length;
    const perRow = Math.min(n, n > 6 ? 4 : n > 4 ? 3 : n);
    const rows = Math.ceil(n / perRow);
    const actH = g.activities.length ? 18 + g.activities.length * 13 + 6 : 0;
    const titleW = g.name.length * 8 + 30;
    g.w = Math.max(perRow * CARD_W + (perRow - 1) * GAP_CARD + PAD * 2, titleW, g.activities.length ? 190 : 0);
    g.h = HEAD + PAD + rows * CARD_H + (rows - 1) * GAP_CARD + PAD + actH + (innerLink.has(g.key) ? 34 : 0);
    const innerW = perRow * CARD_W + (perRow - 1) * GAP_CARD;
    g.cards.forEach((c, i) => {
      const r = Math.floor(i / perRow); const col = i % perRow;
      const inRow = Math.min(perRow, n - r * perRow);
      const rowW = inRow * CARD_W + (inRow - 1) * GAP_CARD;
      c.x = (g.w - innerW) / 2 + (innerW - rowW) / 2 + col * (CARD_W + GAP_CARD);
      c.y = HEAD + PAD + r * (CARD_H + GAP_CARD);
    });
  }

  // Linhas de núcleos, ordenadas pelo centro de quem as comanda.
  const levels = [...new Set([...groups.values()].map((g) => g.level))].sort((a, b) => a - b);
  const cardCenter = new Map<string, number>();
  const rowsOf: BoardGroup[][] = [];
  let y = MARGIN;
  for (const lv of levels) {
    const row = [...groups.values()].filter((g) => g.level === lv);
    const bary = (g: BoardGroup) => {
      const xs = g.cards.map((c) => byId.get(c.targetId)!.parentId).filter((p) => p && cardCenter.has(p)).map((p) => cardCenter.get(p)!);
      return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : Number.POSITIVE_INFINITY;
    };
    row.sort((a, b) => bary(a) - bary(b) || rank(roleOfAutoGroup(a.name)) - rank(roleOfAutoGroup(b.name)) || a.name.localeCompare(b.name));
    let x = MARGIN;
    for (const g of row) { g.x = x; g.y = y; x += g.w + GAP_GROUP; g.cards.forEach((c) => cardCenter.set(c.targetId, g.x + c.x + CARD_W / 2)); }
    y += Math.max(...row.map((g) => g.h)) + GAP_ROW;
    rowsOf.push(row);
  }
  const width = Math.max(320, ...rowsOf.map((r) => r.reduce((s, g) => s + g.w, 0) + GAP_GROUP * (r.length - 1) + MARGIN * 2));
  // Centraliza cada linha.
  for (const row of rowsOf) {
    const rw = row.reduce((s, g) => s + g.w, 0) + GAP_GROUP * (row.length - 1);
    const off = (width - rw) / 2 - MARGIN;
    row.forEach((g) => { g.x += off; });
  }
  const height = y - GAP_ROW + MARGIN + 20;

  // Setas.
  const cardBox = (id: string) => { const g = groups.get(groupOf.get(id)!)!; const c = g.cards.find((k) => k.targetId === id)!; return { x: g.x + c.x, y: g.y + c.y, g }; };
  const arrows: BoardArrow[] = [];
  const handled = new Set<string>();
  // Quem comanda um núcleo inteiro: uma seta só, até o título do quadro.
  for (const g of groups.values()) {
    const parents = new Set(g.cards.map((c) => byId.get(c.targetId)!.parentId));
    if (g.cards.length < 2 || parents.size !== 1) continue;
    const pid = [...parents][0];
    if (!pid || !byId.has(pid) || groupOf.get(pid) === g.key) continue;
    const p = cardBox(pid);
    const sx = p.x + CARD_W / 2; const sy = p.g.activities.length ? p.g.y + p.g.h : p.y + CARD_H; const tx = g.x + g.w / 2; const ty = g.y;
    const my = p.g.level < g.level ? ty - GAP_ROW / 2 : sy + 14;
    arrows.push({ id: `g-${g.key}`, kind: "chefia", d: `M${sx},${sy} V${my} H${tx} V${ty - 2}` });
    g.cards.forEach((c) => handled.add(c.targetId));
  }
  let k = 0;
  for (const t of targets) {
    if (!t.parentId || !byId.has(t.parentId) || handled.has(t.id)) continue;
    const p = cardBox(t.parentId); const c = cardBox(t.id);
    const sx = p.x + CARD_W / 2; const tx = c.x + CARD_W / 2;
    if (p.g === c.g) {
      // Mesmo quadro: seta pela parte de baixo dos cartões.
      const by = Math.max(p.y, c.y) + CARD_H + 5 + (k++ % 3) * 4;
      arrows.push({ id: `h-${t.id}`, kind: "chefia", d: `M${sx},${p.y + CARD_H} V${by} H${tx} V${c.y + CARD_H + 2}` });
    } else if (c.y > p.y) {
      const my = c.g.y - GAP_ROW / 2 + (k++ % 3) * 6;
      const sy = p.g.activities.length ? p.g.y + p.g.h : p.y + CARD_H;
      arrows.push({ id: `h-${t.id}`, kind: "chefia", d: `M${sx},${sy} V${my} H${tx} V${c.g.y - 2}` });
    } else {
      arrows.push({ id: `h-${t.id}`, kind: "chefia", d: `M${sx},${p.y} V${c.y + CARD_H + 2}` });
    }
  }
  for (const l of links) {
    if (!byId.has(l.fromTarget) || !byId.has(l.toTarget)) continue;
    const a = cardBox(l.fromTarget); const b = cardBox(l.toTarget);
    const ax = a.x + CARD_W / 2; const ay = a.y + 44; const bx = b.x + CARD_W / 2; const by = b.y + 44;
    const sameRow = Math.abs(ay - by) < 1;
    if (sameRow && a.g === b.g) {
      // Mesmo quadro e mesma linha: curva por baixo dos nomes, rótulo no meio.
      const yb = a.y + CARD_H - 4; const cy2 = yb + 52;
      arrows.push({ id: `l-${l.id}`, kind: "vinculo", label: l.relation, d: `M${ax},${yb} Q${(ax + bx) / 2},${cy2} ${bx},${yb}`, lx: (ax + bx) / 2, ly: (yb + cy2) / 2 + 2 });
      continue;
    }
    // Sai pela lateral do cartão; na mesma linha, a curva passa por cima.
    const x1 = ax + (bx > ax ? CARD_W / 2 : bx < ax ? -CARD_W / 2 : CARD_W / 2);
    const x2 = bx + (ax > bx ? CARD_W / 2 : ax < bx ? -CARD_W / 2 : CARD_W / 2);
    const cx = (x1 + x2) / 2 + (Math.abs(ax - bx) < 1 ? 46 : 0);
    const cy = sameRow ? ay - 70 : (ay + by) / 2;
    arrows.push({ id: `l-${l.id}`, kind: "vinculo", label: l.relation, d: `M${x1},${ay} Q${cx},${cy} ${x2},${by}`, lx: (x1 + x2) / 2 * 0.5 + cx * 0.5, ly: sameRow ? (ay + cy) / 2 : cy });
  }
  return { width, height, groups: [...groups.values()], arrows, groupOf };
}
