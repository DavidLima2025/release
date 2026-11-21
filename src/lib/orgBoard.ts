// Organograma em "quadro por núcleos" (estilo análise de vínculos).
// Regras de posição FIXAS e previsíveis: a linha de cada quadro depende só da função (ou do nível
// escolhido para o núcleo), nunca das setas. Assim, ligar um alvo a outro não faz o líder "descer"
// nem o receptador "subir": muda só a seta.
import { TARGET_ROLES, ROLE_COLOR, type InvestigationLink, type InvestigationTarget, type OrgGroup, type BoardLayout } from "./investigation";

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
/** Núcleo e linha do papel. Papel que não está mais no catálogo cai em "Associados". */
export const autoGroupOf = (role: string) => AUTO_GROUPS[role] || AUTO_GROUPS["Associado"] || { name: "ASSOCIADOS", level: 3 };
export const autoLevel = (role: string) => autoGroupOf(role).level;
export const MAX_GRADE = 7;
/** Grau do alvo (0 = topo): o definido pelo analista ou o da função. */
export const levelOf = (t: InvestigationTarget) => (t.grade ? Math.min(MAX_GRADE, t.grade) - 1 : autoLevel(t.role));
/** Nome do núcleo a partir da chave ("a:EXECUTORES|2" → "EXECUTORES"). */
export const groupNameOfKey = (key: string) => key.slice(2).split("|")[0];

/** x,y relativos ao quadro; manual = o analista arrastou este cartão para fora do lugar automático. */
export type BoardCard = { targetId: string; x: number; y: number; manual?: boolean };
export type BoardGroup = { key: string; name: string; custom: boolean; color: string; activities: string[]; level: number; order: number; x: number; y: number; w: number; h: number; cards: BoardCard[]; lanesTop: number; actTop: number; manual?: boolean };
/** from/to: alvos ligados pela seta (para destacar a cadeia de comando do alvo selecionado). */
/** head=false: trecho do tronco/barra de uma "árvore" de comando (sem ponta de seta). */
export type BoardArrow = { d: string; kind: "chefia" | "vinculo" | "auto"; head?: boolean; label?: string; lx?: number; ly?: number; id: string; from?: string; to?: string[]; ends?: { x: number; y: number }[] };
export type AutoLink = { a: string; b: string; label: string };
export type Board = { width: number; height: number; groups: BoardGroup[]; arrows: BoardArrow[]; groupOf: Map<string, string>; rows: { level: number; top: number; bottom: number }[] };

const rank = (role: string) => { const i = TARGET_ROLES.indexOf(role); return i < 0 ? 99 : i; };

export function groupKeyOf(t: InvestigationTarget, custom: OrgGroup[]) {
  if (t.cluster && custom.some((g) => g.name === t.cluster)) return `c:${t.cluster}`;
  // Mesmo núcleo da função em graus diferentes vira um quadro por grau.
  return `a:${autoGroupOf(t.role).name}|${levelOf(t)}`;
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

/** O que muda no alvo quando ele é solto sobre um núcleo do quadro (núcleo do analista, ou a função/grau do núcleo automático). */
export function groupDropPatch(t: InvestigationTarget, key: string): Partial<InvestigationTarget> {
  if (key.startsWith("c:")) return { cluster: groupNameOfKey(key) };
  const role = roleOfAutoGroup(groupNameOfKey(key)) || t.role; const lv = Number(key.split("|")[1]);
  return { cluster: "", role, grade: Number.isFinite(lv) && lv !== autoLevel(role) ? lv + 1 : null };
}

/** Arredonda a posição arrastada (grade de 4 px: alinha sem "travar"). */
export const snap = (v: number) => Math.max(0, Math.round(v / 4) * 4);

/** Layout com um cartão colocado em (x,y) absoluto, ou sem ele (null) para voltar ao automático. */
export function layoutWithCard(layout: BoardLayout, id: string, groupKey: string, pos: { x: number; y: number } | null): BoardLayout {
  const cards = { ...layout.cards };
  if (pos) cards[id] = { x: Math.max(0, Math.round(pos.x)), y: Math.max(0, Math.round(pos.y)), g: groupKey }; else delete cards[id];
  return { ...layout, cards };
}

/** Layout com o núcleo em (x,y): os cartões dele que já estavam soltos acompanham. `board` = tabuleiro ANTES do movimento. */
export function layoutWithGroup(layout: BoardLayout, board: Board, key: string, pos: { x: number; y: number }): BoardLayout {
  const g = board.groups.find((k) => k.key === key); if (!g) return layout;
  const x = Math.max(0, Math.round(pos.x)); const y = Math.max(0, Math.round(pos.y));
  const dx = x - g.x; const dy = y - g.y;
  const cards = { ...layout.cards };
  for (const c of g.cards) { const o = cards[c.targetId]; if (o && o.g === key) cards[c.targetId] = { x: Math.max(0, Math.round(o.x + dx)), y: Math.max(0, Math.round(o.y + dy)), g: key }; }
  return { groups: { ...layout.groups, [key]: { x, y } }, cards };
}

export function buildBoard(targets: InvestigationTarget[], links: InvestigationLink[], custom: OrgGroup[], autoLinks: AutoLink[] = [], layout?: BoardLayout): Board {
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

  // Cartões que o analista arrastou para fora do lugar: as setas deles não usam as "faixas" do quadro.
  const movedCards = new Set<string>(); const movedGroups = new Set<string>();
  for (const g of groups.values()) {
    if (layout?.groups[g.key]) movedGroups.add(g.key);
    for (const c of g.cards) { const o = layout?.cards[c.targetId]; if (o && o.g === g.key) movedCards.add(c.targetId); }
  }
  const sameBox = (a: string, b: string) => groupOf.get(a) === groupOf.get(b) && !movedCards.has(a) && !movedCards.has(b);
  const moved = (id: string) => movedCards.has(id) || movedGroups.has(groupOf.get(id)!);

  // Ligações dentro do mesmo quadro usam "faixas" embaixo dos cartões.
  type Inner = { kind: "chefia" | "vinculo" | "auto"; a: string; b: string; label?: string; id: string };
  const inner = new Map<string, Inner[]>();
  const addInner = (g: string, v: Inner) => { inner.set(g, [...(inner.get(g) || []), v]); };
  for (const t of targets) if (t.parentId && byId.has(t.parentId) && sameBox(t.parentId, t.id)) addInner(groupOf.get(t.id)!, { kind: "chefia", a: t.parentId, b: t.id, id: `h-${t.id}` });
  for (const l of links) if (byId.has(l.fromTarget) && byId.has(l.toTarget) && sameBox(l.fromTarget, l.toTarget)) addInner(groupOf.get(l.fromTarget)!, { kind: "vinculo", a: l.fromTarget, b: l.toTarget, label: l.relation, id: `l-${l.id}` });
  for (const [i, l] of autoLinks.entries()) if (byId.has(l.a) && byId.has(l.b) && sameBox(l.a, l.b)) addInner(groupOf.get(l.a)!, { kind: "auto", a: l.a, b: l.b, label: l.label, id: `x-${i}` });

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
  const baseW = LEFT + Math.max(360, ...rows.map((r) => r.groups.reduce((s, g) => s + g.w, 0) + GAP_GROUP * (r.groups.length - 1) + MARGIN * 2));
  for (const r of rows) {
    const rw = r.groups.reduce((s, g) => s + g.w, 0) + GAP_GROUP * (r.groups.length - 1);
    const off = LEFT + (baseW - LEFT - rw) / 2 - MARGIN;
    r.groups.forEach((g) => { g.x += off; });
  }
  // Posições arrastadas à mão: os demais quadros ficam onde estão (não "andam"); o quadro cresce se precisar.
  for (const g of groups.values()) { const o = layout?.groups[g.key]; if (o) { g.x = o.x; g.y = o.y; g.manual = true; } }
  for (const g of groups.values()) for (const c of g.cards) { if (movedCards.has(c.targetId)) { const o = layout!.cards[c.targetId]; c.x = o.x - g.x; c.y = o.y - g.y; c.manual = true; } }
  let width = baseW; let height = y - GAP_ROW + MARGIN + 24;
  for (const g of groups.values()) {
    width = Math.max(width, g.x + g.w + MARGIN); height = Math.max(height, g.y + g.h + MARGIN);
    for (const c of g.cards) { width = Math.max(width, g.x + c.x + CARD_W + MARGIN); height = Math.max(height, g.y + c.y + CARD_H + MARGIN); }
  }
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
    // Prefere corredor com folga (não encostado na quina de um quadro); sem folga, aceita o que estiver livre.
    const near = (list: number[]) => list.sort((m, n) => Math.abs(m - x) - Math.abs(n - x))[0];
    for (const m of [GAP_ROW, 30, 0]) { const c = near(xs.filter((cx) => clear(cx, y1 - m, y2 + m, skip))); if (c !== undefined) return c; }
    return LEFT + MARGIN / 2;
  };
  /**
   * Setas de comando de um chefe para um quadro, em "árvore": um tronco que sai do chefe, uma barra
   * na faixa livre logo acima (ou abaixo) do quadro de destino e uma descida curta, com seta, por subordinado.
   * Vários subordinados do mesmo quadro deixam de empilhar uma seta inteira cada. Sempre por fora dos quadros.
   */
  type Kid = { tx: number; ids: string[]; id: string };
  const lanes = new Map<string, number>();
  const sharedLane = (key: string, group: string) => { const k = `${group}|${key}`; if (!lanes.has(k)) lanes.set(k, lane(group)); return lanes.get(k)!; };
  // Chefes diferentes que descem pelo mesmo corredor ganham colunas vizinhas (6 px), para as verticais não se confundirem.
  const used = new Map<number, string[]>(); const spreadAt = new Map<string, number>();
  const spread = (from: string, cx: number, y1: number, y2: number, skip: BoardGroup[]) => {
    const key = `${from}|${cx}`; if (spreadAt.has(key)) return spreadAt.get(key)!;
    const who = used.get(cx) || []; const n = who.length; who.push(from); used.set(cx, who);
    const edge = cx <= LEFT + MARGIN / 2 + 0.5 ? 1 : cx >= width - MARGIN / 2 - 0.5 ? -1 : 0;
    const off = edge ? edge * (n % 5) * 6 : (n % 2 ? 1 : -1) * Math.ceil((n % 5) / 2) * 6;
    const out = clear(cx + off, y1, y2, skip) ? cx + off : cx;
    spreadAt.set(key, out); return out;
  };
  const routeBundle = (sx: number, pg: BoardGroup, tg: BoardGroup, kids: Kid[], from: string) => {
    const pr = rowOf(pg); const tr = rowOf(tg); const skip = [pg, tg];
    const sorted = [...kids].sort((a, b) => a.tx - b.tx);
    const dir = tr > pr ? 1 : tr < pr ? -1 : 0;
    const start = dir < 0 ? pg.y : pg.y + pg.h;
    const endY = dir > 0 ? tg.y - 2 : tg.y + tg.h + 2;
    // A barra fica perto do destino; o mesmo chefe reaproveita a mesma barra para os quadros da mesma linha.
    const bl = sharedLane(from, `in${tr}`);
    const yBus = dir > 0 ? tg.y - 24 - bl : dir < 0 ? tg.y + tg.h + 24 + bl : rows[pr].bottom + 16 + bl;
    let busX = sx; let trunk = `M${sx},${start} V${yBus}`;
    if (dir !== 0 && !clear(sx, start, yBus, skip)) {
      // Há quadros no caminho do tronco: sai pelo vão logo depois da linha do chefe e desce por um corredor livre.
      const pl = sharedLane(from, `out${pr}${dir}`);
      const yA = dir > 0 ? rows[pr].bottom + 16 + pl : rows[pr].top - 16 - pl;
      busX = spread(from, corridor((sx + (sorted[0].tx + sorted[sorted.length - 1].tx) / 2) / 2, yA, yBus, skip), yA, yBus, skip);
      trunk = `M${sx},${start} V${yA} H${busX} V${yBus}`;
    }
    if (sorted.length === 1) { const k = sorted[0]; arrows.push({ id: k.id, kind: "chefia", d: `${trunk} H${k.tx} V${endY}`, from, to: k.ids }); return; }
    arrows.push({ id: `t-${from}-${tg.key}`, kind: "chefia", d: trunk, from, to: sorted.flatMap((k) => k.ids), head: false });
    // Barra em trechos (um por subordinado, do tronco para fora), para o destaque acender só o caminho do selecionado.
    const outward = (list: Kid[]) => {
      let prev = busX;
      list.forEach((k, i) => {
        if (Math.abs(k.tx - prev) > 0.5) arrows.push({ id: `b-${k.id}`, kind: "chefia", d: `M${prev},${yBus} H${k.tx}`, from, to: list.slice(i).flatMap((o) => o.ids), head: false });
        prev = k.tx;
      });
    };
    outward(sorted.filter((k) => k.tx >= busX));
    outward(sorted.filter((k) => k.tx < busX).reverse());
    for (const k of sorted) arrows.push({ id: k.id, kind: "chefia", d: `M${k.tx},${yBus} V${endY}`, from, to: k.ids });
  };
  /** Seta de comando quando um dos lados foi movido à mão: cotovelo que tenta não atravessar quadros nem cartões soltos. */
  let freeN = 0;
  const freeRoute = (pid: string, tid: string | null, tg: BoardGroup, id: string, to: string[]) => {
    const p = cardBox(pid);
    const pBot = movedCards.has(pid) ? p.y + CARD_H : p.g.y + p.g.h; const pTop = movedCards.has(pid) ? p.y : p.g.y;
    let tx: number; let tTop: number; let tBot: number;
    if (tid) { const c = cardBox(tid); tx = c.cx; tTop = movedCards.has(tid) ? c.y : c.g.y; tBot = movedCards.has(tid) ? c.y + CARD_H : c.g.y + c.g.h; }
    else { tx = tg.x + tg.w / 2; tTop = tg.y; tBot = tg.y + tg.h; }
    const sx = p.cx;
    // Obstáculos: quadros (menos os do próprio chefe/subordinado, se ainda estão dentro deles) e cartões soltos.
    const skipG = [movedCards.has(pid) ? null : p.g, tid && movedCards.has(tid) ? null : tg];
    const obs = [
      ...all.filter((g) => !skipG.includes(g)).map((g) => ({ x: g.x, y: g.y, w: g.w, h: g.h })),
      ...[...movedCards].filter((m) => m !== pid && m !== tid).map((m) => { const b = cardBox(m); return { x: b.x, y: b.y, w: CARD_W, h: CARD_H }; }),
    ];
    const hits = (pts: [number, number][]) => obs.filter((o) => pts.some((a, i) => {
      if (!i) return false; const b = pts[i - 1];
      return Math.max(a[0], b[0]) > o.x - 4 && Math.min(a[0], b[0]) < o.x + o.w + 4 && Math.max(a[1], b[1]) > o.y - 4 && Math.min(a[1], b[1]) < o.y + o.h + 4;
    })).length;
    const len = (pts: [number, number][]) => pts.reduce((n, a, i) => (i ? n + Math.abs(a[0] - pts[i - 1][0]) + Math.abs(a[1] - pts[i - 1][1]) : 0), 0);
    const toD = (pts: [number, number][]) => `M${pts.map((q) => q.join(",")).join(" L")}`;
    let pts: [number, number][];
    const down = tTop >= pBot + 24; const up = !down && tBot <= pTop - 24;
    if (down || up) {
      const sy = down ? pBot : pTop; const ey = down ? tTop - 2 : tBot + 2; const dir = down ? 1 : -1;
      const f = 0.3 + (freeN++ % 5) * 0.1; const mid = sy + (ey - sy) * f;
      const lo = Math.min(sy, ey) + 8; const hi = Math.max(sy, ey) - 8;
      const ys = [mid, ...obs.flatMap((o) => [o.y - 12, o.y + o.h + 12])].filter((y) => y > lo && y < hi);
      const cands: [number, number][][] = ys.map((y) => [[sx, sy], [sx, y], [tx, y], [tx, ey]]);
      // Dando a volta por um corredor livre entre quadros (ou pela margem).
      if (Math.abs(ey - sy) > 48) {
        const yA = sy + dir * 14; const yB = ey - dir * 14;
        const xs = [MARGIN / 2, width - MARGIN / 2, ...all.flatMap((g) => [g.x - GAP_GROUP / 2, g.x + g.w + GAP_GROUP / 2])].filter((x) => x > 0 && x < width);
        xs.forEach((cx) => cands.push([[sx, sy], [sx, yA], [cx, yA], [cx, yB], [tx, yB], [tx, ey]]));
      }
      pts = cands.map((c) => ({ c, h: hits(c), l: len(c) })).sort((a, b) => a.h - b.h || a.l - b.l)[0].c;
    } else {
      const yb = Math.max(pBot, tBot) + 14 + lane("free");
      pts = [[sx, pBot], [sx, yb], [tx, yb], [tx, tBot + 2]];
    }
    arrows.push({ id, kind: "chefia", d: toD(pts), from: pid, to });
  };
  const handled = new Set<string>();
  // Um superior que comanda o quadro inteiro: uma seta só, até o quadro.
  for (const g of groups.values()) {
    const parents = new Set(g.cards.map((c) => byId.get(c.targetId)!.parentId));
    if (g.cards.length < 2 || parents.size !== 1) continue;
    const pid = [...parents][0];
    if (!pid || !byId.has(pid) || groupOf.get(pid) === g.key) continue;
    if (g.cards.some((c) => movedCards.has(c.targetId))) continue;
    const p = cardBox(pid);
    if (moved(pid) || movedGroups.has(g.key)) freeRoute(pid, null, g, `g-${g.key}`, g.cards.map((c) => c.targetId));
    else routeBundle(p.cx, p.g, g, [{ tx: g.x + g.w / 2, ids: g.cards.map((c) => c.targetId), id: `g-${g.key}` }], pid);
    g.cards.forEach((c) => handled.add(c.targetId));
  }
  // Subordinados do mesmo chefe no mesmo quadro saem numa "árvore" só.
  const bundles = new Map<string, { pid: string; tg: BoardGroup; kids: Kid[] }>();
  for (const t of targets) {
    if (!t.parentId || !byId.has(t.parentId) || handled.has(t.id) || sameBox(t.parentId, t.id)) continue;
    const c = cardBox(t.id);
    if (moved(t.parentId) || moved(t.id)) { freeRoute(t.parentId, t.id, c.g, `h-${t.id}`, [t.id]); continue; }
    const key = `${t.parentId}|${c.g.key}`;
    const b = bundles.get(key) || { pid: t.parentId, tg: c.g, kids: [] };
    b.kids.push({ tx: c.cx, ids: [t.id], id: `h-${t.id}` }); bundles.set(key, b);
  }
  for (const b of bundles.values()) { const p = cardBox(b.pid); routeBundle(p.cx, p.g, b.tg, b.kids, b.pid); }
  // Ligações dentro do quadro: faixas embaixo dos cartões.
  for (const g of groups.values()) {
    (inner.get(g.key) || []).forEach((v, i) => {
      const a = cardBox(v.a); const b = cardBox(v.b);
      const ly = g.y + g.lanesTop + 10 + i * LANE;
      const ax = a.cx - 8 + (i % 3) * 8; const bx = b.cx + 8 - (i % 3) * 8;
      const d = `M${ax},${a.y + CARD_H - 4} V${ly} H${bx} V${b.y + CARD_H - 2 + (v.kind === "chefia" ? 2 : 0)}`;
      arrows.push({ id: v.id, kind: v.kind, d, label: v.label, lx: (ax + bx) / 2, ly, from: v.a, to: [v.b], ends: v.kind === "chefia" ? [{ x: ax, y: a.y + CARD_H - 4 }] : [{ x: ax, y: a.y + CARD_H - 4 }, { x: bx, y: b.y + CARD_H - 4 }] });
    });
  }
  // Vínculos entre quadros: linha reta de foto a foto (encosta na borda da foto), rótulo no meio.
  const PH = { x: 18, y: 7, w: 76, h: 92 };
  /** Ponto onde a reta que sai do centro da foto em direção a (tx,ty) cruza a borda da foto. */
  const edge = (bx: number, by: number, tx: number, ty: number) => {
    const cx = bx + PH.x + PH.w / 2; const cy = by + PH.y + PH.h / 2;
    const dx = tx - cx; const dy = ty - cy;
    if (!dx && !dy) return { x: cx, y: cy };
    const k = Math.min(dx ? (PH.w / 2) / Math.abs(dx) : Infinity, dy ? (PH.h / 2) / Math.abs(dy) : Infinity);
    return { x: cx + dx * k, y: cy + dy * k };
  };
  const straight = (ida: string, idb: string, kind: "vinculo" | "auto", label: string, id: string) => {
    const a = cardBox(ida); const b = cardBox(idb);
    const ac = { x: a.x + PH.x + PH.w / 2, y: a.y + PH.y + PH.h / 2 }; const bc = { x: b.x + PH.x + PH.w / 2, y: b.y + PH.y + PH.h / 2 };
    const p1 = edge(a.x, a.y, bc.x, bc.y); const p2 = edge(b.x, b.y, ac.x, ac.y);
    // Se a reta passar por cima de outro alvo, vai por baixo dos quadros (não fica ambíguo).
    const others = all.flatMap((g) => g.cards.filter((c) => c.targetId !== ida && c.targetId !== idb).map((c) => ({ x: g.x + c.x, y: g.y + c.y })));
    const steps = Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 6);
    const blocked = others.some((o) => Array.from({ length: steps + 1 }, (_, i) => i / steps).some((t) => {
      const x = p1.x + (p2.x - p1.x) * t; const y = p1.y + (p2.y - p1.y) * t;
      return x > o.x + 6 && x < o.x + CARD_W - 6 && y > o.y && y < o.y + CARD_H - 10;
    }));
    if (blocked) {
      const bot = (id: string, k: { y: number; g: BoardGroup }) => (movedCards.has(id) ? k.y + CARD_H : k.g.y + k.g.h);
      const yL = Math.max(bot(ida, a), bot(idb, b)) + 12 + lane(`lk${rowOf(a.g)}`);
      const s1 = { x: ac.x, y: a.y + CARD_H - 4 }; const s2 = { x: bc.x, y: b.y + CARD_H - 4 };
      arrows.push({ id, kind, label, d: `M${s1.x},${s1.y} V${yL} H${s2.x} V${s2.y}`, lx: (s1.x + s2.x) / 2, ly: yL, from: ida, to: [idb], ends: [s1, s2] });
      return;
    }
    arrows.push({ id, kind, label, d: `M${p1.x},${p1.y} L${p2.x},${p2.y}`, lx: (p1.x + p2.x) / 2, ly: (p1.y + p2.y) / 2, from: ida, to: [idb], ends: [p1, p2] });
  };
  for (const l of links) if (byId.has(l.fromTarget) && byId.has(l.toTarget) && !sameBox(l.fromTarget, l.toTarget)) straight(l.fromTarget, l.toTarget, "vinculo", l.relation, `l-${l.id}`);
  autoLinks.forEach((l, i) => { if (byId.has(l.a) && byId.has(l.b) && !sameBox(l.a, l.b)) straight(l.a, l.b, "auto", l.label, `x-${i}`); });
  return { width, height, groups: [...groups.values()], arrows, groupOf, rows: rows.map((r) => ({ level: r.level, top: r.top, bottom: r.bottom })) };
}
