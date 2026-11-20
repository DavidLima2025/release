import { useEffect, useMemo, useState } from "react";
import { Check, GitFork, Layers, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Select } from "./ui/input";
import { Badge } from "./ui/badge";
import type { AppData } from "../hooks/useAppData";
import type { InvestigationsApi } from "../hooks/useInvestigations";
import { ROLE_COLOR, TARGET_ROLES, type Evidence, type Investigation, type InvestigationTarget, type OrgGroup } from "../lib/investigation";
import { GROUP_COLORS } from "../lib/orgBoard";
import { compareInvestigations, proposeHierarchy } from "../lib/hierarchy";
import { formatBR } from "../lib/dates";

type Base = { data: AppData; api: InvestigationsApi; inv: Investigation; targets: InvestigationTarget[] };

/** Itens 3 e 4: sugere a função de cada alvo e monta a hierarquia pelo histórico; o analista confere e aplica. */
export function HierarchyModal({ open, onClose, data, api, targets }: Base & { open: boolean; onClose: () => void }) {
  const proposal = useMemo(() => (open ? proposeHierarchy(targets, data.authors, data.authorReports, api.items, data.authorPhotos) : []), [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rows, setRows] = useState<{ id: string; role: string; parentId: string; area: string; on: boolean }[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setRows(proposal.map((p) => ({ id: p.target.id, role: p.role, parentId: p.parentId, area: p.area, on: p.role !== p.target.role || p.parentId !== p.target.parentId || p.area !== p.target.area })));
  }, [open, proposal]);
  const nameOf = (id: string) => data.authors.find((a) => a.id === targets.find((t) => t.id === id)?.authorId)?.name || "—";
  const set = (id: string, v: Partial<(typeof rows)[number]>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...v, on: true } : x)));
  const changed = rows.filter((r) => r.on);

  async function apply() {
    setBusy(true);
    const ok = await api.applyTargets(changed.map((r) => ({ target: targets.find((t) => t.id === r.id)!, role: r.role, parentId: r.parentId, area: r.area })));
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="xl" eyebrow="Organograma" title={<span className="inline-flex items-center gap-2"><Sparkles className="h-5 w-5 text-pm-gold-light" />Sugerir funções e hierarquia</span>}>
      <div className="space-y-3 text-sm">
        <p className="text-pm-muted">Proposta montada pelos BOs e pelos <b>indícios</b> (levantamentos, vestígios, fontes que citam o alvo e fotos de levantamento — palavras como "olheiro", "gerente", "motorista", "receptador"). Sem indício, vale a estatística: quem tem mais parceiros dentro do dossiê e mais BOs em comum tende à liderança; cada um fica abaixo do parceiro mais forte acima dele. <b>Confira e ajuste</b> antes de aplicar — só vão as linhas marcadas.</p>
        <div className="overflow-auto rounded-sm border border-pm-line">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-pm-black text-[10px] uppercase tracking-wider text-pm-gold-light">
              <tr><th className="p-2 w-8"></th><th className="p-2">Alvo</th><th className="p-2">Por quê</th><th className="p-2 w-40">Função</th><th className="p-2 w-52">Superior</th><th className="p-2 w-44">Área de atuação</th></tr>
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
                    <td className="p-2">
                      <input className="h-8 w-full rounded-sm border border-pm-line bg-white px-2 text-xs" value={r.area} placeholder="bairro / local" onChange={(e) => set(r.id, { area: e.target.value })} />
                      {p.areaWhy && <p className="mt-0.5 text-[10px] text-pm-muted">{p.areaWhy}</p>}
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

/** Núcleos do organograma (ex.: "Pessoal do Rio", "Os hackers") com as atividades de cada um. */
export function GroupsModal({ open, onClose, api, inv, targets }: Base & { open: boolean; onClose: () => void }) {
  const [list, setList] = useState<(OrgGroup & { orig?: string })[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setList(inv.orgGroups.map((g) => ({ ...g, orig: g.name }))); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const upd = (i: number, v: Partial<OrgGroup>) => setList((l) => l.map((g, k) => (k === i ? { ...g, ...v } : g)));
  const count = (name: string) => targets.filter((t) => t.cluster === name).length;

  async function save() {
    const names = list.map((g) => g.name.trim().toUpperCase());
    if (names.some((n) => !n)) { window.alert("Dê um nome a cada núcleo."); return; }
    if (new Set(names).size !== names.length) { window.alert("Há núcleos com o mesmo nome."); return; }
    setBusy(true);
    const clean = list.map((g, i) => ({ name: names[i], activities: g.activities.trim(), color: g.color || GROUP_COLORS[i % GROUP_COLORS.length] }));
    // Renomeados: leva os alvos junto; apagados: voltam ao núcleo automático.
    const renames = new Map(list.filter((g) => g.orig).map((g) => [g.orig!, g.name.trim().toUpperCase()]));
    for (const t of targets.filter((x) => x.cluster)) {
      const next = renames.get(t.cluster) ?? (names.includes(t.cluster) ? t.cluster : "");
      if (next !== t.cluster) await api.updateTarget(t, { cluster: next });
    }
    const ok = await api.updateInvestigation(inv, { orgGroups: clean }, "Núcleos salvos.");
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" eyebrow="Organograma" title={<span className="inline-flex items-center gap-2"><Layers className="h-5 w-5 text-pm-gold-light" />Núcleos do grupo</span>}>
      <div className="space-y-3 text-sm">
        <p className="text-pm-muted">Sem núcleo próprio, cada alvo cai no núcleo da função (Liderança, Operadores financeiros, Executores…). Crie núcleos para separar como o grupo se organiza de verdade — ex.: <i>"Pessoal do Rio"</i>, <i>"Os meninos (hackers)"</i> — e liste as atividades criminosas de cada um. Depois, arraste os alvos para dentro do quadro ou escolha o núcleo na lista de alvos.</p>
        {list.map((g, i) => (
          <div key={i} className="grid gap-2 rounded-sm border border-pm-line bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <input className="h-9 min-w-0 flex-1 rounded-sm border border-pm-line px-2 font-bold uppercase" value={g.name} placeholder="Nome do núcleo" onChange={(e) => upd(i, { name: e.target.value })} />
              <div className="flex gap-1">{GROUP_COLORS.map((c) => <button key={c} type="button" title="Cor" onClick={() => upd(i, { color: c })} className={`h-6 w-6 rounded-sm border-2 ${(g.color || GROUP_COLORS[i % GROUP_COLORS.length]) === c ? "border-pm-black" : "border-transparent"}`} style={{ background: c }} />)}</div>
              <Badge>{count(g.name)} alvo(s)</Badge>
              <Button size="icon" variant="ghost" title="Apagar núcleo" onClick={() => setList((l) => l.filter((_, k) => k !== i))}><Trash2 /></Button>
            </div>
            <textarea className="min-h-[64px] rounded-sm border border-pm-line p-2 text-xs" placeholder={"Atividades criminosas (uma por linha)\nEx.: Furto de celulares no hipercentro\nVenda dos aparelhos na feira"} value={g.activities} onChange={(e) => upd(i, { activities: e.target.value })} />
          </div>
        ))}
        <Button onClick={() => setList((l) => [...l, { name: "", activities: "", color: GROUP_COLORS[l.length % GROUP_COLORS.length] }])}><Plus />Novo núcleo</Button>
        <div className="flex justify-end gap-2 border-t border-pm-line pt-3">
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={busy} onClick={save}><Check />Salvar núcleos</Button>
        </div>
      </div>
    </Modal>
  );
}

/** Indícios da função e da área de atuação: levantamentos, vestígios, fontes e observações de campo. */
export function EvidenceModal({ target, onClose, data, api, inv }: Omit<Base, "targets"> & { target: InvestigationTarget | null; onClose: () => void }) {
  const [form, setForm] = useState({ source: "", note: "", date: "", role: "", area: "", apply: true });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm({ source: "", note: "", date: new Date().toISOString().slice(0, 10), role: "", area: "", apply: true }); }, [target?.id]);
  if (!target) return null;
  const t = api.targets.find((x) => x.id === target.id) || target;
  const author = data.authors.find((a) => a.id === t.authorId);
  const items = api.items.filter((i) => i.investigationId === inv.id);
  const cited = items.filter((i) => i.authorIds.includes(t.authorId));
  const photos = data.authorPhotos.filter((p) => p.authorId === t.authorId && (p.category === "levantamento" || p.category === "ocorrencia"));
  const sources = [
    ...cited.map((i) => `${i.kind}: ${i.title}${i.reference ? ` (${i.reference})` : ""}`),
    ...items.filter((i) => !cited.includes(i)).map((i) => `${i.kind}: ${i.title}${i.reference ? ` (${i.reference})` : ""}`),
    ...photos.map((p) => `Foto de ${p.category === "levantamento" ? "levantamento" : "ocorrência"}: ${p.description || p.fileName}`),
  ];

  async function add() {
    if (!form.note.trim()) { window.alert("Descreva o que o vestígio/levantamento indica."); return; }
    setBusy(true);
    const ev: Evidence = { id: (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`), source: form.source || "Observação de campo", note: form.note.trim(), date: form.date, ...(form.role ? { role: form.role } : {}), ...(form.area.trim() ? { area: form.area.trim().toUpperCase() } : {}) };
    const values: Partial<InvestigationTarget> = { evidence: [...t.evidence, ev] };
    if (form.apply && form.role) values.role = form.role;
    if (form.apply && form.area.trim()) values.area = form.area.trim().toUpperCase();
    await api.updateTarget(t, values);
    setBusy(false);
    setForm({ source: "", note: "", date: form.date, role: "", area: "", apply: true });
  }
  const remove = (id: string) => api.updateTarget(t, { evidence: t.evidence.filter((e) => e.id !== id) });

  return (
    <Modal open={Boolean(target)} onClose={onClose} size="lg" eyebrow="Indícios da função e da área de atuação" title={author?.name || "Alvo"}>
      <div className="space-y-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-sm border border-pm-line bg-pm-cream/60 p-2"><p className="pm-label">Função atual</p><p className="font-bold">{t.role}</p></div>
          <div className="rounded-sm border border-pm-line bg-pm-cream/60 p-2"><p className="pm-label">Área de atuação</p><p className="font-bold">{t.area || "—"}</p></div>
          <div className="rounded-sm border border-pm-line bg-pm-cream/60 p-2"><p className="pm-label">Indícios</p><p className="font-bold">{t.evidence.length}</p></div>
        </div>
        {t.evidence.length > 0 && (
          <div className="space-y-1.5">
            {t.evidence.map((e) => (
              <div key={e.id} className="flex gap-2 rounded-sm border border-pm-line bg-white p-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase text-pm-gold-dark">{e.source}{e.date ? ` · ${formatBR(e.date)}` : ""}</p>
                  <p>{e.note}</p>
                  {(e.role || e.area) && <p className="mt-0.5 text-xs text-pm-muted">Indica: {[e.role && `função ${e.role}`, e.area && `atua em ${e.area}`].filter(Boolean).join(" · ")}</p>}
                </div>
                <Button size="icon" variant="ghost" title="Remover" onClick={() => remove(e.id)}><Trash2 /></Button>
              </div>
            ))}
          </div>
        )}
        <div className="grid gap-2 rounded-sm border border-dashed border-pm-gold p-3">
          <p className="pm-label">Novo indício</p>
          <Select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            <option value="">Observação de campo / levantamento sem fonte cadastrada</option>
            {sources.map((s) => <option key={s} value={s}>{s.length > 110 ? `${s.slice(0, 110)}…` : s}</option>)}
          </Select>
          <textarea className="min-h-[70px] rounded-sm border border-pm-line p-2" placeholder="O que foi observado. Ex.: levantamento de 12/11 flagrou o alvo de bicicleta avisando a chegada da viatura na Rua dos Caetés (olheiro)." value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="grid gap-1 text-xs"><span className="pm-label">Data</span><input type="date" className="h-9 rounded-sm border border-pm-line px-2" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            <label className="grid gap-1 text-xs"><span className="pm-label">Indica a função</span><Select className="h-9" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="">—</option>{TARGET_ROLES.map((r) => <option key={r}>{r}</option>)}</Select></label>
            <label className="grid gap-1 text-xs"><span className="pm-label">Indica local de atuação</span><input className="h-9 rounded-sm border border-pm-line px-2 uppercase" placeholder="bairro / ponto" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></label>
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" className="h-4 w-4 accent-[#7A6C45]" checked={form.apply} onChange={(e) => setForm({ ...form, apply: e.target.checked })} />Já aplicar a função e o local indicados no organograma</label>
          <Button variant="primary" disabled={busy} onClick={add}><Plus />Registrar indício</Button>
        </div>
      </div>
    </Modal>
  );
}
