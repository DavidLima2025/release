import * as React from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  size?: "md" | "lg" | "xl";
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

const widths = { md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };

export function Modal({ open, onClose, title, eyebrow, size = "lg", actions, footer, children }: ModalProps) {
  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-pm-black/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={`flex max-h-[94vh] w-full ${widths[size]} flex-col overflow-hidden rounded-t-md bg-pm-cream shadow-2xl sm:rounded-sm`}>
        <div className="relative flex items-start justify-between gap-3 bg-pm-black px-5 py-4 text-white">
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-pm-gold" />
          <div className="min-w-0">
            {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-pm-gold-light">{eyebrow}</p>}
            <h3 className="font-display text-xl font-black uppercase leading-tight tracking-tight">{title}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-sm text-white/80 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-pm-line bg-white/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
