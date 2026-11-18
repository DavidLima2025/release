import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Combine, Loader2, Search, UserRound } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import type { AppData } from "../hooks/useAppData";
import type { Author } from "../lib/domain";
import { formatBR } from "../lib/dates";
import { normName } from "../lib/photoMatch";

// ---------- Detecção de repetidos ----------
const STOP = new Set(["DE", "DA", "DO", "DAS", "DOS", "E"]);
const nameKey = (n: string) => normName(n).split(" ").filter((w) => w && !STOP.has(w)).join(" ");
const docNumbers = (d: string) => (d.match(/\d[\d.\-]{5,}\d/g) || []).map((x) => x.replace(/\D/g, "")).filter((x) => x.length >= 7);

export type DuplicateGroup = { authors: Author[]; reason: string };

/** Mesmo nome (sem acentos e preposições) ou mesmo RG/CPF = provável repetido. */
export function findDuplicates(authors: Author[]): DuplicateGroup[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => { const p = parent.get(x) || x; if (p === x) return x; const r = find(p); parent.set(x, r); return r; };
  const union = (a: string, b: string) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  const why = new Map<string, Set<string>>();
  const mark = (ids: string[], reason: string) => { ids.forEach((id) => { const s = why.get(id) || new Set(); s.add(reason); why.set(id, s); }); };
  const byName = new Map<string, string[]>();
  const byDoc = new Map<string, string[]>();
  for (const a of authors) {
    const k = nameKey(a.name);
    if (k.split(" ").length >= 2) byName.set(k, [...(byName.get(k) || []), a.id]);
    for (const d of docNumbers(a.document)) byDoc.set(d, [...(byDoc.get(d) || []), a.id]);
  }
  for (const ids of byName.values()) if (ids.length > 1) { ids.slice(1).forEach((id) => union(ids[0], id)); mark(ids, "mesmo nome"); }
  for (const ids of byDoc.values()) {
    const uniq = [...new Set(ids)];
    if (uniq.length > 1) { uniq.slice(1).forEach((id) => union(uniq[0], id)); mark(uniq, "mesmo documento"); }
  }
  const groups = new Map<string, Author[]>();
  for (const a of authors) if (why.has(a.id)) { const r = find(a.id); groups.set(r, [...(groups.get(r) || []), a]); }
  return [...groups.values()].filter((g) => g.length > 1).map((g) => ({
    authors: g, reason: [...new Set(g.flatMap((a) => [...(why.get(a.id) || [])]))].join(" e "),
  })).sort((a, b) => a.authors[0].name.localeCompare(b.authors[0].name, "pt-BR"));
}

// ---------- Campos que podem ser escolhidos ----------
type FieldKey = "name" | "alias" | "birthDate" | "motherName" | "fatherName" | "document" | "address" | "neighborhood" | "city" | "crimes" | "categoryId" | "status" | "riskLevel";
const FIELDS: [FieldKey, string][] = [
  ["name", "Nome"], ["alias", "Vulgo"], ["birthDate", "Nascimento"], ["motherName", "Mãe"], ["fatherName", "Pai"], ["document", "Documentos"],
  ["address", "Endereço"], ["neighborhood", "Bairro"], ["city", "Cidade"], ["crimes", "Crimes / modus"], ["categoryId", "Pasta"], ["status", "Situação"], ["riskLevel", "Risco"],
];
/** Campos em que dá para juntar os valores de todos os cadastros. */
const JOINABLE: FieldKey[] = ["alias", "document", "address", "crimes"];
const JOIN = "__juntar__";
const same = (a: string, b: string) => normName(a) === normName(b);

function joinValues(field: FieldKey, values: string[]) {
  const parts: string[] = [];
  for (const v of values) for (const piece of v.split(field === "document" || field === "alias" ? /\s*[·;\/]\s*|\s+\/\s+/ : /\s*;\s*/)) {
    const p = piece.trim();
    if (p && !parts.some((x) => same(x, p))) parts.push(p);
  }
  return parts.join(field === "document" ? " · " : field === "alias" ? " / " : "; ");
}

const filled = (a: Author) => FIELDS.filter(([k]) => String((a as any)[k] || "").trim()).length;

type Props = { open: boolean; authors: Author[]; data: AppData; onClose: () => void; onDone?: (keptId: string) => void };

/** Tela de união: escolhe o cadastro principal e, campo a campo, o que fica. */
export function MergeModal({ open, authors, data, onClose, onDone }: Props) {
  const [include, setInclude] = useState<Set<string>>(new Set());
  const [keepId, setKeepId] = useState("");
  const [choice, setChoice] = useState<Partial<Record<FieldKey, string>>>({});
  const [busy, setBusy] = useState(false);
  const photosOf = (id: string) => data.authorPhotos.filter((p) => p.authorId === id);
  const reportsOf = (id: string) => data.authorReports.filter((p) => p.authorId === id).length;
  const folderName = (id: string) => data.authorCategories.find((f) => f.id === id)?.name || "Sem pasta";

  useEffect(() => {
    if (!open) return;
    setInclude(new Set(authors.map((a) => a.id)));
    // Principal sugerido: o mais completo (fotos + campos preenchidos).
    const best = [...authors].sort((a, b) => (photosOf(b.id).length * 3 + filled(b)) - (photosOf(a.id).length * 3 + filled(a)))[0];
    setKeepId(best?.id || "");
    setChoice({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, authors.map((a) => a.id).join(",")]);

  const chosen = authors.filter((a) => include.has(a.id));
  const keep = chosen.find((a) => a.id === keepId) || chosen[0];
  const others = chosen.filter((a) => a.id !== keep?.id);

  /** Valores distintos por campo (na ordem: principal primeiro). */
  const options = useMemo(() => {
    const ordered = keep ? [keep, ...others] : chosen;
    const map = {} as Record<FieldKey, { value: string; from: Author }[]>;
    for (const [k] of FIELDS) {
      const list: { value: string; from: Author }[] = [];
      for (const a of ordered) {
        const v = String((a as any)[k] || "").trim();
        if (v && !list.some((x) => (k === "categoryId" ? x.value === v : same(x.value, v)))) list.push({ value: v, from: a });
      }
      map[k] = list;
    }
    return map;
  }, [keep?.id, others.map((a) => a.id).join(","), chosen.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const valueOf = (k: FieldKey) => {
    const opts = options[k] || [];
    const c = choice[k];
    if (c === JOIN) return joinValues(k, opts.map((o) => o.value));
    if (c !== undefined) return c;
    // Padrão: documentos e vulgos juntos; nos demais, o do principal (ou o primeiro preenchido).
    if ((k === "document" || k === "alias") && opts.length > 1) return joinValues(k, opts.map((o) => o.value));
    return opts[0]?.value || "";
  };
  const show = (k: FieldKey, v: string) => (k === "birthDate" ? formatBR(v) : k === "categoryId" ? folderName(v) : v);

  async function merge() {
    if (!keep || !others.length) return;
    if (!window.confirm(`Unir ${others.length} cadastro(s) ao card de ${keep.name}? Os repetidos serão apagados; fotos, relatórios, investigações e BOs passam para o principal.`)) return;
    const fields: Record<string, any> = {};
    for (const [k] of FIELDS) fields[k] = valueOf(k);
    const notes = [keep.notes, ...others.map((o) => o.notes)].map((n) => (n || "").trim()).filter(Boolean);
    fields.notes = [...new Set(notes), `Cadastro unido com: ${others.map((o) => `${o.name}${o.document ? ` (${o.document})` : ""}`).join("; ")} em ${new Date().toLocaleDateString("pt-BR")}.`].join("\n\n");
    const home = [keep, ...others].find((a) => a.homeLat != null);
    if (home && keep.homeLat == null) { fields.homeLat = home.homeLat; fields.homeLng = home.homeLng; }
    setBusy(true);
    const ok = await data.mergeAuthors(keep.id, others.map((o) => o.id), fields);
    setBusy(false);
    if (ok) { onDone?.(keep.id); onClose(); }
  }

  const conflicts = FIELDS.filter(([k]) => (options[k] || []).length > 1);
  const sameNameOnly = chosen.length > 1 && conflicts.some(([k]) => k === "birthDate" || k === "motherName");

  return (
    <Modal open={open} onClose={() => !busy && onClose()} size="xl" eyebrow="Banco de alvos" title={<span className="inline-flex items-center gap-2"><Combine className="h-5 w-5 text-pm-gold-light" />Unir cadastros</span>}
      footer={<>
        <span className="mr-auto self-center text-xs text-pm-muted">{others.length ? `${others.length} cadastro(s) serão unidos ao principal e apagados.` : "Marque pelo menos dois cadastros."}</span>
        <Button onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button variant="primary" onClick={merge} disabled={busy || !others.length}>{busy ? <Loader2 className="animate-spin" /> : <Combine />}Unir cadastros</Button>
      </>}>
      <div className="space-y-4">
        <p className="text-sm text-pm-muted">Escolha o <b>cadastro principal</b> (ele fica; os outros são apagados). Fotos, relatórios, vínculos em investigações e BOs de todos vão para o principal. Onde os dados forem diferentes, escolha qual fica.</p>
        {sameNameOnly && (
          <p className="flex items-start gap-2 rounded-sm border-l-4 border-status-risk bg-status-risk/10 px-3 py-2 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6200]" />Nascimento ou mãe diferentes: pode ser <b>homônimo</b> (outra pessoa com o mesmo nome). Confira antes de unir.</p>
        )}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {authors.map((a) => {
            const ph = photosOf(a.id);
            const on = include.has(a.id);
            const isKeep = keep?.id === a.id;
            return (
              <div key={a.id} className={`rounded-sm border bg-white p-2.5 ${isKeep ? "border-pm-black ring-2 ring-pm-gold" : on ? "border-pm-line" : "border-pm-line opacity-50"}`}>
                <div className="flex gap-2.5">
                  <div className="grid h-20 w-16 shrink-0 place-items-center overflow-hidden rounded-sm bg-pm-sand">
                    {ph[0] ? <img src={data.getIntelFileUrl(ph[0].filePath)} alt="" className="h-full w-full object-cover" /> : <UserRound className="h-7 w-7 text-pm-muted" />}
                  </div>
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="truncate text-sm font-black uppercase">{a.name}</p>
                    <p className="truncate text-pm-muted">{a.document || "sem documento"}</p>
                    <p className="text-pm-muted">{folderName(a.categoryId)} · {ph.length} foto(s) · {reportsOf(a.id)} arquivo(s)</p>
                    {a.birthDate && <p className="text-pm-muted">Nasc. {formatBR(a.birthDate)}</p>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <label className="flex cursor-pointer items-center gap-1.5 font-bold"><input type="radio" name="keep" className="accent-[#7A6C45]" checked={isKeep} disabled={!on} onChange={() => setKeepId(a.id)} />Principal</label>
                  {authors.length > 2 && <label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" className="accent-[#7A6C45]" checked={on} disabled={isKeep} onChange={() => setInclude((s) => { const n = new Set(s); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })} />Incluir</label>}
                  {isKeep && <Badge tone="gold">fica</Badge>}
                </div>
              </div>
            );
          })}
        </div>

        {chosen.length > 1 && (
          <div className="overflow-x-auto rounded-sm border border-pm-line bg-white">
            <table className="w-full text-sm">
              <thead><tr className="bg-pm-cream text-left text-[11px] uppercase tracking-wider text-pm-muted"><th className="px-3 py-2">Campo</th><th className="px-3 py-2">Fica assim</th></tr></thead>
              <tbody>
                {FIELDS.map(([k, label]) => {
                  const opts = options[k] || [];
                  if (!opts.length) return null;
                  const conflict = opts.length > 1;
                  const current = choice[k] ?? ((k === "document" || k === "alias") && conflict ? JOIN : opts[0].value);
                  return (
                    <tr key={k} className="border-t border-pm-line align-top">
                      <td className="w-36 px-3 py-2 font-bold">{label}{conflict && <span className="ml-1 text-status-late">•</span>}</td>
                      <td className="px-3 py-2">
                        {!conflict ? <span>{show(k, opts[0].value)}</span> : (
                          <div className="space-y-1">
                            {opts.map((o) => (
                              <label key={o.value} className="flex cursor-pointer items-start gap-2">
                                <input type="radio" name={`f-${k}`} className="mt-1 accent-[#7A6C45]" checked={current === o.value} onChange={() => setChoice((c) => ({ ...c, [k]: o.value }))} />
                                <span><b>{show(k, o.value)}</b> <span className="text-xs text-pm-muted">— {o.from.id === keep?.id ? "do principal" : `do outro cadastro (${folderName(o.from.categoryId)}${o.from.document ? ` · ${o.from.document}` : ""})`}</span></span>
                              </label>
                            ))}
                            {JOINABLE.includes(k) && (
                              <label className="flex cursor-pointer items-start gap-2">
                                <input type="radio" name={`f-${k}`} className="mt-1 accent-[#7A6C45]" checked={current === JOIN} onChange={() => setChoice((c) => ({ ...c, [k]: JOIN }))} />
                                <span>Juntar todos: <b>{joinValues(k, opts.map((o) => o.value))}</b></span>
                              </label>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-pm-line align-top"><td className="px-3 py-2 font-bold">Observações</td><td className="px-3 py-2 text-xs text-pm-muted">As observações de todos são juntadas, com o registro da união.</td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Lista de possíveis repetidos encontrados no banco. */
export function DuplicatesModal({ open, data, onClose, onMerge }: { open: boolean; data: AppData; onClose: () => void; onMerge: (authors: Author[]) => void }) {
  const groups = useMemo(() => (open ? findDuplicates(data.authors) : []), [open, data.authors]);
  return (
    <Modal open={open} onClose={onClose} size="lg" eyebrow="Banco de alvos" title={<span className="inline-flex items-center gap-2"><Combine className="h-5 w-5 text-pm-gold-light" />Cadastros repetidos</span>}>
      {groups.length === 0 ? (
        <p className="flex items-center gap-2 rounded-sm bg-status-done/10 px-3 py-3 text-sm font-semibold text-status-done"><CheckCircle2 className="h-4 w-4" />Nenhum repetido encontrado (mesmo nome ou mesmo RG/CPF).</p>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-pm-muted">{groups.length} grupo(s) com o mesmo nome ou o mesmo RG/CPF. Confira e una os que forem a mesma pessoa.</p>
          {groups.map((g) => (
            <div key={g.authors.map((a) => a.id).join("-")} className="flex flex-wrap items-center gap-3 rounded-sm border border-pm-line bg-white p-3">
              <div className="min-w-0 flex-1">
                <p className="font-black uppercase">{g.authors[0].name}{g.authors.some((a) => !same(a.name, g.authors[0].name)) ? " …" : ""}</p>
                <p className="text-xs text-pm-muted">{g.authors.length} cadastros · {g.reason}</p>
                <div className="mt-1 flex flex-wrap gap-1">{g.authors.map((a) => <Badge key={a.id}>{a.name.split(" ")[0]} · {a.document || "sem doc."}</Badge>)}</div>
              </div>
              <Button size="sm" variant="gold" onClick={() => onMerge(g.authors)}><Combine />Revisar e unir</Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/** Escolher com qual cadastro unir (a partir do menu do card). */
export function MergePicker({ author, data, onClose, onPick }: { author: Author | null; data: AppData; onClose: () => void; onPick: (other: Author) => void }) {
  const [q, setQ] = useState("");
  useEffect(() => { if (author) setQ(author.name.split(" ").slice(0, 2).join(" ")); }, [author]);
  if (!author) return null;
  const key = normName(q);
  const list = data.authors.filter((a) => a.id !== author.id && (!key || normName(`${a.name} ${a.alias} ${a.document}`).includes(key))).slice(0, 40);
  return (
    <Modal open={Boolean(author)} onClose={onClose} size="md" eyebrow="Unir cadastros" title={`Unir ${author.name} com…`}>
      <div className="relative mb-3"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-pm-muted" /><Input className="pl-9" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome, vulgo ou documento" /></div>
      <div className="max-h-[50vh] space-y-1 overflow-auto">
        {list.length === 0 && <p className="text-sm text-pm-muted">Nenhum cadastro encontrado.</p>}
        {list.map((a) => (
          <button key={a.id} type="button" onClick={() => onPick(a)} className="flex w-full items-center justify-between gap-2 rounded-sm border border-pm-line bg-white px-3 py-2 text-left hover:border-pm-gold">
            <span className="min-w-0"><b className="block truncate text-sm uppercase">{a.name}</b><span className="block truncate text-xs text-pm-muted">{[a.alias && `"${a.alias}"`, a.document, data.authorCategories.find((f) => f.id === a.categoryId)?.name].filter(Boolean).join(" · ")}</span></span>
            <Combine className="h-4 w-4 shrink-0 text-pm-gold-dark" />
          </button>
        ))}
      </div>
    </Modal>
  );
}
