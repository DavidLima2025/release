import * as React from "react";

export function Card({ className = "", ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`pm-panel ${className}`} {...props} />;
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
