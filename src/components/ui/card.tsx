import * as React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export function Card({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`pm-panel min-w-0 ${className}`} {...props} />;
}

export function CardContent({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-5 md:p-6 ${className}`} {...props} />;
}

/** Cabeçalho de seção no estilo dos slides: título caixa-alta + subtítulo. */
export function SectionHeader({ title, subtitle, icon: Icon, actions }: { title: React.ReactNode; subtitle?: React.ReactNode; icon?: any; actions?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h2 className="pm-heading flex items-center gap-2 text-lg">{Icon && <Icon className="h-5 w-5 text-pm-gold-dark" />}{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-pm-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon?: any; title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-sm border border-dashed border-pm-line bg-pm-cream/60 p-6 text-center">
      {Icon && <Icon className="mx-auto mb-2 h-7 w-7 text-pm-gold" />}
      <p className="text-sm font-bold text-pm-ink">{title}</p>
      {children && <div className="mt-1 text-sm text-pm-muted">{children}</div>}
    </div>
  );
}

/** Seção que abre e fecha pelo cabeçalho (o conteúdo só aparece aberto). */
export function Collapsible({ icon: Icon, title, subtitle, badge, defaultOpen = false, actions, children }: { icon?: any; title: React.ReactNode; subtitle?: React.ReactNode; badge?: React.ReactNode; defaultOpen?: boolean; actions?: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <Card>
      <div className="flex items-center gap-2 p-3 md:px-5">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          {open ? <ChevronDown className="h-5 w-5 shrink-0 text-pm-gold-dark" /> : <ChevronRight className="h-5 w-5 shrink-0 text-pm-gold-dark" />}
          <span className="min-w-0">
            <span className="pm-heading flex flex-wrap items-center gap-2 text-lg">{Icon && <Icon className="h-5 w-5 text-pm-gold-dark" />}{title}{badge !== undefined && badge !== null && badge !== "" && <span className="rounded-sm bg-pm-black px-2 py-0.5 text-[11px] font-black text-pm-gold-light">{badge}</span>}</span>
            {subtitle && !open && <span className="mt-0.5 block text-xs text-pm-muted">{subtitle}</span>}
          </span>
        </button>
        {actions}
      </div>
      {open && <div className="border-t border-pm-line p-5 pt-4 md:px-6">{children}</div>}
    </Card>
  );
}
