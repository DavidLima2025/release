import { useEffect, useMemo, useState } from "react";
import { Check, GitFork, Plus, Sparkles, Users } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Select } from "./ui/input";
import { Badge } from "./ui/badge";
import type { AppData } from "../hooks/useAppData";
import type { InvestigationsApi } from "../hooks/useInvestigations";
import { ROLE_COLOR, TARGET_ROLES, type Investigation, type InvestigationTarget } from "../lib/investigation";
import { compareInvestigations, proposeHierarchy } from "../lib/hierarchy";
import { formatBR } from "../lib/dates";

type Base = { data: AppData; api: InvestigationsApi; inv: Investigation; targets: InvestigationTarget[] };

/** Itens 3 e 4: sugere a função de cada alvo e monta a hierarquia pelo histórico; o analista confere e aplica. */
export function HierarchyModal({ open, onClose, data, api, targets }: Base & { open: boolean; onClose: () => void }) {
  const proposal = useMemo(() => (open ? proposeHierarchy(targets, data.authors, data.authorReports, api.items) : []), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rows, setRows] = useState<{ id: string; role: string; parentId: string; on: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setRows(proposal.map((p) => ({ id: p.target.id, role: p.role, parentId: p.parentId, on: p.role !== p.target.role || p.parentId !== p.target.parentId })));
  }, [open, proposal]);
  const nameOf = (id: string) => data.authors.find((a) => a.id === targets.find((t) => t.id === id)?.authorId)?.name || "—";
  const set = (id: string, v: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...v, on: true } : x)));
  const changed = rows.filter((r) => r.on);

  async function apply() {
    setBusy(true);
    const ok = await api.applyTargets(changed.map((r) => ({ target: targets.find((t) => t.id === r.id)!, role: r.role, parentId: r.parentId })));
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" eyebrow="Organograma" title={<span className="inline-flex items-center gap-2"><Sparkles className="h-5 w-5 text-pm-gold-light" />Sugerir funções e hierarquia</span>}>
      <div className="space-y-3 text-sm">
        <p className="text-pm-muted">Proposta montada pelos BOs: quem tem mais parceiros dentro do dossiê e mais BOs em comum tende à liderança; cada um fica abaixo do parceiro mais forte acima dele. <b>Confira e ajuste</b> antes de aplicar — só vão as linhas marcadas.</p>
        <div className="overflow-auto rounded-sm border border-pm-line">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-pm-black text-[10px] uppercase tracking-wider text-pm-gold-light">
              <tr><th className="p-2 w-8"></th><th className="p-2">Alvo</th><th className="p-2">Por quê</th><th className="p-2 w-40">Função</th><th className="p-2 w-52">Superior</th></tr>
            </thead>
            <tbody>
              {proposal.map((p) => {
                const r = rows.find((x) => x.id === p.target.id); if (!r) return null;
                const roleChanged = r.role !== p.target.role; const parentChanged = r.parentId !== p.target.parentId;
                return (
                  <tr key={p.target.id} className={`border-t border-pm-line ${r.on ? "bg-pm-gold/10" : ""}`}>
                    <td className="p-2"><input type="checkbox" className="h-4 w-4 accent-[#7A6C45]" checked={r.on} onChange={(e) => setRows((rs) => rs.map((x) => (x.id === r.id ? { ...x, on: e.target.checked } : x)))} /></td>
                    <td className="p-2"><p className="font-black uppercase">{p.author?.name || "?"}</p><p className="text-pm-muted">pontuação {p.score}</p></td>
                    <td className="p-2 text-pm-muted">{p.reason}</td>
                    <td className="p-2">
                      <Select className="h-8 text-xs" value={r.role} onChange={(e) => set(r.id, { role: e.target.value })} style={{ borderLeft: `4px solid ${ROLE_COLOR[r.role] || "#6B655A"}` }}>{TARGET_ROLES.map((x) => <option key={x}>{x}</option>)}</Select>
                      {roleChanged && <p className="mt-0.5 text-[10px] text-pm-muted">era: {p.target.role}</p>}
                    </td>
                    <td className="p-2">
                      <Select className="h-8 text-xs" value={r.parentId} onChange={(e) => set(r.id, { parentId: e.target.value })}><option value="">— topo —</option>{targets.filter((t) => t.id !== r.id).map((t) => <option key={t.id} value={t.id}>{nameOf(t.id)}</option>)}</Select>
                      {parentChanged && <p className="mt-0.5 text-[10px] text-pm-muted">era: {p.target.parentId ? nameOf(p.target.parentId) : "topo"}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex-1 text-xs text-pm-muted">{changed.length} alteração(ões) marcada(s).</span>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!changed.length || busy} onClick={apply}><Check />Aplicar no organograma</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Item 6: compara esta investigação com outra (alvos e BOs em comum, parceiros cruzados). */
export function CompareModal({ open, onClose, data, api, inv, targets, onOpenAuthor }: Base & { open: boolean; onClose: () => void; onOpenAuthor?: (id: string) => void }) {
  const others = api.investigations.filter((i) => i.id !== inv.id);
  const [otherId, setOtherId] = useState("");
  const other = others.find((i) => i.id === otherId);
  const tb = api.targets.filter((t) => t.investigationId === otherId);
  const result = useMemo(() => (other ? compareInvestigations(targets, tb, data.authors, data.authorReports, api.items, inv.id, other.id) : null),
    [otherId, targets, api.targets, api.items, data.authors, data.authorReports]); // eslint-disable-line react-hooks/exhaustive-deps
  const inHere = new Set(targets.map((t) => t.authorId));
  const bring = (authorId: string) => api.addTarget(inv, authorId, "Associado", "");

  // Pré-calcula quantos alvos em comum cada investigação tem, para ordenar a lista.
  const overlap = useMemo(() => new Map(others.map((o) => [o.id, api.targets.filter((t) => t.investigationId === o.id && inHere.has(t.authorId)).length])),
    [open, api.targets, targets]); // eslint-disable-line react-hooks/exhaustive-deps
  const sorted = [...others].sort((a, b) => (overlap.get(b.id) || 0) - (overlap.get(a.id) || 0));

  return (
    <Modal open={open} onClose={onClose} size="xl" eyebrow={`${inv.code} — ${inv.title}`} title={<span className="inline-flex items-center gap-2"><GitFork className="h-5 w-5 text-pm-gold-light" />Comparar com outra investigação</span>}>
      <div className="space-y-4 text-sm">
        <Select value={otherId} onChange={(e) => setOtherId(e.target.value)}>
          <option value="">Escolha a investigação…</option>
          {sorted.map((o) => <option key={o.id} value={o.id}>{o.code} — {o.title}{overlap.get(o.id) ? ` (${overlap.get(o.id)} alvo(s) em comum)` : ""}</option>)}
        </Select>
        {!others.length && <p className="text-pm-muted">Não há outra investigação cadastrada.</p>}
        {result && other && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[["Alvos em comum", result.common.length], ["BOs em comum", result.sharedReds.length], ["Parceiros cruzados", result.crossPartners.length]].map(([l, n]) => (
                <div key={l as string} className="rounded-sm border border-pm-line bg-pm-cream/60 p-3"><p className="text-2xl font-black">{n}</p><p className="text-[10px] font-bold uppercase tracking-wider text-pm-muted">{l}</p></div>
              ))}
            </div>
            <section>
              <p className="pm-label mb-1">Alvos nas duas investigações</p>
              {result.common.length === 0 ? <p className="text-pm-muted">Nenhum.</p> : (
                <div className="grid gap-1">
                  {result.common.map((c) => (
                    <button key={c.author.id} type="button" onClick={() => onOpenAuthor?.(c.author.id)} className="flex items-center gap-2 rounded-sm border border-pm-line px-2 py-1.5 text-left hover:border-pm-gold">
                      <Users className="h-4 w-4 text-pm-muted" /><span className="min-w-0 flex-1 truncate font-bold uppercase">{c.author.name}{c.author.alias ? ` ("${c.author.alias}")` : ""}</span>
                      <Badge>aqui: {c.roleA}</Badge><Badge>{other.code}: {c.roleB}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </section>
            <section>
              <p className="pm-label mb-1">Parceiros cruzados — alvo daqui esteve no mesmo BO que alvo de {other.code}</p>
              {result.crossPartners.length === 0 ? <p className="text-pm-muted">Nenhum.</p> : (
                <div className="grid gap-1">
                  {result.crossPartners.map((c) => (
                    <div key={`${c.a.id}${c.b.id}`} className="flex flex-wrap items-center gap-2 rounded-sm border border-pm-line px-2 py-1.5">
                      <span className="min-w-0 flex-1"><b className="uppercase">{c.a.name}</b> <span className="text-pm-gold-dark">↔</span> <b className="uppercase">{c.b.name}</b> <span className="block text-xs text-pm-muted">REDS {c.reds.join(", ")}</span></span>
                      {!inHere.has(c.b.id) && <Button size="sm" onClick={() => bring(c.b.id)}><Plus />Trazer {c.b.name.split(" ")[0]} para cá</Button>}
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <p className="pm-label mb-1">BOs que aparecem nas duas</p>
              {result.sharedReds.length === 0 ? <p className="text-pm-muted">Nenhum.</p> : (
                <div className="overflow-auto rounded-sm border border-pm-line">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-pm-black text-[10px] uppercase tracking-wider text-pm-gold-light"><tr><th className="p-2">REDS</th><th className="p-2">Data</th><th className="p-2">Daqui</th><th className="p-2">{other.code}</th></tr></thead>
                    <tbody>{result.sharedReds.map((r) => <tr key={r.reds} className="border-t border-pm-line"><td className="p-2 font-mono">{r.reds}</td><td className="p-2">{r.date ? formatBR(r.date) : "—"}</td><td className="p-2">{r.a.join(", ") || "(fonte)"}</td><td className="p-2">{r.b.join(", ") || "(fonte)"}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
