import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { ROLE_COLOR, emptyLayout, type InvestigationLink, type InvestigationTarget, type OrgGroup, type BoardLayout } from "../lib/investigation";
import { roleCatalogVersion } from "../lib/roles";
import { CARD_H, CARD_W, buildBoard, layoutWithCard, layoutWithGroup, snap, type AutoLink } from "../lib/orgBoard";

export type BoardPerson = {
  name: string; alias: string; photo?: string; role: string; area: string; evidence: number; bos: number;
  /** Sem card no banco de alvos. */
  unknown?: boolean;
  /** PRESO, SAIU, MORTO, FORAGIDO… */
  status?: string;
  /** Melhor confiança dos indícios da função: confirmado / provavel / a confirmar. */
  confidence?: string;
};

type Props = {
  targets: InvestigationTarget[]; links: InvestigationLink[]; groups: OrgGroup[]; autoLinks?: AutoLink[];
  people: Map<string, BoardPerson>;
  selectedId?: string;
  onSelect?: (t: InvestigationTarget) => void;
  onOpen?: (t: InvestigationTarget) => void;
  /** "superior": soltar sobre um cartão = fica subordinado. "vinculo": soltar sobre um cartão = cria vínculo. "mover": arrasta cartões e núcleos para onde quiser. */
  dragMode?: "superior" | "vinculo" | "mover";
  /** Posições arrastadas à mão (modo "mover"). */
  layout?: BoardLayout;
  onLayoutChange?: (next: BoardLayout, what: { kind: "card" | "group"; id: string }) => void;
  onDropOnTarget?: (t: InvestigationTarget, parentId: string) => void;
  onLinkDrop?: (from: InvestigationTarget, toId: string) => void;
  onDropOnGroup?: (t: InvestigationTarget, groupKey: string) => void;
  /** Versão para exportar (sem interação, fonte padrão). */
  exportMode?: boolean;
  /** Zoom na tela: número (1 = tamanho real) ou "fit" = ajusta à largura disponível (sem passar de 125%). */
  scale?: number | "fit";
};

const FONT = "Helvetica, Arial, sans-serif";
const NO_LAYOUT = emptyLayout();
const CONF_COLOR: Record<string, string> = { confirmado: "#2E6B3A", provavel: "#C28A12", "a confirmar": "#8C877C" };
const CONF_MARK: Record<string, string> = { confirmado: "✓", provavel: "~", "a confirmar": "?" };

function splitName(name: string, max = 17) {
  const words = name.toUpperCase().split(/\s+/).filter(Boolean);
  const lines: string[] = []; let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= max || !line) line = next; else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > 3) { lines.length = 3; lines[2] = `${lines[2].slice(0, max - 1)}…`; }
  return lines;
}

type Moving = { kind: "card" | "group"; id: string; g: string; x: number; y: number };

export function OrgBoard({ targets, links, groups: custom, autoLinks = [], people, selectedId, onSelect, onOpen, dragMode = "superior", layout, onLayoutChange, onDropOnTarget, onLinkDrop, onDropOnGroup, exportMode, scale }: Props) {
  const lay = layout || NO_LAYOUT;
  // Papéis criados/excluídos mudam cor, grau e núcleo: refaz o quadro.
  const catalog = roleCatalogVersion();
  const [mv, setMv] = useState<Moving | null>(null);
  const baseBoard = useMemo(() => buildBoard(targets, links, custom, autoLinks, lay), [targets, links, custom, autoLinks, lay, catalog]);
  // Durante o arraste o quadro é recalculado a cada movimento: as setas acompanham o cartão.
  const liveLayout = useMemo(() => (!mv ? lay : mv.kind === "card" ? layoutWithCard(lay, mv.id, mv.g, mv) : layoutWithGroup(lay, baseBoard, mv.id, mv)), [lay, mv, baseBoard]);
  const board = useMemo(() => (mv ? buildBoard(targets, links, custom, autoLinks, liveLayout) : baseBoard), [mv, baseBoard, liveLayout, targets, links, custom, autoLinks, catalog]);
  const byId = new Map(targets.map((t) => [t.id, t]));
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ id: string; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; over: string; overGroup: string } | null>(null);
  const interactive = !exportMode && Boolean(onDropOnTarget || onDropOnGroup || onLinkDrop || onLayoutChange);
  const moverOn = interactive && dragMode === "mover" && Boolean(onLayoutChange);

  const toXY = (cx: number, cy: number) => { const svg = svgRef.current!; const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy; return pt.matrixTransform(svg.getScreenCTM()!.inverse()); };
  const toSvg = (e: RPointerEvent) => toXY(e.clientX, e.clientY);

  // ---- Modo "mover": arrasta um cartão ou um núcleo inteiro e solta onde quiser ----
  const baseRef = useRef(baseBoard); baseRef.current = baseBoard;
  const layRef = useRef(lay); layRef.current = lay;
  const cbRef = useRef(onLayoutChange); cbRef.current = onLayoutChange;
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => () => stopRef.current?.(), []);
  const startMove = (e: RPointerEvent, kind: "card" | "group", id: string, g: string, ox: number, oy: number, click?: () => void) => {
    if (e.button !== 0 || !cbRef.current) return;
    const p0 = toXY(e.clientX, e.clientY);
    const m = { sx: p0.x, sy: p0.y, started: false, cx: e.clientX, cy: e.clientY, pos: { x: ox, y: oy } };
    const update = () => {
      const q = toXY(m.cx, m.cy); const dx = q.x - m.sx; const dy = q.y - m.sy;
      if (!m.started && Math.hypot(dx, dy) < 6) return;
      m.started = true; m.pos = { x: snap(ox + dx), y: snap(oy + dy) };
      setMv({ kind, id, g, ...m.pos });
    };
    const onMove = (ev: PointerEvent) => { m.cx = ev.clientX; m.cy = ev.clientY; update(); };
    // Perto da borda, rola a tela sozinho para dar para levar o cartão mais longe.
    const timer = window.setInterval(() => {
      const box = wrapRef.current; if (!box || !m.started) return;
      const r = box.getBoundingClientRect(); const E = 36; const STEP = 18;
      const left = Math.max(r.left, 0); const right = Math.min(r.right, window.innerWidth); const top = Math.max(r.top, 0); const bottom = Math.min(r.bottom, window.innerHeight);
      const sx = m.cx > right - E ? STEP : m.cx < left + E ? -STEP : 0; const sy = m.cy > bottom - E ? STEP : m.cy < top + E ? -STEP : 0;
      if (!sx && !sy) return;
      box.scrollLeft += sx;
      if (box.scrollHeight > box.clientHeight + 1) box.scrollTop += sy; else window.scrollBy(0, sy);
      update();
    }, 40);
    const stop = () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("pointercancel", onCancel); window.clearInterval(timer); stopRef.current = null; };
    const onCancel = () => { stop(); setMv(null); };
    const onUp = () => {
      stop(); setMv(null);
      if (!m.started) { click?.(); return; }
      if (m.pos.x === ox && m.pos.y === oy) return;
      const next = kind === "card" ? layoutWithCard(layRef.current, id, g, m.pos) : layoutWithGroup(layRef.current, baseRef.current, id, m.pos);
      cbRef.current?.(next, { kind, id });
    };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", onUp); window.addEventListener("pointercancel", onCancel);
    stopRef.current = stop;
  };
  const descendants = (id: string) => { const out = new Set([id]); let grew = true; while (grew) { grew = false; for (const t of targets) if (t.parentId && out.has(t.parentId) && !out.has(t.id)) { out.add(t.id); grew = true; } } return out; };
  const hitCard = (x: number, y: number, skip: Set<string>) => {
    for (const g of board.groups) for (const c of g.cards) {
      if (skip.has(c.targetId)) continue;
      if (x >= g.x + c.x && x <= g.x + c.x + CARD_W && y >= g.y + c.y && y <= g.y + c.y + CARD_H) return c.targetId;
    }
    return "";
  };
  const hitGroup = (x: number, y: number) => board.groups.find((g) => x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h)?.key || "";
  const down = (e: RPointerEvent, id: string) => {
    if (e.button !== 0 || !interactive) return;
    const p = toSvg(e); start.current = { id, x: p.x, y: p.y };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const move = (e: RPointerEvent) => {
    const s0 = start.current; if (!s0) return;
    const p = toSvg(e); const dx = p.x - s0.x; const dy = p.y - s0.y;
    if (!drag && Math.hypot(dx, dy) < 8) return;
    const over = hitCard(p.x, p.y, dragMode === "vinculo" ? new Set([s0.id]) : descendants(s0.id));
    setDrag({ id: s0.id, dx, dy, over, overGroup: over || dragMode === "vinculo" ? "" : hitGroup(p.x, p.y) });
  };
  const up = (t: InvestigationTarget) => {
    const d = drag; start.current = null; setDrag(null);
    if (!d) { onSelect?.(t); return; }
    if (dragMode === "vinculo") { if (d.over) onLinkDrop?.(t, d.over); return; }
    if (d.over) { if (d.over !== t.parentId) onDropOnTarget?.(t, d.over); return; }
    if (d.overGroup) { if (d.overGroup !== board.groupOf.get(t.id)) onDropOnGroup?.(t, d.overGroup); return; }
    if (t.parentId) onDropOnTarget?.(t, "");
  };

  // Cadeia de comando do selecionado: chefes acima e todos abaixo dele ficam em destaque.
  const chain = (() => {
    if (!selectedId || !byId.has(selectedId) || exportMode) return null;
    const set = new Set(descendants(selectedId));
    let cur = byId.get(selectedId); const seen = new Set<string>();
    while (cur?.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) { seen.add(cur.id); set.add(cur.parentId); cur = byId.get(cur.parentId); }
    return set;
  })();
  const arrowOn = (a: (typeof board.arrows)[number]) => !chain || (a.kind === "chefia" ? Boolean(a.from && chain.has(a.from) && a.to?.some((x) => chain.has(x))) : Boolean((a.from === selectedId) || a.to?.includes(selectedId!)));
  const chiefOf = (t: InvestigationTarget) => { const p = t.parentId && byId.has(t.parentId) ? people.get(t.parentId) : undefined; return p ? (p.alias || p.name.split(" ")[0]).toUpperCase() : ""; };

  if (!targets.length) return null;
  const W = board.width; const H = board.height;
  const dragName = (id: string) => people.get(id)?.name || "";
  const groupName = (key: string) => board.groups.find((g) => g.key === key)?.name || "";
  const lineColor = { chefia: "#C0201A", vinculo: "#2E6B3A", auto: "#1F6FB2" } as const;

  const svg = (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${H}`} fontFamily={exportMode ? FONT : undefined}
      {...(exportMode || !scale ? { width: W, height: H } : scale === "fit" ? { width: W, height: H, style: { width: "100%", height: "auto", maxWidth: W * 1.25 } } : { width: W * scale, height: H * scale })}
      className={exportMode ? undefined : "mx-auto block select-none"} role="img" aria-label="Organograma por núcleos">
      <defs>
        <marker id="seta-chefia" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.2" markerHeight="6.2" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#C0201A" /></marker>
        {board.groups.flatMap((g) => g.cards.map((c) => <clipPath key={c.targetId} id={`ph-${c.targetId}`}><rect x={g.x + c.x + 19} y={g.y + c.y + 8} width={74} height={90} rx={3} /></clipPath>))}
      </defs>
      <rect width={W} height={H} fill="#FFFFFF" />
      {/* Quadros dos núcleos */}
      {board.groups.map((g) => {
        const over = drag?.overGroup === g.key;
        const titleW = Math.min(g.w - 16, g.name.length * 8 + 22);
        return (
          <g key={g.key} onPointerDown={moverOn ? (e) => startMove(e, "group", g.key, "", g.x, g.y) : undefined} style={moverOn ? { cursor: "move", touchAction: "none" } : undefined}>
            <rect x={g.x} y={g.y} width={g.w} height={g.h} fill={over ? "#FBF5E2" : "#FFFFFF"} stroke={over || (mv?.kind === "group" && mv.id === g.key) ? "#9B8A5C" : "#231F20"} strokeWidth={over || (mv?.kind === "group" && mv.id === g.key) ? 2.5 : 1.3} strokeDasharray={over || (mv?.kind === "group" && mv.id === g.key) ? "6 3" : undefined} />
            <rect x={g.x + 8} y={g.y + 7} width={titleW} height={18} fill="#F5D547" stroke="#231F20" strokeWidth={0.8} />
            <rect x={g.x + 8} y={g.y + 7} width={5} height={18} fill={g.color} />
            <text x={g.x + 17} y={g.y + 20} fontSize={11} fontWeight={800} fill="#0B0B0C">{g.name}</text>
            {g.activities.length > 0 && (
              <g>
                <text x={g.x + 12} y={g.y + g.actTop + 14} fontSize={9.5} fontWeight={800} fill="#0B0B0C">ATIVIDADES:</text>
                {g.activities.map((a, i) => <text key={i} x={g.x + 12} y={g.y + g.actTop + 28 + i * 12.5} fontSize={9.5} fontWeight={700} fill="#B3261E">{a}</text>)}
              </g>
            )}
          </g>
        );
      })}
      {/* Linhas: comando (vermelho, com seta), vínculo (verde) e detectado (azul) */}
      {/* Com um alvo selecionado, o caminho dele é desenhado por último (fica por cima das linhas apagadas). */}
      {(chain ? [...board.arrows].sort((a, b) => Number(arrowOn(a)) - Number(arrowOn(b))) : board.arrows).map((a) => (
        <path key={a.id} d={a.d} fill="none" pointerEvents="none" stroke={lineColor[a.kind]} strokeWidth={(a.kind === "chefia" ? 2.1 : 1.8) * (chain && arrowOn(a) ? 1.5 : 1)} opacity={arrowOn(a) ? 1 : 0.12}
          strokeLinecap={a.kind === "chefia" ? "square" : undefined} strokeLinejoin="round"
          strokeDasharray={a.kind === "vinculo" ? "6 4" : a.kind === "auto" ? "2 3" : undefined} markerEnd={a.kind === "chefia" && a.head !== false ? "url(#seta-chefia)" : undefined} />
      ))}
      {/* Cartões */}
      {board.groups.flatMap((g) => g.cards.map((c) => ({ g, c }))).sort((a, b) => Number(a.c.targetId === (drag?.id ?? mv?.id)) - Number(b.c.targetId === (drag?.id ?? mv?.id))).map(({ g, c }) => {
        const t = byId.get(c.targetId)!; const p = people.get(c.targetId);
        const color = ROLE_COLOR[t.role] || "#6B655A";
        const lines = splitName(p?.name || "?");
        const sel = selectedId === t.id; const over = drag?.over === t.id;
        const moving = drag?.id === c.targetId; const placing = mv?.kind === "card" && mv.id === c.targetId;
        const bx = g.x + c.x; const by = g.y + c.y;
        const roleTxt = t.role.toUpperCase();
        let yy = by + 112 + lines.length * 10.5;
        return (
          <g key={c.targetId} data-target={t.id} transform={moving ? `translate(${drag!.dx},${drag!.dy})` : undefined}
            style={interactive ? { touchAction: "none", cursor: moverOn ? "move" : "grab", opacity: moving ? 0.85 : chain && !chain.has(t.id) ? 0.3 : 1 } : undefined}
            onPointerDown={(e) => (moverOn ? startMove(e, "card", t.id, g.key, bx, by, () => onSelect?.(t)) : dragMode === "mover" ? undefined : down(e, t.id))}
            onPointerMove={move} onPointerUp={interactive && dragMode !== "mover" ? () => up(t) : undefined} onPointerCancel={() => { start.current = null; setDrag(null); }}
            onClick={!interactive ? () => onSelect?.(t) : undefined} onDoubleClick={() => onOpen?.(t)}>
            {placing && <rect x={bx - 4} y={by - 4} width={CARD_W + 8} height={CARD_H + 8} rx={4} fill="none" stroke="#2F5D7C" strokeWidth={2.5} strokeDasharray="6 3" />}
            {(sel || over) && <rect x={bx - 4} y={by - 4} width={CARD_W + 8} height={CARD_H + 8} rx={4} fill="none" stroke={over ? (dragMode === "vinculo" ? "#2E6B3A" : "#9B8A5C") : "#0B0B0C"} strokeWidth={over ? 3 : 2} strokeDasharray={over ? "6 3" : undefined} />}
            <rect x={bx} y={by} width={CARD_W} height={CARD_H} fill="#FFFFFF" fillOpacity={0.01} />
            <rect x={bx + 18} y={by + 7} width={76} height={92} rx={3} fill="#EDE7D6" stroke={color} strokeWidth={2} strokeDasharray={p?.unknown ? "4 3" : undefined} />
            {p?.photo ? <image href={p.photo} x={bx + 19} y={by + 8} width={74} height={90} preserveAspectRatio="xMidYMid slice" clipPath={`url(#ph-${c.targetId})`} />
              : p?.unknown ? <text x={bx + 56} y={by + 66} textAnchor="middle" fontSize={44} fontWeight={800} fill="#B9B09A">?</text>
                : <g fill="#B9B09A"><circle cx={bx + 56} cy={by + 38} r={14} /><path d={`M${bx + 32},${by + 94} q24,-40 48,0 z`} /></g>}
            {p?.status && (
              <g>
                <rect x={bx + 18} y={by + 40} width={76} height={15} fill="#0B0B0C" fillOpacity={0.82} />
                <text x={bx + 56} y={by + 51} textAnchor="middle" fontSize={9} fontWeight={800} fill="#F5D547">{p.status}</text>
              </g>
            )}
            <rect x={bx + 18} y={by + 87} width={76} height={12} fill={color} />
            <text x={bx + 56} y={by + 96} textAnchor="middle" fontSize={roleTxt.length > 12 ? 6.4 : 7.6} fontWeight={800} fill="#fff">{roleTxt}</text>
            {p && p.evidence > 0 && (
              <g>
                <circle cx={bx + 94} cy={by + 9} r={8.5} fill={CONF_COLOR[p.confidence || "provavel"] || "#9B8A5C"} stroke="#fff" strokeWidth={1.2} />
                <text x={bx + 94} y={by + 12} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="#fff">{p.evidence > 1 ? p.evidence : CONF_MARK[p.confidence || "provavel"]}</text>
              </g>
            )}
            {lines.map((l, i) => <text key={i} x={bx + CARD_W / 2} y={by + 112 + i * 10.5} textAnchor="middle" fontSize={8.8} fontWeight={800} fill="#0B0B0C">{l}</text>)}
            {p?.alias && (() => { const el = <text key="a" x={bx + CARD_W / 2} y={yy} textAnchor="middle" fontSize={8.2} fontStyle="italic" fill="#3A352C">{`vulgo ${p.alias}`.slice(0, 24)}</text>; yy += 10; return el; })()}
            {p?.area && (() => { const el = <text key="r" x={bx + CARD_W / 2} y={yy} textAnchor="middle" fontSize={7.8} fontWeight={700} fill="#2F5D7C">{`◉ ${p.area}`.slice(0, 26)}</text>; yy += 10; return el; })()}
            {chiefOf(t) && <text x={bx + CARD_W / 2} y={yy} textAnchor="middle" fontSize={7.6} fontWeight={800} fill="#C0201A">{`▲ chefe: ${chiefOf(t)}`.slice(0, 24)}</text>}
          </g>
        );
      })}
      {/* Pontos onde a linha encosta no alvo */}
      {board.arrows.filter((a) => a.ends).flatMap((a) => a.ends!.map((e, i) => (
        <circle key={`${a.id}e${i}`} pointerEvents="none" cx={e.x} cy={e.y} r={3.2} fill={lineColor[a.kind]} stroke="#fff" strokeWidth={1} opacity={arrowOn(a) ? 1 : 0.12} />
      )))}
      {/* Rótulos dos vínculos por cima */}
      {board.arrows.filter((a) => a.kind !== "chefia" && a.label).map((a) => {
        const w = a.label!.length * 6.2 + 14;
        const auto = a.kind === "auto";
        return (
          <g key={`t${a.id}`} pointerEvents="none" opacity={arrowOn(a) ? 1 : 0.15}>
            <rect x={a.lx! - w / 2} y={a.ly! - 8} width={w} height={15} rx={2} fill={auto ? "#E3EEF8" : "#E6F0E7"} stroke={auto ? "#1F6FB2" : "#2E6B3A"} strokeWidth={0.8} />
            <text x={a.lx!} y={a.ly! + 3.5} textAnchor="middle" fontSize={9} fontWeight={800} fill={auto ? "#164E7F" : "#1F4D29"}>{a.label!.toUpperCase()}</text>
          </g>
        );
      })}
    </svg>
  );
  if (exportMode) return svg;
  return (
    <div ref={wrapRef} className="relative overflow-auto rounded-sm border border-pm-line bg-white">
      {svg}
      {mv && (
        <p className="sticky bottom-0 left-0 bg-pm-black/85 px-3 py-1.5 text-center text-xs font-semibold text-white">
          {mv.kind === "card" ? <>Solte para fixar <b className="text-pm-gold-light">{dragName(mv.id)}</b> aqui</> : <>Solte para fixar o núcleo <b className="text-pm-gold-light">{groupName(mv.id)}</b> aqui</>}
        </p>
      )}
      {drag && (
        <p className="sticky bottom-0 left-0 bg-pm-black/85 px-3 py-1.5 text-center text-xs font-semibold text-white">
          {dragMode === "vinculo"
            ? drag.over ? <>Soltar: criar vínculo entre <b className="text-pm-gold-light">{dragName(drag.id)}</b> e <b className="text-pm-gold-light">{dragName(drag.over)}</b></> : "Solte sobre outro alvo para criar o vínculo"
            : drag.over ? <>Soltar: <b className="text-pm-gold-light">{dragName(drag.id)}</b> fica subordinado a <b className="text-pm-gold-light">{dragName(drag.over)}</b></>
              : drag.overGroup ? <>Soltar: mover para o núcleo <b className="text-pm-gold-light">{groupName(drag.overGroup)}</b></>
                : "Soltar no vazio: fica sem superior"}
        </p>
      )}
    </div>
  );
}
