import type { Author, AuthorFile } from "./domain";
import type { InvestigationItem, InvestigationLink, InvestigationTarget } from "./investigation";
import { indexReds } from "./companions";

/** Rede de vínculos entre alvos: BOs em comum e vínculos registrados nas investigações. */

export type NetEdge = { id: string; a: string; b: string; reds: string[]; arrested: boolean; relations: string[] };
export type NetNode = { id: string; author: Author; degree: number; bos: number; x: number; y: number; group: number; betweenness: number };
export type Network = { nodes: NetNode[]; edges: NetEdge[]; groups: string[][] };

const ARREST = /PRES|CONDUZ|AUTUAD|FLAGRANTE/i;
const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function buildEdges(authors: Author[], reports: AuthorFile[], items: InvestigationItem[], targets: InvestigationTarget[], links: InvestigationLink[]) {
  const { byReds } = indexReds(authors, reports, items);
  const edges = new Map<string, NetEdge>();
  const bos = new Map<string, number>();
  const get = (a: string, b: string) => {
    const k = key(a, b);
    const e = edges.get(k) || { id: k, a: k.split("|")[0], b: k.split("|")[1], reds: [], arrested: false, relations: [] };
    edges.set(k, e);
    return e;
  };
  for (const [reds, people] of byReds) {
    const ids = [...people.keys()];
    ids.forEach((id) => bos.set(id, (bos.get(id) || 0) + 1));
    for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) {
      const e = get(ids[i], ids[j]);
      if (!e.reds.includes(reds)) e.reds.push(reds);
      if (ARREST.test(people.get(ids[i]) || "") && ARREST.test(people.get(ids[j]) || "")) e.arrested = true;
    }
  }
  const targetAuthor = new Map(targets.map((t) => [t.id, t.authorId]));
  for (const l of links) {
    const a = targetAuthor.get(l.fromTarget); const b = targetAuthor.get(l.toTarget);
    if (!a || !b || a === b) continue;
    const e = get(a, b);
    if (!e.relations.includes(l.relation)) e.relations.push(l.relation);
  }
  return { edges: [...edges.values()], bos };
}

/** Componentes conexos (grupos que agem juntos). */
function components(ids: string[], adj: Map<string, Set<string>>) {
  const seen = new Set<string>();
  const groups: string[][] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const stack = [id]; const g: string[] = [];
    seen.add(id);
    while (stack.length) {
      const v = stack.pop()!; g.push(v);
      for (const w of adj.get(v) || []) if (!seen.has(w)) { seen.add(w); stack.push(w); }
    }
    groups.push(g);
  }
  return groups.sort((a, b) => b.length - a.length);
}

/** Intermediação (Brandes): quem liga grupos — o "elo". */
function betweenness(ids: string[], adj: Map<string, Set<string>>) {
  const cb = new Map(ids.map((v) => [v, 0]));
  for (const s of ids) {
    const stack: string[] = []; const pred = new Map<string, string[]>(ids.map((v) => [v, []]));
    const sigma = new Map(ids.map((v) => [v, 0])); const dist = new Map(ids.map((v) => [v, -1]));
    sigma.set(s, 1); dist.set(s, 0);
    const queue = [s];
    while (queue.length) {
      const v = queue.shift()!; stack.push(v);
      for (const w of adj.get(v) || []) {
        if (dist.get(w)! < 0) { queue.push(w); dist.set(w, dist.get(v)! + 1); }
        if (dist.get(w) === dist.get(v)! + 1) { sigma.set(w, sigma.get(w)! + sigma.get(v)!); pred.get(w)!.push(v); }
      }
    }
    const delta = new Map(ids.map((v) => [v, 0]));
    while (stack.length) {
      const w = stack.pop()!;
      for (const v of pred.get(w)!) delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
      if (w !== s) cb.set(w, cb.get(w)! + delta.get(w)!);
    }
  }
  return cb;
}

/** Desenho por forças (Fruchterman–Reingold) de cada grupo, e os grupos arrumados lado a lado. */
function layoutGroup(ids: string[], edges: NetEdge[]) {
  const n = ids.length;
  const pos = new Map<string, { x: number; y: number }>();
  if (n === 1) { pos.set(ids[0], { x: 0, y: 0 }); return { pos, size: 60 }; }
  const area = Math.max(1, n) * 32000;
  const k = Math.sqrt(area / n);
  ids.forEach((id, i) => pos.set(id, { x: Math.cos((2 * Math.PI * i) / n) * k * 0.8 * Math.sqrt(n), y: Math.sin((2 * Math.PI * i) / n) * k * 0.8 * Math.sqrt(n) }));
  const local = edges.filter((e) => pos.has(e.a) && pos.has(e.b));
  let t = k * 2;
  const iters = n > 120 ? 120 : 260;
  for (let it = 0; it < iters; it += 1) {
    const disp = new Map(ids.map((id) => [id, { x: 0, y: 0 }]));
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
      const a = pos.get(ids[i])!; const b = pos.get(ids[j])!;
      let dx = a.x - b.x; let dy = a.y - b.y;
      let d = Math.hypot(dx, dy);
      if (d < 0.01) { dx = Math.random(); dy = Math.random(); d = 1; }
      const f = (k * k) / d;
      const da = disp.get(ids[i])!; const db = disp.get(ids[j])!;
      da.x += (dx / d) * f; da.y += (dy / d) * f; db.x -= (dx / d) * f; db.y -= (dy / d) * f;
    }
    for (const e of local) {
      const a = pos.get(e.a)!; const b = pos.get(e.b)!;
      const dx = a.x - b.x; const dy = a.y - b.y; const d = Math.max(0.01, Math.hypot(dx, dy));
      const w = 1 + Math.min(4, e.reds.length) * 0.4;
      const f = ((d * d) / k) * w;
      const da = disp.get(e.a)!; const db = disp.get(e.b)!;
      da.x -= (dx / d) * f; da.y -= (dy / d) * f; db.x += (dx / d) * f; db.y += (dy / d) * f;
    }
    for (const id of ids) {
      const p = pos.get(id)!; const d = disp.get(id)!;
      const len = Math.max(0.01, Math.hypot(d.x, d.y));
      p.x += (d.x / len) * Math.min(len, t) - p.x * 0.01;
      p.y += (d.y / len) * Math.min(len, t) - p.y * 0.01;
    }
    t *= 0.97;
  }
  const xs = ids.map((id) => pos.get(id)!.x); const ys = ids.map((id) => pos.get(id)!.y);
  const minX = Math.min(...xs); const minY = Math.min(...ys);
  ids.forEach((id) => { const p = pos.get(id)!; p.x -= minX; p.y -= minY; });
  return { pos, size: Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) + 140 };
}

export function buildNetwork(authors: Author[], edges: NetEdge[], bos: Map<string, number>): Network {
  const byId = new Map(authors.map((a) => [a.id, a]));
  const usable = edges.filter((e) => byId.has(e.a) && byId.has(e.b));
  const adj = new Map<string, Set<string>>();
  for (const e of usable) {
    (adj.get(e.a) || adj.set(e.a, new Set()).get(e.a)!).add(e.b);
    (adj.get(e.b) || adj.set(e.b, new Set()).get(e.b)!).add(e.a);
  }
  const ids = [...adj.keys()];
  const groups = components(ids, adj);
  const bc = betweenness(ids, adj);
  const nodes: NetNode[] = [];
  // Arruma os grupos em faixas (os maiores primeiro).
  let x = 0; let y = 0; let rowH = 0; const maxW = 1800;
  groups.forEach((g, gi) => {
    const { pos, size } = layoutGroup(g, usable);
    if (x > 0 && x + size > maxW) { x = 0; y += rowH + 60; rowH = 0; }
    for (const id of g) {
      const p = pos.get(id)!;
      nodes.push({ id, author: byId.get(id)!, degree: adj.get(id)!.size, bos: bos.get(id) || 0, x: x + p.x + 45, y: y + p.y + 45, group: gi, betweenness: bc.get(id) || 0 });
    }
    x += size + 60; rowH = Math.max(rowH, size);
  });
  return { nodes, edges: usable, groups };
}
