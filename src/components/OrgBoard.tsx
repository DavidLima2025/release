import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { ROLE_COLOR, type InvestigationLink, type InvestigationTarget, type OrgGroup } from "../lib/investigation";
import { CARD_H, CARD_W, buildBoard } from "../lib/orgBoard";

export type BoardPerson = { name: string; alias: string; photo?: string; role: string; area: string; evidence: number; bos: number };

type Props = {
  targets: InvestigationTarget[]; links: InvestigationLink[]; groups: OrgGroup[];
  people: Map<string, BoardPerson>;
  selectedId?: string;
  onSelect?: (t: InvestigationTarget) => void;
  onOpen?: (t: InvestigationTarget) => void;
  /** Soltar sobre um cartão: fica subordinado. Sobre um quadro: muda de núcleo. No vazio: topo. */
  onDropOnTarget?: (t: InvestigationTarget, parentId: string) => void;
  onDropOnGroup?: (t: InvestigationTarget, groupKey: string) => void;
  /** Versão para exportar (sem interação, fonte padrão). */
  exportMode?: boolean;
};

const FONT = "Helvetica, Arial, sans-serif";

function splitName(name: string, max = 16) {
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

export function OrgBoard({ targets, links, groups: custom, people, selectedId, onSelect, onOpen, onDropOnTarget, onDropOnGroup, exportMode }: Props) {
  const board = useMemo(() => buildBoard(targets, links, custom), [targets, links, custom]);
  const byId = new Map(targets.map((t) => [t.id, t]));
  const svgRef = useRef<SVGSVGElement>(null);
  const start = useRef<{ id: string; x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; over: string; overGroup: string } | null>(null);
  const interactive = !exportMode && Boolean(onDropOnTarget || onDropOnGroup);

  const toSvg = (e: RPointerEvent) => { const svg = svgRef.current!; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; return pt.matrixTransform(svg.getScreenCTM()!.inverse()); };
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
    const over = hitCard(p.x, p.y, descendants(s0.id));
    setDrag({ id: s0.id, dx, dy, over, overGroup: over ? "" : hitGroup(p.x, p.y) });
  };
  const up = (t: InvestigationTarget) => {
    const d = drag; start.current = null; setDrag(null);
    if (!d) { onSelect?.(t); return; }
    if (d.over) { if (d.over !== t.parentId) onDropOnTarget?.(t, d.over); return; }
    if (d.overGroup) { if (d.overGroup !== board.groupOf.get(t.id)) onDropOnGroup?.(t, d.overGroup); return; }
    if (t.parentId) onDropOnTarget?.(t, "");
  };

  if (!targets.length) return null;
  const W = board.width; const H = board.height;
  const dragName = (id: string) => people.get(id)?.name || "";
  const groupName = (key: string) => board.groups.find((g) => g.key === key)?.name || "";

  const svg = (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} fontFamily={exportMode ? FONT : undefined}
      className={exportMode ? undefined : "mx-auto block select-none"} role="img" aria-label="Organograma por núcleos">
      <defs>
        <marker id="seta-chefia" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#C0201A" /></marker>
        {board.groups.flatMap((g) => g.cards.map((c) => <clipPath key={c.targetId} id={`ph-${c.targetId}`}><rect x={g.x + c.x + 18} y={g.y + c.y + 8} width={72} height={88} rx={3} /></clipPath>))}
      </defs>
      <rect width={W} height={H} fill="#FFFFFF" />
      {/* Quadros dos núcleos */}
      {board.groups.map((g) => {
        const over = drag?.overGroup === g.key;
        const titleW = Math.min(g.w - 16, g.name.length * 8 + 20);
        return (
          <g key={g.key}>
            <rect x={g.x} y={g.y} width={g.w} height={g.h} fill={over ? "#FBF5E2" : "#FFFFFF"} stroke={over ? "#9B8A5C" : "#231F20"} strokeWidth={over ? 2.5 : 1.3} strokeDasharray={over ? "6 3" : undefined} />
            <rect x={g.x + 8} y={g.y + 7} width={titleW} height={18} fill="#F5D547" stroke="#231F20" strokeWidth={0.8} />
            <rect x={g.x + 8} y={g.y + 7} width={5} height={18} fill={g.color} />
            <text x={g.x + 17} y={g.y + 20} fontSize={11} fontWeight={800} fill="#0B0B0C">{g.name}{g.custom ? "" : ""}</text>
            {g.activities.length > 0 && (
              <g>
                <text x={g.x + PADX} y={g.h + g.y - 10 - g.activities.length * 13} fontSize={9.5} fontWeight={800} fill="#0B0B0C">ATIVIDADES:</text>
                {g.activities.map((a, i) => <text key={i} x={g.x + PADX} y={g.y + g.h - 8 - (g.activities.length - 1 - i) * 13} fontSize={9.5} fontWeight={700} fill="#B3261E">{`${i + 1}. ${a.toUpperCase()}`.slice(0, Math.floor((g.w - 20) / 5.6))}</text>)}
              </g>
            )}
          </g>
        );
      })}
      {/* Setas de chefia */}
      {board.arrows.filter((a) => a.kind === "chefia").map((a) => <path key={a.id} d={a.d} fill="none" stroke="#C0201A" strokeWidth={2.4} markerEnd="url(#seta-chefia)" />)}
      {/* Vínculos */}
      {board.arrows.filter((a) => a.kind === "vinculo").map((a) => <path key={a.id} d={a.d} fill="none" stroke="#2E6B3A" strokeWidth={1.8} strokeDasharray="6 4" />)}
      {/* Cartões */}
      {[...board.groups.flatMap((g) => g.cards.map((c) => ({ g, c })))].sort((a, b) => Number(a.c.targetId === drag?.id) - Number(b.c.targetId === drag?.id)).map(({ g, c }) => {
        const t = byId.get(c.targetId)!; const p = people.get(c.targetId);
        const color = ROLE_COLOR[t.role] || "#6B655A";
        const lines = splitName(p?.name || "?");
        const sel = selectedId === t.id; const over = drag?.over === t.id;
        const moving = drag?.id === c.targetId;
        return (
          <g key={c.targetId} data-target={t.id} transform={moving ? `translate(${drag!.dx},${drag!.dy})` : undefined}
            style={interactive ? { touchAction: "none", cursor: "grab", opacity: moving ? 0.85 : 1 } : undefined}
            onPointerDown={(e) => down(e, t.id)} onPointerMove={move} onPointerUp={() => up(t)} onPointerCancel={() => { start.current = null; setDrag(null); }}
            onClick={!interactive ? () => onSelect?.(t) : undefined} onDoubleClick={() => onOpen?.(t)}>
            {(() => { const bx = g.x + c.x; const by = g.y + c.y; return (
              <>
                {(sel || over) && <rect x={bx - 4} y={by - 4} width={CARD_W + 8} height={CARD_H + 8} rx={4} fill="none" stroke={over ? "#9B8A5C" : "#0B0B0C"} strokeWidth={over ? 3 : 2} strokeDasharray={over ? "6 3" : undefined} />}
                <rect x={bx} y={by} width={CARD_W} height={CARD_H} fill="transparent" />
                <rect x={bx + 17} y={by + 7} width={74} height={90} rx={3} fill="#EDE7D6" stroke={color} strokeWidth={2} />
                {p?.photo ? <image href={p.photo} x={bx + 18} y={by + 8} width={72} height={88} preserveAspectRatio="xMidYMid slice" clipPath={`url(#ph-${c.targetId})`} />
                  : <g fill="#B9B09A"><circle cx={bx + 54} cy={by + 38} r={14} /><path d={`M${bx + 30},${by + 92} q24,-40 48,0 z`} /></g>}
                <rect x={bx + 17} y={by + 85} width={74} height={12} fill={color} />
                <text x={bx + 54} y={by + 94} textAnchor="middle" fontSize={7.6} fontWeight={800} fill="#fff">{t.role.toUpperCase().slice(0, 16)}</text>
                {p && p.evidence > 0 && (<g><circle cx={bx + 91} cy={by + 9} r={8} fill="#9B8A5C" stroke="#fff" strokeWidth={1.2} /><text x={bx + 91} y={by + 12} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="#fff">{p.evidence}</text></g>)}
                {lines.map((l, i) => <text key={i} x={bx + CARD_W / 2} y={by + 108 + i * 10.5} textAnchor="middle" fontSize={8.6} fontWeight={800} fill="#0B0B0C">{l}</text>)}
                {(() => { let yy = by + 108 + lines.length * 10.5; const out = [];
                  if (p?.alias) { out.push(<text key="a" x={bx + CARD_W / 2} y={yy} textAnchor="middle" fontSize={8.2} fontStyle="italic" fill="#3A352C">{`vulgo ${p.alias}`.slice(0, 22)}</text>); yy += 10; }
                  if (p?.area) out.push(<text key="r" x={bx + CARD_W / 2} y={yy} textAnchor="middle" fontSize={7.6} fontWeight={700} fill="#2F5D7C">{`◉ ${p.area}`.slice(0, 24)}</text>);
                  return out; })()}
              </>
            ); })()}
          </g>
        );
      })}
      {/* Rótulos dos vínculos por cima */}
      {board.arrows.filter((a) => a.kind === "vinculo" && a.label).map((a) => {
        const w = a.label!.length * 6.2 + 14;
        return (
          <g key={`t${a.id}`}>
            <rect x={a.lx! - w / 2} y={a.ly! - 8} width={w} height={15} rx={2} fill="#E6F0E7" stroke="#2E6B3A" strokeWidth={0.8} />
            <text x={a.lx!} y={a.ly! + 3.5} textAnchor="middle" fontSize={9} fontWeight={800} fill="#1F4D29">{a.label!.toUpperCase()}</text>
          </g>
        );
      })}
    </svg>
  );
  if (exportMode) return svg;
  return (
    <div className="relative overflow-auto rounded-sm border border-pm-line bg-white">
      {svg}
      {drag && (
        <p className="sticky bottom-0 left-0 bg-pm-black/85 px-3 py-1.5 text-center text-xs font-semibold text-white">
          {drag.over ? <>Soltar: <b className="text-pm-gold-light">{dragName(drag.id)}</b> fica subordinado a <b className="text-pm-gold-light">{dragName(drag.over)}</b></>
            : drag.overGroup ? <>Soltar: mover para o núcleo <b className="text-pm-gold-light">{groupName(drag.overGroup)}</b></>
              : "Soltar no vazio: fica sem superior (topo)"}
        </p>
      )}
    </div>
  );
}
const PADX = 12;
