import { useMemo, useState } from "react";
import { ExternalLink, Layers, Maximize2, Network, Search, Users, X, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { OrgBoard, type BoardPerson } from "../components/OrgBoard";
import { TargetFichaModal } from "../components/TargetFichaModal";
import { ShareTargetModal } from "../components/ShareTargetModal";
import type { AppData } from "../hooks/useAppData";
import type { InvestigationsApi } from "../hooks/useInvestigations";
import type { Author } from "../lib/domain";
import { matchesText } from "../lib/domain";
import { redsCount } from "../lib/companions";
import { roleCatalogVersion } from "../lib/roles";
import type { BoardLayout } from "../lib/investigation";
import { ROLE_COLOR, TARGET_ROLES, emptyLayout, groupStatus, layoutIsEmpty, type Confidence, type Investigation, type InvestigationLink, type InvestigationTarget } from "../lib/investigation";
import { groupDropPatch, groupKeyOf, groupNameOfKey, levelOf } from "../lib/orgBoard";
import { LinkDropModal } from "../components/OrgTools";
import { autoLinksFor } from "../lib/sharedContacts";

type Props = { data: AppData; api?: InvestigationsApi; onOpenInTargets: (authorId: string) => void; onOpenInvestigation?: (id: string) => void };

type Row = { inv: Investigation; targets: InvestigationTarget[]; links: InvestigationLink[]; nuclei: number; arrested: number; fugitive: number };
/** Onde o mesmo alvo (pessoa) aparece em mais de uma investigação. */
type Crossing = { authorId: string; name: string; at: { inv: Investigation; target: InvestigationTarget }[] };

const ZOOMS: (number | "fit")[] = ["fit", 0.75, 1, 1.25, 1.5, 2];
const nameOfTarget = (t: InvestigationTarget, authors: Author[]) => authors.find((a) => a.id === t.authorId)?.name || t.label || "NÃO IDENTIFICADO";

function peopleOf(targets: InvestigationTarget[], data: AppData, api: InvestigationsApi) {
  const m = new Map<string, BoardPerson>();
  const rank: Confidence[] = ["confirmado", "provavel", "a confirmar"];
  for (const t of targets) {
    const a = data.authors.find((x) => x.id === t.authorId);
    const ph = data.authorPhotos.find((p) => p.authorId === t.authorId && (p.category || "perfil") === "perfil");
    const ev = t.evidence.filter((e) => !e.role || e.role === t.role);
    const confidence = ev.length ? rank.find((c) => ev.some((e) => (e.confidence || "provavel") === c)) : undefined;
    m.set(t.id, {
      name: a?.name || t.label || "NÃO IDENTIFICADO", alias: a?.alias || "", photo: ph ? data.getIntelFileUrl(ph.filePath) : undefined, role: t.role, area: t.area,
      evidence: t.evidence.length, bos: a ? redsCount(a.id, data.authors, data.authorReports, api.items).length : 0, unknown: !a, status: groupStatus(t), confidence,
    });
  }
  return m;
}

/** Organogramas das investigações em destaque (quadro por núcleos). A edição continua dentro de cada investigação (aba Alvos). */
export function OrganogramasView({ data, api, onOpenInTargets, onOpenInvestigation }: Props) {
  const [sel, setSel] = useState<string>(() => { try { return localStorage.getItem("redeInv") || ""; } catch { return ""; } });
  const [zoom, setZoom] = useState<number | "fit">(1);
  const [query, setQuery] = useState("");
  const [pick, setPick] = useState<{ invId: string; targetId: string } | null>(null);
  const [ficha, setFicha] = useState<Author | null>(null);
  const [sharing, setSharing] = useState<Author | null>(null);

  const catalog = roleCatalogVersion();
  const rows = useMemo<Row[]>(() => {
    if (!api) return [];
    const list = api.investigations.map((inv) => {
      const targets = api.targets.filter((t) => t.investigationId === inv.id);
      const links = api.links.filter((l) => l.investigationId === inv.id);
      return {
        inv, targets, links, nuclei: new Set(targets.map((t) => groupKeyOf(t, inv.orgGroups))).size,
        arrested: targets.filter((t) => groupStatus(t) === "PRESO").length, fugitive: targets.filter((t) => groupStatus(t) === "FORAGIDO").length,
      };
    });
    const live = (r: Row) => (r.inv.status === "Em andamento" || r.inv.status === "Suspensa" ? 0 : 1);
    return list.sort((a, b) => Number(!a.targets.length) - Number(!b.targets.length) || live(a) - live(b));
  }, [api?.investigations, api?.targets, api?.links, catalog]); // eslint-disable-line react-hooks/exhaustive-deps
  const withTargets = rows.filter((r) => r.targets.length);

  const crossings = useMemo<Crossing[]>(() => {
    const m = new Map<string, Crossing>();
    for (const r of rows) for (const t of r.targets) {
      if (!t.authorId) continue;
      const c = m.get(t.authorId) || { authorId: t.authorId, name: nameOfTarget(t, data.authors), at: [] };
      c.at.push({ inv: r.inv, target: t }); m.set(t.authorId, c);
    }
    return [...m.values()].filter((c) => c.at.length > 1).sort((a, b) => b.at.length - a.at.length || a.name.localeCompare(b.name));
  }, [rows, data.authors]);
  const crossOf = useMemo(() => new Map(crossings.map((c) => [c.authorId, c])), [crossings]);

  const found = useMemo(() => {
    if (query.trim().length < 2) return [];
    return rows.flatMap((r) => r.targets.map((t) => ({ r, t, a: data.authors.find((x) => x.id === t.authorId) })))
      .filter(({ t, a }) => matchesText([a?.name, a?.alias, t.label], query)).slice(0, 8);
  }, [rows, query, data.authors]);

  const current = sel === "all" ? "all" : withTargets.some((r) => r.inv.id === sel) ? sel : withTargets[0]?.inv.id || "";
  const choose = (id: string) => {
    setSel(id); setPick(null);
    if (id === "all") setZoom("fit");
    try { localStorage.setItem("redeInv", id); } catch { /* sem armazenamento: só não lembra */ }
  };
  const goTo = (invId: string, targetId: string) => { choose(invId); setPick({ invId, targetId }); if (zoom === "fit") setZoom(1); };
  const shown = current === "all" ? withTargets : withTargets.filter((r) => r.inv.id === current);

  const zi = ZOOMS.indexOf(zoom);
  const zoomLabel = zoom === "fit" ? "Ajustar" : `${Math.round(zoom * 100)}%`;

  if (!api) {
    return <div className="rounded-sm border border-pm-line bg-white p-8 text-center text-sm text-pm-muted">Os organogramas ficam dentro das investigações, e o seu perfil não tem acesso a elas.</div>;
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <div className="space-y-2 rounded-sm border border-pm-line bg-white p-3">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-pm-muted" /><Input className="pl-9" placeholder="Buscar alvo nos organogramas" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          {found.length > 0 && (
            <div className="max-h-44 space-y-0.5 overflow-auto">
              {found.map(({ r, t }) => (
                <button key={t.id} type="button" className="block w-full rounded-sm px-2 py-1 text-left hover:bg-pm-cream" onClick={() => { goTo(r.inv.id, t.id); setQuery(""); }}>
                  <span className="block truncate text-sm font-bold">{nameOfTarget(t, data.authors)}</span>
                  <span className="block truncate text-[11px] text-pm-muted">{r.inv.code} · {t.role}</span>
                </button>
              ))}
            </div>
          )}
          {query.trim().length >= 2 && !found.length && <p className="text-xs text-pm-muted">Nenhum alvo com esse nome nos organogramas.</p>}
        </div>

        <div className="rounded-sm border border-pm-line bg-white p-3">
          <p className="pm-label">Organogramas ({withTargets.length})</p>
          {withTargets.length > 1 && (
            <button type="button" onClick={() => choose("all")} className={`mb-1.5 flex w-full items-center gap-2 rounded-sm border p-2 text-left text-sm font-black uppercase ${current === "all" ? "border-pm-gold bg-pm-gold/15" : "border-pm-line bg-white hover:border-pm-gold"}`}>
              <Layers className="h-4 w-4 shrink-0" />Ver todos juntos
            </button>
          )}
          <div className="max-h-[52vh] space-y-1.5 overflow-auto">
            {rows.map((r) => {
              const on = current === r.inv.id;
              return (
                <button key={r.inv.id} type="button" disabled={!r.targets.length} onClick={() => choose(r.inv.id)}
                  className={`block w-full rounded-sm border p-2 text-left ${on ? "border-pm-gold bg-pm-gold/15" : "border-pm-line bg-white hover:border-pm-gold"} ${r.targets.length ? "" : "cursor-not-allowed opacity-50"}`}>
                  <p className="text-[10px] font-bold uppercase text-pm-muted">{r.inv.code}{r.inv.status !== "Em andamento" ? ` · ${r.inv.status}` : ""}</p>
                  <p className="truncate text-sm font-black uppercase leading-tight">{r.inv.title}</p>
                  <p className="text-xs text-pm-muted">{r.targets.length ? `${r.targets.length} alvo(s) · ${r.nuclei} núcleo(s)${r.arrested ? ` · ${r.arrested} preso(s)` : ""}` : "sem alvos no dossiê"}</p>
                </button>
              );
            })}
            {!rows.length && <p className="text-xs text-pm-muted">Nenhuma investigação cadastrada.</p>}
          </div>
        </div>

        {crossings.length > 0 && (
          <div className="rounded-sm border border-pm-line bg-white p-3">
            <p className="pm-label">Alvos em mais de uma investigação ({crossings.length})</p>
            <p className="mb-1.5 text-[11px] text-pm-muted">É o que liga um organograma ao outro. Clique na investigação para ir até ele.</p>
            <div className="max-h-56 space-y-1.5 overflow-auto">
              {crossings.slice(0, 20).map((c) => (
                <div key={c.authorId} className="text-xs">
                  <p className="truncate font-black uppercase">{c.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {c.at.map(({ inv, target }) => (
                      <button key={target.id} type="button" onClick={() => goTo(inv.id, target.id)} title={`${inv.title} — ${target.role}`}
                        className="rounded-sm border border-pm-line px-1.5 py-0.5 font-bold hover:border-pm-gold">{inv.code.replace(/^INV-/, "")} · {target.role}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-sm bg-pm-cream/70 px-2 py-1.5 text-xs">
          <Network className="h-4 w-4 shrink-0" />
          <span className="font-bold uppercase text-pm-muted">{current === "all" ? `${withTargets.length} organogramas` : "Organograma"}</span>
          <span className="text-pm-muted">Clique num alvo para ver a cadeia de comando; clique duplo abre a ficha. Para definir superior, criar vínculo ou mover, use <b>✎ Editar</b> em cada organograma.</span>
          <div className="ml-auto flex items-center gap-1">
            <Button size="icon" disabled={zi <= 0} onClick={() => setZoom(ZOOMS[Math.max(0, zi - 1)])} aria-label="Afastar"><ZoomOut /></Button>
            <span className="w-14 text-center font-bold">{zoomLabel}</span>
            <Button size="icon" disabled={zi >= ZOOMS.length - 1} onClick={() => setZoom(ZOOMS[Math.min(ZOOMS.length - 1, zi + 1)])} aria-label="Aproximar"><ZoomIn /></Button>
            <Button size="icon" onClick={() => setZoom("fit")} aria-label="Ajustar à largura"><Maximize2 /></Button>
          </div>
        </div>

        {!shown.length ? (
          <div className="rounded-sm border border-pm-line bg-white p-8 text-center text-sm text-pm-muted">Nenhuma investigação com alvos ainda. Monte o organograma na aba <b>Alvos</b>, dentro da investigação, e ele aparece aqui.</div>
        ) : shown.map((r) => (
          <InvBoard key={r.inv.id} row={r} data={data} api={api} zoom={zoom} crossOf={crossOf}
            pick={pick && pick.invId === r.inv.id ? pick.targetId : ""}
            onPick={(id) => setPick(id ? { invId: r.inv.id, targetId: id } : null)}
            onOpenFicha={setFicha} onOpenInvestigation={onOpenInvestigation} goTo={goTo} />
        ))}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-pm-muted">
          {TARGET_ROLES.map((role) => <span key={role} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: ROLE_COLOR[role] }} />{role}</span>)}
        </div>
      </div>

      <TargetFichaModal author={ficha} data={data} api={api} onClose={() => setFicha(null)}
        onEdit={(a) => { setFicha(null); onOpenInTargets(a.id); }} onMove={(a) => { setFicha(null); onOpenInTargets(a.id); }}
        onShareMessage={(a) => setSharing(a)} onOpenInvestigation={onOpenInvestigation} onOpenAuthor={(o) => setFicha(o)} />
      <ShareTargetModal author={sharing} data={data} onClose={() => setSharing(null)} />
    </div>
  );
}

function InvBoard({ row, data, api, zoom, crossOf, pick, onPick, onOpenFicha, onOpenInvestigation, goTo }: {
  row: Row; data: AppData; api: InvestigationsApi; zoom: number | "fit"; crossOf: Map<string, Crossing>; pick: string;
  onPick: (id: string) => void; onOpenFicha: (a: Author) => void; onOpenInvestigation?: (id: string) => void; goTo: (invId: string, targetId: string) => void;
}) {
  const { inv, targets, links } = row;
  const people = useMemo(() => peopleOf(targets, data, api), [targets, data.authors, data.authorPhotos, data.authorReports, api.items]); // eslint-disable-line react-hooks/exhaustive-deps
  const autoLinks = useMemo(() => autoLinksFor(targets, data.authors), [targets, data.authors]);
  const t = targets.find((x) => x.id === pick);
  const a = t ? data.authors.find((x) => x.id === t.authorId) : undefined;
  const p = t ? people.get(t.id) : undefined;
  const boss = t?.parentId ? targets.find((x) => x.id === t.parentId) : undefined;
  const others = t && a ? (crossOf.get(a.id)?.at || []).filter((x) => x.inv.id !== inv.id) : [];
  const level = Math.max(...targets.map(levelOf)) + 1;
  // Edição direto no organograma (os mesmos gestos da aba Alvos da investigação).
  const [edit, setEdit] = useState(false);
  const [mode, setMode] = useState<"superior" | "vinculo" | "mover">("vinculo");
  const [linkPair, setLinkPair] = useState<{ from: string; to: string } | null>(null);
  const nameOf = (id: string) => { const x = targets.find((y) => y.id === id); return x ? nameOfTarget(x, data.authors) : ""; };
  const editProps = edit ? {
    dragMode: mode,
    onLinkDrop: (x: InvestigationTarget, to: string) => setLinkPair({ from: x.id, to }),
    onDropOnTarget: (x: InvestigationTarget, parentId: string) => api.updateTarget(x, { parentId }),
    onDropOnGroup: (x: InvestigationTarget, key: string) => api.updateTarget(x, groupDropPatch(x, key)),
    onLayoutChange: (next: BoardLayout, what: { kind: "card" | "group"; id: string }) => {
      // Só guarda posições de alvos que ainda existem no dossiê.
      const ids = new Set(targets.map((x) => x.id));
      const cards = Object.fromEntries(Object.entries(next.cards).filter(([id]) => ids.has(id)));
      api.setOrgLayout(inv, { ...next, cards }, what.kind === "card" ? `posição de ${nameOf(what.id)}` : `posição do núcleo ${groupNameOfKey(what.id)}`);
    },
  } : {};

  return (
    <section className="overflow-hidden rounded-sm border border-pm-line bg-white shadow-sm">
      <header className="flex flex-wrap items-center gap-2 border-b border-pm-line bg-pm-cream/60 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase text-pm-muted">{inv.code} · {inv.status}</p>
          <h3 className="truncate text-lg font-black uppercase leading-tight">{inv.title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <Badge tone="dark">{targets.length} alvo(s)</Badge>
          <Badge>{row.nuclei} núcleo(s)</Badge>
          <Badge>{level} grau(s)</Badge>
          {row.arrested > 0 && <Badge tone="late">{row.arrested} preso(s)</Badge>}
          {row.fugitive > 0 && <Badge tone="risk">{row.fugitive} foragido(s)</Badge>}
          {onOpenInvestigation && <Button size="sm" variant="gold" onClick={() => onOpenInvestigation(inv.id)}><ExternalLink />Abrir investigação</Button>}
        </div>
      </header>

      <div className="p-2">
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-sm bg-pm-cream/70 px-2 py-1.5 text-xs">
          <Button size="sm" variant={edit ? "primary" : "outline"} onClick={() => setEdit(!edit)} aria-pressed={edit} title="Liga o arrastar neste organograma: definir superior, criar vínculo ou mover">{edit ? "✓ Editando" : "✎ Editar"}</Button>
          {edit ? (
            <>
              <div className="flex overflow-hidden rounded-sm border border-pm-line font-bold">
                <button type="button" onClick={() => setMode("vinculo")} className={`px-3 py-1.5 ${mode === "vinculo" ? "bg-[#2E6B3A] text-white" : "bg-white"}`}>⇢ cria vínculo</button>
                <button type="button" onClick={() => setMode("superior")} className={`px-3 py-1.5 ${mode === "superior" ? "bg-[#C0201A] text-white" : "bg-white"}`}>▼ define o superior</button>
                <button type="button" onClick={() => setMode("mover")} className={`px-3 py-1.5 ${mode === "mover" ? "bg-[#2F5D7C] text-white" : "bg-white"}`}>✥ move livremente</button>
              </div>
              <span className="min-w-[200px] flex-1 text-pm-muted">
                {mode === "vinculo" ? <>Arraste um alvo e <b>solte sobre outro</b> para registrar o vínculo (parente, comparsa, fornecedor…).</>
                  : mode === "superior" ? <>Arraste um alvo e <b>solte sobre o chefe</b> dele; no vazio, fica sem chefe; sobre um núcleo, muda de núcleo.</>
                    : <>Arraste um <b>cartão</b> ou um <b>núcleo</b> para onde quiser — a posição fica salva.</>}
              </span>
              {mode === "mover" && <Button size="sm" disabled={layoutIsEmpty(inv.orgLayout)} onClick={() => api.setOrgLayout(inv, emptyLayout(), "posições soltas → automático")} title="Volta ao desenho automático (dá para desfazer)">⟲ Reorganizar automático</Button>}
              <Button size="sm" className="ml-auto" disabled={!api.undoCount} onClick={() => api.undo()} title={api.undoLabel ? `Desfazer: ${api.undoLabel}` : ""}>↶ Desfazer{api.undoLabel ? `: ${api.undoLabel}` : ""}</Button>
            </>
          ) : <span className="text-pm-muted">Para criar vínculo, definir o superior ou mover os cartões, clique em <b>Editar</b>.</span>}
        </div>
        <OrgBoard targets={targets} links={links} groups={inv.orgGroups} autoLinks={autoLinks} people={people} layout={inv.orgLayout} scale={zoom} {...editProps}
          selectedId={pick} onSelect={(x) => onPick(pick === x.id ? "" : x.id)} onOpen={(x) => { const au = data.authors.find((y) => y.id === x.authorId); if (au) onOpenFicha(au); }} />
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 px-1 text-[11px] font-semibold text-pm-muted">
          <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-6 bg-[#C0201A]" />▶ comanda / hierarquia</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-6 border-t-2 border-dashed border-[#2E6B3A]" />vínculo (parente, namoro, fornecedor…)</span>
          <span className="inline-flex items-center gap-1.5"><span className="grid h-4 w-4 place-items-center rounded-full bg-[#9B8A5C] text-[9px] text-white">2</span>indícios da função</span>
          <span className="inline-flex items-center gap-1.5 text-[#2F5D7C]">◉ área de atuação</span>
        </div>
      </div>

      {t && p && (
        <div className="flex flex-wrap items-start gap-3 border-t border-pm-line bg-white p-3">
          <div className="grid h-20 w-16 shrink-0 place-items-center overflow-hidden rounded-sm bg-pm-sand">{p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : <Users className="h-6 w-6 text-pm-muted" />}</div>
          <div className="min-w-[220px] flex-1">
            <p className="font-black uppercase">{p.name}{p.alias ? <span className="font-semibold normal-case text-pm-muted"> "{p.alias}"</span> : null}</p>
            <p className="text-xs"><span className="mr-1 inline-block h-2.5 w-2.5 rounded-[2px] align-middle" style={{ background: ROLE_COLOR[t.role] }} /><b>{t.role}</b> · {levelOf(t) + 1}º grau · núcleo {groupNameOfKey(groupKeyOf(t, inv.orgGroups)).toLowerCase()}{p.status ? ` · ${p.status}` : ""}</p>
            <p className="text-xs text-pm-muted">
              {boss ? <>chefe: <b className="text-[#C0201A]">{nameOfTarget(boss, data.authors)}</b></> : "sem chefe definido"} · comanda {targets.filter((x) => x.parentId === t.id).length} direto(s)
              {t.area ? ` · área: ${t.area}` : ""}{p.evidence ? ` · ${p.evidence} indício(s)` : ""}{p.bos ? ` · ${p.bos} BO(s)` : ""}
            </p>
            {others.length > 0 && (
              <p className="mt-1 flex flex-wrap items-center gap-1 text-xs"><b>Também em:</b>
                {others.map(({ inv: o, target }) => <button key={target.id} type="button" onClick={() => goTo(o.id, target.id)} title={o.title} className="rounded-sm border border-pm-gold bg-pm-gold/10 px-1.5 py-0.5 font-bold hover:bg-pm-gold/25">{o.code} · {target.role}</button>)}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {a && <Button size="sm" variant="gold" onClick={() => onOpenFicha(a)}>Abrir ficha</Button>}
            <Button size="sm" onClick={() => onPick("")} aria-label="Fechar"><X /></Button>
          </div>
        </div>
      )}
      <LinkDropModal pair={linkPair} onClose={() => setLinkPair(null)} data={data} api={api} inv={inv} targets={targets} />
    </section>
  );
}
