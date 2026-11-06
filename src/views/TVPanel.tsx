import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { PmmgShield } from "../components/Brand";
import { STATUS_COLOR } from "../components/ui/badge";
import { STATUSES, countByStatus, isOpen } from "../lib/domain";
import { formatBR } from "../lib/dates";
import type { AppData } from "../hooks/useAppData";

export function TVPanel({ data, onClose }: { data: AppData; onClose: () => void }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    return () => { window.clearInterval(timer); window.removeEventListener("keydown", onKey); if (document.fullscreenElement) document.exitFullscreen?.(); };
  }, [onClose]);

  const { tasks, users, today } = data;
  const counts = countByStatus(tasks);
  const late = tasks.filter((t) => t.status === "Atrasada").sort((a, b) => a.overdueDate.localeCompare(b.overdueDate));
  const risk = tasks.filter((t) => t.status === "Risco de prazo").sort((a, b) => a.overdueDate.localeCompare(b.overdueDate));
  const todays = tasks.filter((t) => t.date === today);
  const load = users.filter((u) => u.status === "Ativo").map((u) => ({ label: u.warName || u.name, total: tasks.filter((t) => t.responsibleId === u.id && isOpen(t)).length }))
    .filter((r) => r.total).sort((a, b) => b.total - a.total).slice(0, 6);

  const column = (title: string, color: string, list: typeof late, empty: string) => (
    <div className="flex min-h-0 flex-col border border-white/10 bg-white/[0.03]">
      <p className="border-b-2 px-5 py-3 text-sm font-black uppercase tracking-[0.2em]" style={{ borderColor: color, color }}>{title} · {list.length}</p>
      <div className="space-y-2 overflow-hidden p-4">
        {list.slice(0, 7).map((t) => (
          <div key={t.id} className="border-l-4 bg-white/5 px-3 py-2" style={{ borderColor: color }}>
            <p className="truncate text-lg font-bold">{t.title}</p>
            <p className="text-sm text-white/60">{t.responsible} · prazo {formatBR(t.overdueDate)}</p>
          </div>
        ))}
        {list.length === 0 && <p className="text-white/50">{empty}</p>}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex flex-col gap-5 overflow-auto bg-pm-black p-6 text-white">
      <header className="pm-stripe flex items-center justify-between gap-6 border-b border-pm-gold/40 pb-5 pr-4">
        <div className="flex items-center gap-5">
          <PmmgShield className="h-20 w-auto" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-pm-gold-light">● Ao vivo · Seção de Inteligência</p>
            <h1 className="font-display text-5xl font-black uppercase tracking-tight">SI 6ª CIA</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-display text-5xl font-black tabular-nums">{now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
            <p className="text-sm uppercase tracking-widest text-white/60">{now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-12 w-12 place-items-center border border-white/20 hover:bg-white/10" aria-label="Fechar"><X className="h-6 w-6" /></button>
        </div>
      </header>

      <section className="grid grid-cols-5 gap-4">
        {STATUSES.map((s) => (
          <div key={s} className="border-t-4 bg-white/5 p-5" style={{ borderColor: STATUS_COLOR[s] }}>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-white/70">{s}</p>
            <p className="mt-2 font-display text-7xl font-black leading-none tabular-nums">{counts[s]}</p>
          </div>
        ))}
      </section>

      <section className="grid min-h-0 flex-1 grid-cols-3 gap-4">
        {column("Atrasadas", "#E5544B", late, "Nenhuma demanda atrasada.")}
        {column("Risco de prazo", "#E0A82E", risk, "Nenhuma demanda em risco.")}
        {column("Demandas de hoje", "#CFC29B", todays, "Nada agendado para hoje.")}
      </section>

      <section className="grid grid-cols-6 gap-3">
        {load.map((r) => (
          <div key={r.label} className="bg-white/5 px-4 py-3 text-center">
            <p className="font-display text-4xl font-black">{r.total}</p>
            <p className="truncate text-sm uppercase tracking-wider text-white/60">{r.label}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
