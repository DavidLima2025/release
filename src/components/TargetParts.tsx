import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type * as React from "react";
import { FolderInput, FolderOpen, Loader2 } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/input";
import type { AuthorCategory } from "../lib/domain";

export type MenuItem = { label: string; icon?: any; onClick: () => void; danger?: boolean; disabled?: boolean; hint?: string } | "sep";

/** Menu de opções que abre no ponto do clique (botão esquerdo ou direito), como um menu de contexto. */
export function ContextMenu({ at, title, items, onClose }: { at: { x: number; y: number } | null; title?: string; items: MenuItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!at || !ref.current) { setPos(null); return; }
    const r = ref.current.getBoundingClientRect();
    setPos({ left: Math.max(8, Math.min(at.x, window.innerWidth - r.width - 8)), top: Math.max(8, Math.min(at.y, window.innerHeight - r.height - 8)) });
  }, [at]);

  useEffect(() => {
    if (!at) return undefined;
    const down = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const close = () => onClose();
    window.addEventListener("mousedown", down);
    window.addEventListener("touchstart", down);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", down); window.removeEventListener("touchstart", down);
      window.removeEventListener("keydown", key); window.removeEventListener("resize", close); window.removeEventListener("scroll", close, true);
    };
  }, [at, onClose]);

  if (!at) return null;
  return (
    <div ref={ref} role="menu" className="fixed z-[90] min-w-56 overflow-hidden rounded-sm border border-pm-line bg-white py-1 shadow-2xl"
      style={{ left: pos?.left ?? at.x, top: pos?.top ?? at.y, visibility: pos ? "visible" : "hidden" }}>
      {title && <p className="truncate border-b border-pm-line px-3 pb-1.5 pt-1 text-[11px] font-black uppercase tracking-wider text-pm-muted">{title}</p>}
      {items.map((item, i) => item === "sep"
        ? <div key={i} className="my-1 border-t border-pm-line" />
        : (
          <button key={i} type="button" role="menuitem" disabled={item.disabled} onClick={() => { onClose(); item.onClick(); }}
            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm font-semibold disabled:opacity-40 ${item.danger ? "text-status-late hover:bg-red-50" : "text-pm-ink hover:bg-pm-cream"}`}>
            {item.icon && <item.icon className="h-4 w-4 shrink-0" />}<span className="flex-1">{item.label}</span>{item.hint && <span className="text-[11px] font-normal text-pm-muted">{item.hint}</span>}
          </button>
        ))}
    </div>
  );
}

/** Criar ou renomear pasta. */
export function FolderModal({ open, folder, onClose, onSave }: { open: boolean; folder: AuthorCategory | null; onClose: () => void; onSave: (v: { name: string; description: string }) => Promise<boolean> }) {
  const [form, setForm] = useState({ name: "", description: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setForm({ name: folder?.name || "", description: folder?.description || "" }); }, [open, folder]);
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    const ok = await onSave(form);
    setBusy(false);
    if (ok) onClose();
  };
  return (
    <Modal open={open} onClose={onClose} size="md" eyebrow="Banco de alvos" title={folder ? "Renomear pasta" : "Nova pasta"}
      footer={<><Button onClick={onClose}>Cancelar</Button><Button variant="primary" onClick={() => submit()} disabled={busy || !form.name.trim()}>{busy ? <Loader2 className="animate-spin" /> : <FolderOpen />}{folder ? "Salvar" : "Criar pasta"}</Button></>}>
      <form className="space-y-3" onSubmit={submit}>
        <Field label="Nome da pasta"><Input autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Arrombamento" /></Field>
        <Field label="Observação (opcional)"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}

/** Escolher a pasta de destino de um ou vários alvos. */
export function MoveModal({ open, count, names, folders, currentId, onClose, onMove }: {
  open: boolean; count: number; names: string[]; folders: AuthorCategory[]; currentId?: string; onClose: () => void; onMove: (folderId: string | null) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState("");
  const move = async (id: string | null) => { setBusy(id ?? "none"); const ok = await onMove(id); setBusy(""); if (ok) onClose(); };
  return (
    <Modal open={open} onClose={onClose} size="md" eyebrow="Banco de alvos" title={count === 1 ? "Mover alvo" : `Mover ${count} alvos`}>
      <p className="mb-3 text-sm text-pm-muted">{names.slice(0, 4).join(", ")}{names.length > 4 ? ` e mais ${names.length - 4}` : ""} → escolha a pasta:</p>
      <div className="space-y-1.5">
        {folders.map((f) => (
          <button key={f.id} type="button" disabled={Boolean(busy) || f.id === currentId} onClick={() => move(f.id)}
            className="flex w-full items-center gap-3 rounded-sm border border-pm-line bg-white px-3 py-2.5 text-left font-bold hover:border-pm-gold disabled:opacity-50">
            {busy === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderInput className="h-4 w-4 text-pm-gold-dark" />}
            <span className="flex-1 truncate">{f.name}</span>{f.id === currentId && <span className="text-xs font-normal text-pm-muted">pasta atual</span>}
          </button>
        ))}
        <button type="button" disabled={Boolean(busy) || currentId === ""} onClick={() => move(null)} className="flex w-full items-center gap-3 rounded-sm border border-dashed border-pm-line px-3 py-2.5 text-left text-sm text-pm-muted hover:border-pm-gold disabled:opacity-50">
          <FolderOpen className="h-4 w-4" />Sem pasta
        </button>
      </div>
    </Modal>
  );
}
