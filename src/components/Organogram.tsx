import { useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { InvestigationLink, InvestigationTarget, ROLE_COLOR, layoutOrganogram } from "../lib/investigation";
import type { Author, AuthorFile } from "../lib/domain";

type Props = {
  targets: InvestigationTarget[];
  links: InvestigationLink[];
  authors: Author[];
  photos: AuthorFile[];
  photoUrl: (path: string) => string;
  selectedId?: string;
  onSelect?: (target: InvestigationTarget) => void;
  /** Arrastar um alvo sobre outro define o superior; soltar no vazio leva ao topo. */
  onReparent?: (target: InvestigationTarget, parentId: string) => void;
  /** Clique duplo abre a ficha. */
  onOpen?: (target: InvestigationTarget) => void;
};

const BOX_W = 168;
const BOX_H = 64;
const GAP_X = 22;
const GAP_Y = 46;
const PAD = 16;

export function Organogram({ targets, links, authors, photos, photoUrl, selectedId, onSelect, onReparent, onOpen }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const start = useRef<{ id: string; x: number; y: number; pointer: number } | null>(null);
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; over: string } | null>(null);
  const layout = useMemo(() => layoutOrganogram(targets), [targets]);
  const width = layout.width * (BOX_W + GAP_X) - GAP_X + PAD * 2;
  const height = layout.depth * (BOX_H + GAP_Y) - GAP_Y + PAD * 2;
  const pos = new Map(layout.nodes.map((n) => [n.id, { cx: PAD + n.x * (BOX_W + GAP_X) + BOX_W / 2, ty: PAD + n.y * (BOX_H + GAP_Y) }]));
  const byId = new Map(targets.map((t) => [t.id, t]));

  const toSvg = (e: RPointerEvent) => {
    const svg = svgRef.current!; const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM()!.inverse());
  };
  const descendants = (id: string) => {
    const out = new Set<string>([id]); let grew = true;
    while (grew) { grew = false; for (const t of targets) if (t.parentId && out.has(t.parentId) && !out.has(t.id)) { out.add(t.id); grew = true; } }
    return out;
  };
  const hit = (x: number, y: number, skip: Set<string>) => layout.nodes.find((n) => {
    if (skip.has(n.id)) return false; const p = pos.get(n.id)!;
    return x >= p.cx - BOX_W / 2 && x <= p.cx + BOX_W / 2 && y >= p.ty && y <= p.ty + BOX_H;
  })?.id || "";
  const down = (e: RPointerEvent, id: string) => {
    if (e.button !== 0) return;
    const p = toSvg(e); start.current = { id, x: p.x, y: p.y, pointer: e.pointerId };
    if (onReparent) (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const move = (e: RPointerEvent) => {
    const s0 = start.current; if (!s0 || !onReparent) return;
    const p = toSvg(e); const dx = p.x - s0.x; const dy = p.y - s0.y;
    if (!drag && Math.hypot(dx, dy) < 8) return;
    setDrag({ id: s0.id, dx, dy, over: hit(p.x, p.y, descendants(s0.id)) });
  };
  const up = (target: InvestigationTarget) => {
    const d = drag; start.current = null; setDrag(null);
    if (!d) { onSelect?.(target); return; }
    const newParent = d.over;
    if (newParent !== (target.parentId || "")) onReparent?.(target, newParent);
  };

  if (!targets.length) return null;
  return (
    <div className="overflow-auto rounded-sm border border-pm-line bg-[radial-gradient(circle,#d8d0ba_1px,transparent_1px)] [background-size:18px_18px]">
      <svg ref={svgRef} width={Math.max(width, 320)} height={height} viewBox={`0 0 ${Math.max(width, 320)} ${height}`} className="mx-auto block select-none" role="img" aria-label="Organograma dos alvos">
        <defs>
          {authors.length > 0 && layout.nodes.map((n) => <clipPath key={n.id} id={`clip-${n.id}`}><rect x={0} y={0} width={44} height={52} rx={2} /></clipPath>)}
        </defs>
        {layout.nodes.filter((n) => n.parentId).map((n) => {
          const a = pos.get(n.parentId)!;
          const b = pos.get(n.id)!;
          const mid = a.ty + BOX_H + GAP_Y / 2;
          return <path key={`h-${n.id}`} d={`M${a.cx},${a.ty + BOX_H} V${mid} H${b.cx} V${b.ty}`} fill="none" stroke="#231F20" strokeWidth={1.4} />;
        })}
        {links.map((l) => {
          const a = pos.get(l.fromTarget);
          const b = pos.get(l.toTarget);
          if (!a || !b) return null;
          const ay = a.ty + BOX_H / 2;
          const by = b.ty + BOX_H / 2;
          const mx = (a.cx + b.cx) / 2;
          const my = (ay + by) / 2 - (a.ty === b.ty ? 26 : 0);
          return (
            <g key={l.id}>
              <path d={`M${a.cx},${ay} Q${mx},${my - (a.ty === b.ty ? 20 : 0)} ${b.cx},${by}`} fill="none" stroke="#9B8A5C" strokeWidth={1.6} strokeDasharray="5 4" />
              <rect x={mx - l.relation.length * 3.3 - 6} y={my - 9} width={l.relation.length * 6.6 + 12} height={17} rx={2} fill="#F3F0E7" stroke="#9B8A5C" strokeWidth={0.8} />
              <text x={mx} y={my + 3.5} textAnchor="middle" fontSize={10.5} fontStyle="italic" fill="#231F20">{l.relation}</text>
            </g>
          );
        })}
        {[...layout.nodes].sort((a, b) => Number(a.id === drag?.id) - Number(b.id === drag?.id)).map((n) => {
          const target = byId.get(n.id)!;
          const author = authors.find((a) => a.id === target.authorId);
          const photo = photos.find((p) => p.authorId === target.authorId);
          const p = pos.get(n.id)!;
          const color = ROLE_COLOR[target.role] || "#6B655A";
          const x = p.cx - BOX_W / 2;
          const selected = selectedId === target.id;
          const dragging = drag?.id === target.id;
          const isOver = Boolean(drag && drag.over === target.id);
          const name = author?.name || target.label || "NÃO IDENTIFICADO";
          const textX = photo ? 56 : 10;
          const maxChars = photo ? 17 : 22;
          const line1 = name.length > maxChars ? name.slice(0, name.lastIndexOf(" ", maxChars) > 4 ? name.lastIndexOf(" ", maxChars) : maxChars) : name;
          const rest = name.slice(line1.length).trim();
          const line2 = rest.length > maxChars ? `${rest.slice(0, maxChars - 1)}…` : rest;
          return (
            <g key={n.id} transform={`translate(${x + (dragging ? drag!.dx : 0)},${p.ty + (dragging ? drag!.dy : 0)})`}
              className={onReparent ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} style={{ touchAction: onReparent ? "none" : undefined, opacity: dragging ? 0.85 : 1 }}
              data-target={target.id}
              onPointerDown={(e) => down(e, target.id)} onPointerMove={move} onPointerUp={() => up(target)} onPointerCancel={() => { start.current = null; setDrag(null); }}
              onDoubleClick={() => onOpen?.(target)}>
              {isOver && <rect x={-5} y={-5} width={BOX_W + 10} height={BOX_H + 10} rx={5} fill="none" stroke="#9B8A5C" strokeWidth={3} strokeDasharray="6 3" />}
              <rect width={BOX_W} height={BOX_H} rx={3} fill="#fff" stroke={selected ? "#0B0B0C" : color} strokeWidth={selected ? 2.5 : 1.5} />
              <rect width={BOX_W} height={5} fill={color} />
              {photo && (
                <g transform="translate(6,9)">
                  <image href={photoUrl(photo.filePath)} width={44} height={52} preserveAspectRatio="xMidYMid slice" clipPath={`url(#clip-${n.id})`} />
                </g>
              )}
              <text x={textX} y={23} fontSize={11.5} fontWeight={800} fill="#0B0B0C">{line1}</text>
              {line2 && <text x={textX} y={37} fontSize={11.5} fontWeight={800} fill="#0B0B0C">{line2}</text>}
              <text x={textX} y={line2 ? 54 : 44} fontSize={10} fill="#6B655A">{[author?.alias ? `"${author.alias}"` : "", target.role].filter(Boolean).join(" · ")}</text>
            </g>
          );
        })}
      </svg>
      {drag && (
        <p className="sticky bottom-0 left-0 bg-pm-black/85 px-3 py-1.5 text-center text-xs font-semibold text-white">
          {drag.over ? <>Soltar: fica subordinado a <b className="text-pm-gold-light">{authors.find((a) => a.id === byId.get(drag.over)?.authorId)?.name}</b></> : "Soltar no vazio: vai para o topo (sem superior)"}
        </p>
      )}
    </div>
  );
}

type LinkChartProps = {
  targets: InvestigationTarget[];
  items: { id: string; kind: string; title: string; reference: string; itemDate: string; authorIds: string[] }[];
  authors: Author[];
  onOpenItem?: (id: string) => void;
};

/** Alvos (em cima) ligados às ocorrências/fontes em que aparecem (embaixo). */
export function LinkChart({ targets, items, authors }: LinkChartProps) {
  const people = targets.map((t) => ({ t, a: authors.find((x) => x.id === t.authorId) })).filter((x) => x.a);
  const ids = new Set(people.map((p) => p.a!.id));
  const sources = items.filter((i) => i.authorIds.some((id) => ids.has(id))).sort((a, b) => (a.itemDate || "9999").localeCompare(b.itemDate || "9999"));
  if (!people.length || !sources.length) return null;
  const W = 150, H = 54, GAP = 18, ROW_GAP = 90, PADX = 16;
  const width = Math.max(people.length, sources.length) * (W + GAP) - GAP + PADX * 2;
  const xRow = (n: number, i: number) => PADX + (width - PADX * 2 - (n * W + (n - 1) * GAP)) / 2 + i * (W + GAP);
  const y0 = 12, y1 = y0 + H + ROW_GAP;
  const br = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "");
  return (
    <div className="overflow-auto rounded-sm border border-pm-line bg-white">
      <svg width={width} height={y1 + H + 14} className="mx-auto block" role="img" aria-label="Alvos e ocorrências">
        {sources.map((s, j) => s.authorIds.map((id) => {
          const i = people.findIndex((p) => p.a!.id === id);
          if (i < 0) return null;
          return <line key={`${s.id}-${id}`} x1={xRow(people.length, i) + W / 2} y1={y0 + H} x2={xRow(sources.length, j) + W / 2} y2={y1} stroke="#9B8A5C" strokeWidth={1.6} />;
        }))}
        {people.map(({ t, a }, i) => {
          const color = ROLE_COLOR[t.role] || "#6B655A";
          const x = xRow(people.length, i);
          const name = a!.name.length > 22 ? `${a!.name.slice(0, 21)}…` : a!.name;
          return (
            <g key={t.id} transform={`translate(${x},${y0})`}>
              <rect width={W} height={H} rx={3} fill="#fff" stroke={color} strokeWidth={1.5} />
              <rect width={W} height={4} fill={color} />
              <text x={W / 2} y={24} textAnchor="middle" fontSize={11} fontWeight={800} fill="#0B0B0C">{name}</text>
              <text x={W / 2} y={41} textAnchor="middle" fontSize={10} fill="#6B655A">{[a!.alias ? `"${a!.alias}"` : "", t.role].filter(Boolean).join(" · ")}</text>
            </g>
          );
        })}
        {sources.map((s, j) => {
          const x = xRow(sources.length, j);
          const ref = (s.reference || s.title);
          return (
            <g key={s.id} transform={`translate(${x},${y1})`}>
              <title>{`${s.kind}: ${s.title}`}</title>
              <rect width={W} height={H} rx={3} fill="#0B0B0C" />
              <rect width={W} height={4} fill="#9B8A5C" />
              <text x={W / 2} y={18} textAnchor="middle" fontSize={9} fontWeight={800} fill="#CFC29B">{s.kind === "Boletim de ocorrência" ? "REDS" : s.kind.split(" ")[0].toUpperCase()}</text>
              <text x={W / 2} y={33} textAnchor="middle" fontSize={10.5} fontWeight={800} fill="#fff">{ref.length > 22 ? `${ref.slice(0, 21)}…` : ref}</text>
              <text x={W / 2} y={47} textAnchor="middle" fontSize={9.5} fill="#CFC29B">{br(s.itemDate)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
