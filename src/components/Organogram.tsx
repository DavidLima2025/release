import { useMemo } from "react";
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
};

const BOX_W = 168;
const BOX_H = 64;
const GAP_X = 22;
const GAP_Y = 46;
const PAD = 16;

export function Organogram({ targets, links, authors, photos, photoUrl, selectedId, onSelect }: Props) {
  const layout = useMemo(() => layoutOrganogram(targets), [targets]);
  const width = layout.width * (BOX_W + GAP_X) - GAP_X + PAD * 2;
  const height = layout.depth * (BOX_H + GAP_Y) - GAP_Y + PAD * 2;
  const pos = new Map(layout.nodes.map((n) => [n.id, { cx: PAD + n.x * (BOX_W + GAP_X) + BOX_W / 2, ty: PAD + n.y * (BOX_H + GAP_Y) }]));
  const byId = new Map(targets.map((t) => [t.id, t]));

  if (!targets.length) return null;
  return (
    <div className="overflow-auto rounded-sm border border-pm-line bg-[radial-gradient(circle,#d8d0ba_1px,transparent_1px)] [background-size:18px_18px]">
      <svg width={Math.max(width, 320)} height={height} viewBox={`0 0 ${Math.max(width, 320)} ${height}`} className="mx-auto block" role="img" aria-label="Organograma dos alvos">
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
        {layout.nodes.map((n) => {
          const target = byId.get(n.id)!;
          const author = authors.find((a) => a.id === target.authorId);
          const photo = photos.find((p) => p.authorId === target.authorId);
          const p = pos.get(n.id)!;
          const color = ROLE_COLOR[target.role] || "#6B655A";
          const x = p.cx - BOX_W / 2;
          const selected = selectedId === target.id;
          const name = author?.name || "Alvo removido";
          const textX = photo ? 56 : 10;
          const maxChars = photo ? 17 : 22;
          const line1 = name.length > maxChars ? name.slice(0, name.lastIndexOf(" ", maxChars) > 4 ? name.lastIndexOf(" ", maxChars) : maxChars) : name;
          const rest = name.slice(line1.length).trim();
          const line2 = rest.length > maxChars ? `${rest.slice(0, maxChars - 1)}…` : rest;
          return (
            <g key={n.id} transform={`translate(${x},${p.ty})`} className="cursor-pointer" onClick={() => onSelect?.(target)}>
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
    </div>
  );
}
