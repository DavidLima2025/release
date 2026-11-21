import { createContext, useContext, useMemo, useState, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/input";
import { Modal } from "./ui/modal";
import type { InvestigationsApi } from "../hooks/useInvestigations";
import { TARGET_ROLES } from "../lib/investigation";
import { GROUP_COLORS, LEVEL_LABELS } from "../lib/orgBoard";
import { roleCatalogVersion, type RoleDef } from "../lib/roles";

type Manager = { open: () => void; version: number };
const Ctx = createContext<Manager | null>(null);
const MANAGE = "__manage_roles__";

/** Dá a todos os menus "Papel" o atalho para criar/excluir papéis e guarda a janela de gerenciar. */
export function RolesProvider({ api, enabled, children }: { api: InvestigationsApi; enabled: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const version = roleCatalogVersion();
  const value = useMemo<Manager | null>(() => (enabled ? { open: () => setOpen(true), version } : null), [enabled, version]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {enabled && <RolesModal open={open} onClose={() => setOpen(false)} api={api} />}
    </Ctx.Provider>
  );
}

/** Menu de papel: lista o catálogo e, no fim, "Criar / excluir papéis…". `empty` = texto da opção vazia (ex.: "—"). */
export function RoleSelect({ value, onChange, empty, className = "", style, disabled, title }: {
  value: string; onChange: (e: ChangeEvent<HTMLSelectElement>) => void; empty?: string; className?: string; style?: CSSProperties; disabled?: boolean; title?: string;
}) {
  const mgr = useContext(Ctx);
  const names = TARGET_ROLES;
  return (
    <Select value={value} className={className} style={style} disabled={disabled} title={title}
      onChange={(e) => { if (e.target.value === MANAGE) { mgr?.open(); return; } onChange(e); }}>
      {empty !== undefined && <option value="">{empty}</option>}
      {value && !names.includes(value) && <option value={value}>{value} (papel excluído)</option>}
      {names.map((r) => <option key={r} value={r}>{r}</option>)}
      {mgr && <option value={MANAGE}>⚙ Criar / excluir papéis…</option>}
    </Select>
  );
}

const NEW: { name: string; color: string; level: number; group: string } = { name: "", color: GROUP_COLORS[4], level: 2, group: "" };

function RolesModal({ open, onClose, api }: { open: boolean; onClose: () => void; api: InvestigationsApi }) {
  const [form, setForm] = useState(NEW);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<{ id: string; moveTo: string } | null>(null);

  const roles = api.roles;
  const uses = useMemo(() => {
    const m = new Map<string, { n: number; inv: Set<string> }>();
    for (const t of api.targets) { const u = m.get(t.role) || { n: 0, inv: new Set<string>() }; u.n += 1; u.inv.add(t.investigationId); m.set(t.role, u); }
    return m;
  }, [api.targets]);

  const create = async () => {
    setBusy(true);
    const ok = await api.addRole(form);
    setBusy(false);
    if (ok) setForm({ ...NEW, level: form.level });
  };
  const startDelete = (r: RoleDef) => {
    const others = roles.filter((x) => x.id !== r.id);
    setDel({ id: r.id || "", moveTo: (others.find((x) => x.name === "Associado") || others[0])?.name || "" });
  };
  const confirmDelete = async (r: RoleDef) => {
    setBusy(true);
    const ok = await api.deleteRole(r, del?.moveTo || "");
    setBusy(false);
    if (ok) setDel(null);
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" eyebrow="Organograma" title="Papéis dos alvos" footer={<Button onClick={onClose}>Fechar</Button>}>
      <div className="space-y-4 text-sm">
        <p className="text-pm-muted">Os papéis valem para <b>todas as investigações</b>. Cada papel tem uma <b>cor</b>, um <b>grau</b> (linha do quadro) e um <b>núcleo</b>; papéis com o mesmo núcleo ficam juntos no quadro. Excluir um papel não apaga os alvos: eles passam para o papel que você escolher.</p>

        <div className="space-y-1.5">
          {roles.map((r) => {
            const u = uses.get(r.name);
            const asking = del?.id === r.id && r.id;
            const others = roles.filter((x) => x.id !== r.id);
            return (
              <div key={r.id || r.name} className="rounded-sm border border-pm-line bg-white">
                <div className="flex flex-wrap items-center gap-2 p-2">
                  <span className="h-4 w-4 shrink-0 rounded-[3px]" style={{ background: r.color }} />
                  <b className="min-w-[120px] flex-1">{r.name}</b>
                  <span className="text-xs text-pm-muted">{r.level + 1}º grau · núcleo {(r.group || r.name.toUpperCase()).toLowerCase()}</span>
                  <span className="w-28 text-right text-xs font-semibold">{u ? `${u.n} alvo(s) · ${u.inv.size} inv.` : "sem uso"}</span>
                  <Button size="sm" variant="danger" disabled={busy || roles.length <= 1 || !r.id} title={roles.length <= 1 ? "Mantenha pelo menos um papel" : `Excluir o papel ${r.name}`}
                    onClick={() => (asking ? setDel(null) : startDelete(r))}>{asking ? <X /> : <Trash2 />}{asking ? "Cancelar" : "Excluir"}</Button>
                </div>
                {asking && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-pm-line bg-red-50/60 p-2 text-xs">
                    {u
                      ? <><span><b>{u.n} alvo(s)</b> em {u.inv.size} investigação(ões) usam este papel. Passar para:</span>
                        <Select className="h-8 w-52 text-xs" value={del?.moveTo || ""} onChange={(e) => setDel({ id: r.id!, moveTo: e.target.value })}>{others.map((x) => <option key={x.id} value={x.name}>{x.name}</option>)}</Select></>
                      : <span>Nenhum alvo usa este papel. Excluir “{r.name}”?</span>}
                    <Button size="sm" variant="danger" className="ml-auto" disabled={busy || (Boolean(u) && !del?.moveTo)} onClick={() => confirmDelete(r)}><Trash2 />{u ? "Excluir e mover os alvos" : "Excluir papel"}</Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-sm border border-dashed border-pm-gold p-3">
          <p className="pm-label">Novo papel</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs"><span className="font-bold uppercase text-pm-muted">Nome</span>
              <Input value={form.name} maxLength={40} placeholder="Ex.: Informante, Motorista, Pistoleiro…" onChange={(e) => setForm({ ...form, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && form.name.trim() && !busy && create()} /></label>
            <label className="grid gap-1 text-xs"><span className="font-bold uppercase text-pm-muted">Grau (linha no quadro)</span>
              <Select value={form.level} onChange={(e) => setForm({ ...form, level: Number(e.target.value) })}>{LEVEL_LABELS.map((l, i) => <option key={i} value={i}>{l}</option>)}</Select></label>
            <label className="grid gap-1 text-xs"><span className="font-bold uppercase text-pm-muted">Núcleo no quadro (opcional)</span>
              <Input value={form.group} maxLength={40} placeholder={form.name.trim() ? `automático: ${form.name.trim().toUpperCase()}` : "automático: o nome do papel"} onChange={(e) => setForm({ ...form, group: e.target.value })} /></label>
            <div className="grid gap-1 text-xs"><span className="font-bold uppercase text-pm-muted">Cor</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {GROUP_COLORS.map((c) => (
                  <button key={c} type="button" aria-label={`Cor ${c}`} onClick={() => setForm({ ...form, color: c })} className="grid h-7 w-7 place-items-center rounded-sm border border-pm-line" style={{ background: c }}>
                    {form.color.toLowerCase() === c.toLowerCase() && <Check className="h-4 w-4 text-white" />}
                  </button>
                ))}
                <input type="color" aria-label="Outra cor" className="h-7 w-9 cursor-pointer rounded-sm border border-pm-line bg-white p-0.5" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-pm-line px-2 py-1 text-xs font-bold uppercase text-white" style={{ background: form.color }}>{form.name.trim() || "Prévia"}</span>
            <Button variant="primary" className="ml-auto" disabled={busy || form.name.trim().length < 2} onClick={create}><Plus />Criar papel</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
