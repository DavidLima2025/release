import { useEffect, useMemo, useRef, useState } from "react";
import type * as React from "react";
import { FolderLock, Loader2, Maximize2, Search, Share2, Users, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input, Select } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Modal } from "../components/ui/modal";
import type { AppData } from "../hooks/useAppData";
import type { InvestigationsApi } from "../hooks/useInvestigations";
import type { Author } from "../lib/domain";
import { TARGET_ROLES } from "../lib/investigation";
import { NetNode, buildEdges, buildNetwork } from "../lib/network";
import { TargetFichaModal } from "../components/TargetFichaModal";
import { ShareTargetModal } from "../components/ShareTargetModal";

const COLORS = ["#C8102E", "#1F6FB2", "#2E8B57", "#D98E04", "#7B3FA0", "#0F9DA8", "#B5541B", "#5B6B2E", "#D6457A", "#3D3D3D"];
const short = (name: string) => { const p = name.split(" ").filter(Boolean); return p.length > 2 ? `${p[0]} ${p[p.length - 1]}` : name; };

type Props = { data: AppData; api?: InvestigationsApi; onOpenInTargets: (authorId: string) => void; onOpenInvestigation?: (id: string) => void };

export function NetworkView({ data, api, onOpenInTargets, onOpenInvestigation }: Props) {
  const [folders, setFolders] = useState<Set<string>>(new Set());
  const [minBos, setMinBos] = useState(1);
  const [withInv, setWithInv] = useState(true);
  const [onlyArrested, setOnlyArrested] = useState(false);
  const [minGroup, setMinGroup] = useState(2);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [groupSel, setGroupSel] = useState<number | null>(null);
  const [ficha, setFicha] = useState<Author | null>(null);
  const [sharing, setSharing] = useState<Author | null>(null);
  const [toInv, setToInv] = useState<{ open: boolean; id: string; role: string; busy: boolean }>({ open: false, id: "", role: "Associado", busy: false });
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const { edges: allEdges, bos } = useMemo(
    () => buildEdges(data.authors, data.authorReports, api?.items || [], api?.targets || [], api?.links || []),
    [data.authors, data.authorReports, api?.items, api?.targets, api?.links],
  );
  const net = useMemo(() => {
    const allowed = data.authors.filter((a) => !folders.size || folders.has(a.categoryId || "none"));
    const ok = new Set(allowed.map((a) => a.id));
    const edges = allEdges.filter((e) => ok.has(e.a) && ok.has(e.b)
      && (onlyArrested ? e.arrested : true)
      && (e.reds.length >= minBos || (withInv && e.relations.length > 0 && !onlyArrested)));
    const built = buildNetwork(allowed, edges, bos);
    // Remove grupos pequenos.
    const keepGroups = new Set(built.groups.map((g, i) => (g.length >= minGroup ? i : -1)).filter((i) => i >= 0));
    const nodes = built.nodes.filter((n) => keepGroups.has(n.group));
    const ids = new Set(nodes.map((n) => n.id));
    return { ...built, nodes, edges: built.edges.filter((e) => ids.has(e.a) && ids.has(e.b)), groups: built.groups };
  }, [allEdges, bos, data.authors, folders, minBos, withInv, onlyArrested, minGroup]);

  const nodeById = useMemo(() => new Map(net.nodes.map((n) => [n.id, n])), [net.nodes]);
  const maxBc = Math.max(1, ...net.nodes.map((n) => n.betweenness));
  const elos = [...net.nodes].filter((n) => n.betweenness > 0).sort((a, b) => b.betweenness - a.betweenness).slice(0, 6);
  const duplas = [...net.edges].sort((a, b) => b.reds.length - a.reds.length).filter((e) => e.reds.length > 1).slice(0, 6);
  const visibleGroups = net.groups.map((g, i) => ({ g, i })).filter(({ g }) => g.length >= minGroup);

  // Enquadra a rede na tela.
  const fit = () => {
    const el = svgRef.current;
    if (!el || !net.nodes.length) return;
    const w = el.clientWidth; const h = el.clientHeight;
    const xs = net.nodes.map((n) => n.x); const ys = net.nodes.map((n) => n.y);
    const minX = Math.min(...xs) - 60; const maxX = Math.max(...xs) + 60; const minY = Math.min(...ys) - 60; const maxY = Math.max(...ys) + 60;
    const s = Math.min(1.25, w / (maxX - minX), h / (maxY - minY));
    setView({ s, x: (w - (maxX - minX) * s) / 2 - minX * s, y: (h - (maxY - minY) * s) / 2 - minY * s });
  };
  useEffect(fit, [net]); // eslint-disable-line react-hooks/exhaustive-deps

  const focus = (n: NetNode) => {
    const el = svgRef.current; if (!el) return;
    const s = Math.max(view.s, 1.1);
    setView({ s, x: el.clientWidth / 2 - n.x * s, y: el.clientHeight / 2 - n.y * s });
  };

  // Busca: destaca e centraliza o alvo.
  const found = query.trim().length >= 2 ? net.nodes.filter((n) => `${n.author.name} ${n.author.alias}`.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(query.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, ""))) : [];

  const sel = selected ? nodeById.get(selected) : undefined;
  const neighbors = useMemo(() => {
    const s = new Set<string>();
    if (selected) net.edges.forEach((e) => { if (e.a === selected) s.add(e.b); if (e.b === selected) s.add(e.a); });
    return s;
  }, [selected, net.edges]);
  const groupMembers = groupSel !== null ? new Set(net.groups[groupSel] || []) : null;
  const dim = (id: string) => (selected ? id !== selected && !neighbors.has(id) : groupMembers ? !groupMembers.has(id) : found.length ? !found.some((f) => f.id === id) : false);

  const onWheel = (e: React.WheelEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    const s = Math.min(4, Math.max(0.15, view.s * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    setView({ s, x: mx - ((mx - view.x) / view.s) * s, y: my - ((my - view.y) / view.s) * s });
  };
  const zoom = (f: number) => { const el = svgRef.current!; const mx = el.clientWidth / 2; const my = el.clientHeight / 2; const s = Math.min(4, Math.max(0.15, view.s * f)); setView({ s, x: mx - ((mx - view.x) / view.s) * s, y: my - ((my - view.y) / view.s) * s }); };

  const photo = (id: string) => data.authorPhotos.find((p) => p.authorId === id);
  const groupColor = (g: number) => COLORS[g % COLORS.length];
  const showLabels = view.s > 0.75 || net.nodes.length < 60;

  // Levar grupo para uma investigação (alvos + vínculo de comparsa entre quem esteve junto).
  async function sendGroup() {
    if (!api || groupSel === null) return;
    const inv = api.investigations.find((i) => i.id === toInv.id);
    if (!inv) return;
    setToInv((t) => ({ ...t, busy: true }));
    const members = net.groups[groupSel];
    const targetOf = new Map(api.targets.filter((t) => t.investigationId === inv.id).map((t) => [t.authorId, t.id]));
    for (const id of members) {
      if (targetOf.has(id)) continue;
      const t = await api.addTarget(inv, id, toInv.role);
      if (t) targetOf.set(id, t.id);
    }
    const existing = api.links.filter((l) => l.investigationId === inv.id);
    for (const e of net.edges.filter((x) => members.includes(x.a) && members.includes(x.b) && x.reds.length)) {
      const ta = targetOf.get(e.a); const tb = targetOf.get(e.b);
      if (!ta || !tb) continue;
      if (existing.some((l) => (l.fromTarget === ta && l.toTarget === tb) || (l.fromTarget === tb && l.toTarget === ta))) continue;
      await api.addLink(inv, ta, tb, e.arrested ? "Comparsa" : "Associado", `Juntos em ${e.reds.length} BO(s): ${e.reds.join(", ")}`);
    }
    await data.addAudit("Rede de vínculos", `Levou ${members.length} alvo(s) do grupo para ${inv.code}.`);
    setToInv({ open: false, id: "", role: "Associado", busy: false });
    data.reload();
    if (window.confirm(`Grupo enviado para ${inv.code}. Abrir a investigação?`)) onOpenInvestigation?.(inv.id);
  }

  const chip = (active: boolean) => `rounded-sm border px-2 py-1 text-[11px] font-bold uppercase ${active ? "border-pm-black bg-pm-black text-white" : "border-pm-line bg-white hover:border-pm-gold"}`;
  const toggleFolder = (id: string) => setFolders((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="space-y-3 rounded-sm border border-pm-line bg-white p-3">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-pm-muted" /><Input className="pl-9" placeholder="Buscar alvo na rede" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          {found.length > 0 && <div className="max-h-32 space-y-0.5 overflow-auto">{found.slice(0, 8).map((n) => <button key={n.id} type="button" className="block w-full truncate rounded-sm px-2 py-1 text-left text-sm hover:bg-pm-cream" onClick={() => { setSelected(n.id); setGroupSel(null); focus(n); }}>{n.author.name}</button>)}</div>}
          <div><p className="pm-label">Pastas</p><div className="flex flex-wrap gap-1">{data.authorCategories.map((f) => <button key={f.id} type="button" className={chip(folders.has(f.id))} onClick={() => toggleFolder(f.id)}>{f.name}</button>)}</div></div>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="pm-label">BOs juntos (mín.)</span><Select className="h-9" value={minBos} onChange={(e) => setMinBos(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}+</option>)}</Select></label>
            <label><span className="pm-label">Grupo (mín.)</span><Select className="h-9" value={minGroup} onChange={(e) => setMinGroup(Number(e.target.value))}>{[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+ alvos</option>)}</Select></label>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#7A6C45]" checked={withInv} onChange={(e) => setWithInv(e.target.checked)} />Incluir vínculos das investigações</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#7A6C45]" checked={onlyArrested} onChange={(e) => setOnlyArrested(e.target.checked)} />Só quem foi preso/conduzido junto</label>
        </div>

        <div className="rounded-sm border border-pm-line bg-white p-3 text-sm">
          <p className="pm-label">Resumo</p>
          <p><b>{net.nodes.length}</b> alvos ligados · <b>{visibleGroups.length}</b> grupo(s) · <b>{net.edges.length}</b> vínculo(s)</p>
          {elos.length > 0 && <>
            <p className="pm-label mt-3">Elos (ligam grupos/pessoas)</p>
            {elos.map((n) => <button key={n.id} type="button" onClick={() => { setSelected(n.id); setGroupSel(null); focus(n); }} className="flex w-full items-center justify-between gap-2 rounded-sm px-1 py-0.5 text-left hover:bg-pm-cream"><span className="truncate">{n.author.name}</span><Badge tone="late">{n.degree} lig.</Badge></button>)}
          </>}
          {duplas.length > 0 && <>
            <p className="pm-label mt-3">Duplas mais frequentes</p>
            {duplas.map((e) => <p key={e.id} className="truncate text-xs"><b>{e.reds.length}×</b> {short(nodeById.get(e.a)!.author.name)} + {short(nodeById.get(e.b)!.author.name)}{e.arrested ? " · presos juntos" : ""}</p>)}
          </>}
          {visibleGroups.length > 0 && <>
            <p className="pm-label mt-3">Grupos</p>
            <div className="max-h-48 space-y-0.5 overflow-auto">
              {visibleGroups.map(({ g, i }) => (
                <button key={i} type="button" onClick={() => { setGroupSel(i); setSelected(""); }} className={`flex w-full items-center gap-2 rounded-sm px-1 py-0.5 text-left text-xs hover:bg-pm-cream ${groupSel === i ? "bg-pm-gold/15" : ""}`}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: groupColor(i) }} /><span className="truncate">Grupo {i + 1}: {g.slice(0, 3).map((id) => short(nodeById.get(id)?.author.name || "")).join(", ")}{g.length > 3 ? "…" : ""}</span><b className="ml-auto">{g.length}</b>
                </button>
              ))}
            </div>
          </>}
        </div>
      </aside>

      <div className="space-y-2">
        <div className="relative overflow-hidden rounded-sm border border-pm-line bg-[radial-gradient(circle,#d8d0ba_1px,transparent_1px)] [background-size:18px_18px]" style={{ height: "72vh" }}>
          {net.nodes.length === 0 ? (
            <div className="grid h-full place-items-center p-6 text-center text-sm text-pm-muted">Nenhum vínculo com estes filtros. Os vínculos aparecem quando dois alvos estão no mesmo REDS (cadastro pelo BO) ou ligados numa investigação.</div>
          ) : (
            <svg ref={svgRef} className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing" onWheel={onWheel}
              onPointerDown={(e) => { if ((e.target as Element).closest("[data-node]")) return; drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; (e.currentTarget as Element).setPointerCapture(e.pointerId); }}
              onPointerMove={(e) => { if (drag.current) setView((v) => ({ ...v, x: drag.current!.vx + e.clientX - drag.current!.x, y: drag.current!.vy + e.clientY - drag.current!.y })); }}
              onPointerUp={(e) => { if (drag.current && Math.hypot(e.clientX - drag.current.x, e.clientY - drag.current.y) < 4) { setSelected(""); setGroupSel(null); } drag.current = null; }}>
              <defs>{net.nodes.map((n) => <clipPath key={n.id} id={`np-${n.id}`}><circle r={radius(n)} /></clipPath>)}</defs>
              <g transform={`translate(${view.x},${view.y}) scale(${view.s})`}>
                {net.edges.map((e) => {
                  const a = nodeById.get(e.a)!; const b = nodeById.get(e.b)!;
                  const faded = dim(e.a) || dim(e.b);
                  const onlyInv = !e.reds.length;
                  return (
                    <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeLinecap="round"
                      stroke={onlyInv ? "#1F6FB2" : e.arrested ? "#C8102E" : "#9B8A5C"} strokeWidth={onlyInv ? 1.5 : 1.2 + Math.min(5, e.reds.length) * 1.1}
                      strokeDasharray={onlyInv ? "5 4" : undefined} opacity={faded ? 0.08 : 0.85}>
                      <title>{`${a.author.name} — ${b.author.name}\n${e.reds.length ? `${e.reds.length} BO(s) juntos${e.arrested ? " (presos juntos)" : ""}: ${e.reds.join(", ")}` : ""}${e.relations.length ? `\nInvestigação: ${e.relations.join(", ")}` : ""}`}</title>
                    </line>
                  );
                })}
                {net.nodes.map((n) => {
                  const r = radius(n); const ph = photo(n.id); const faded = dim(n.id);
                  const isElo = n.betweenness > 0 && n.betweenness >= maxBc * 0.5;
                  return (
                    <g key={n.id} data-node transform={`translate(${n.x},${n.y})`} opacity={faded ? 0.15 : 1} className="cursor-pointer"
                      onClick={() => { setSelected(n.id); setGroupSel(null); }} onDoubleClick={() => setFicha(n.author)}>
                      {isElo && <circle r={r + 6} fill="none" stroke="#C8102E" strokeWidth={2} strokeDasharray="3 3" />}
                      <circle r={r + 2.5} fill={groupColor(n.group)} />
                      {ph ? <image href={data.getIntelFileUrl(ph.filePath)} x={-r} y={-r} width={r * 2} height={r * 2} preserveAspectRatio="xMidYMid slice" clipPath={`url(#np-${n.id})`} />
                        : <circle r={r} fill="#F3F0E7" />}
                      {!ph && <text textAnchor="middle" dy="0.35em" fontSize={r * 0.8} fontWeight={800} fill="#6B655A">{n.author.name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("")}</text>}
                      {selected === n.id && <circle r={r + 5} fill="none" stroke="#0B0B0C" strokeWidth={3} />}
                      {(showLabels || selected === n.id || neighbors.has(n.id)) && (
                        <text y={r + 14} textAnchor="middle" fontSize={11} fontWeight={800} fill="#0B0B0C" stroke="#F3F0E7" strokeWidth={3} paintOrder="stroke">{short(n.author.name)}{n.author.alias ? ` "${n.author.alias}"` : ""}</text>
                      )}
                      <title>{`${n.author.name}${n.author.alias ? ` ("${n.author.alias}")` : ""}\n${n.bos} BO(s) · ${n.degree} ligação(ões)`}</title>
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
          <div className="absolute right-2 top-2 flex flex-col gap-1">
            <Button size="icon" onClick={() => zoom(1.25)} aria-label="Aproximar"><ZoomIn /></Button>
            <Button size="icon" onClick={() => zoom(0.8)} aria-label="Afastar"><ZoomOut /></Button>
            <Button size="icon" onClick={fit} aria-label="Enquadrar"><Maximize2 /></Button>
          </div>
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-sm bg-white/90 px-2 py-1 text-[10px] font-bold uppercase leading-5">
            <span className="mr-3 inline-flex items-center gap-1"><span className="inline-block h-1 w-5 bg-[#9B8A5C]" />Mesmo BO</span>
            <span className="mr-3 inline-flex items-center gap-1"><span className="inline-block h-1 w-5 bg-[#C8102E]" />Presos juntos</span>
            <span className="mr-3 inline-flex items-center gap-1"><span className="inline-block h-0 w-5 border-t-2 border-dashed border-[#1F6FB2]" />Investigação</span>
            <span className="inline-flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full border-2 border-dashed border-[#C8102E]" />Elo</span>
          </div>
        </div>

        {sel && (
          <div className="flex flex-wrap items-start gap-3 rounded-sm border border-pm-line bg-white p-3">
            <div className="grid h-20 w-16 shrink-0 place-items-center overflow-hidden rounded-sm bg-pm-sand">{photo(sel.id) ? <img src={data.getIntelFileUrl(photo(sel.id)!.filePath)} alt="" className="h-full w-full object-cover" /> : <Users className="h-6 w-6 text-pm-muted" />}</div>
            <div className="min-w-[220px] flex-1">
              <p className="font-black uppercase">{sel.author.name}{sel.author.alias ? <span className="font-semibold normal-case text-pm-muted"> "{sel.author.alias}"</span> : null}</p>
              <p className="text-xs text-pm-muted">{sel.bos} BO(s) · {sel.degree} ligação(ões) · grupo {sel.group + 1} ({net.groups[sel.group].length} alvos){sel.betweenness >= maxBc * 0.5 && sel.betweenness > 0 ? " · elo da rede" : ""}</p>
              <p className="mt-1 text-xs">{net.edges.filter((e) => e.a === sel.id || e.b === sel.id).map((e) => { const o = nodeById.get(e.a === sel.id ? e.b : e.a)!; return `${short(o.author.name)}${e.reds.length ? ` (${e.reds.length}×${e.arrested ? ", preso junto" : ""})` : " (investigação)"}`; }).join(" · ")}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="gold" onClick={() => setFicha(sel.author)}>Abrir ficha</Button>
              <Button size="sm" onClick={() => { setGroupSel(sel.group); setSelected(""); }}><Users />Ver grupo</Button>
              <Button size="sm" onClick={() => setSelected("")} aria-label="Fechar"><X /></Button>
            </div>
          </div>
        )}

        {groupSel !== null && net.groups[groupSel] && (
          <div className="rounded-sm border border-pm-line bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-3 w-3 rounded-full" style={{ background: groupColor(groupSel) }} />
              <p className="font-black uppercase">Grupo {groupSel + 1} · {net.groups[groupSel].length} alvos</p>
              <div className="ml-auto flex gap-1.5">
                {api && data.permissions.investigations && <Button size="sm" variant="gold" onClick={() => setToInv((t) => ({ ...t, open: true }))}><FolderLock />Levar para investigação</Button>}
                <Button size="sm" onClick={() => setGroupSel(null)} aria-label="Fechar"><X /></Button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {net.groups[groupSel].map((id) => { const n = nodeById.get(id); return n ? <button key={id} type="button" onClick={() => setFicha(n.author)} className="rounded-sm border border-pm-line px-2 py-1 text-xs font-bold hover:border-pm-gold">{n.author.name}<span className="ml-1 font-normal text-pm-muted">{n.bos} BO</span></button> : null; })}
            </div>
          </div>
        )}
        <p className="text-[11px] text-pm-muted">Arraste para mover, roda do mouse para zoom. Clique num alvo para ver as ligações; clique duplo abre a ficha. Ligações vêm dos REDS em comum (BOs anexados aos cards e das investigações) e dos vínculos registrados nos organogramas.</p>
      </div>

      <TargetFichaModal author={ficha} data={data} api={api} onClose={() => setFicha(null)}
        onEdit={(a) => { setFicha(null); onOpenInTargets(a.id); }} onMove={(a) => { setFicha(null); onOpenInTargets(a.id); }}
        onShareMessage={(a) => setSharing(a)} onOpenInvestigation={onOpenInvestigation} onOpenAuthor={(o) => setFicha(o)} />
      <ShareTargetModal author={sharing} data={data} onClose={() => setSharing(null)} />
      <Modal open={toInv.open} onClose={() => !toInv.busy && setToInv((t) => ({ ...t, open: false }))} size="md" eyebrow="Rede de vínculos" title="Levar grupo para investigação"
        footer={<><Button onClick={() => setToInv((t) => ({ ...t, open: false }))} disabled={toInv.busy}>Cancelar</Button><Button variant="primary" disabled={!toInv.id || toInv.busy} onClick={sendGroup}>{toInv.busy ? <Loader2 className="animate-spin" /> : <Share2 />}Enviar</Button></>}>
        <p className="mb-3 text-sm text-pm-muted">Os alvos do grupo entram no dossiê (quem já está fica como está) e quem esteve no mesmo BO ganha o vínculo no organograma (“Comparsa” se foram presos juntos).</p>
        <label className="block"><span className="pm-label">Investigação</span>
          <Select value={toInv.id} onChange={(e) => setToInv((t) => ({ ...t, id: e.target.value }))}><option value="">Escolha…</option>{(api?.investigations || []).filter((i) => i.status === "Em andamento" || i.status === "Suspensa").map((i) => <option key={i.id} value={i.id}>{i.code} — {i.title}</option>)}</Select>
        </label>
        <label className="mt-3 block"><span className="pm-label">Papel dos novos alvos</span>
          <Select value={toInv.role} onChange={(e) => setToInv((t) => ({ ...t, role: e.target.value }))}>{TARGET_ROLES.map((r) => <option key={r}>{r}</option>)}</Select>
        </label>
      </Modal>
    </div>
  );
}

function radius(n: NetNode) {
  return 14 + Math.min(14, Math.sqrt(n.degree) * 4 + n.bos * 0.6);
}
