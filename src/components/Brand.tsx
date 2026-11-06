export function PmmgShield({ className = "h-12 w-auto" }: { className?: string }) {
  return <img src="/pmmg-logo.png" alt="Brasão PMMG" className={`${className} select-none drop-shadow-[0_4px_10px_rgba(0,0,0,.35)]`} draggable={false} />;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <PmmgShield className={compact ? "h-10 w-auto" : "h-14 w-auto"} />
      <div className="leading-none">
        <p className="font-display text-xl font-black uppercase tracking-tight text-white">SI 6ª CIA</p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-pm-gold-light">Seção de Inteligência</p>
      </div>
    </div>
  );
}

/** Rodapé com a linha de paralelogramos, como nos slides do modelo. */
export function PmFooterRule({ label = "SI 6ª CIA · 1º BPM · PMMG" }: { label?: string }) {
  return (
    <div className="mt-8 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em] text-pm-ink">
      <span className="shrink-0 whitespace-nowrap">{label}</span>
      <div className="pm-rule" />
    </div>
  );
}
