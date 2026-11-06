import { useCallback, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

type Toast = { id: number; text: string; tone: "success" | "error" | "info" };

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const notify = useCallback((text: string, tone: Toast["tone"] = "success") => {
    const id = (seq.current += 1);
    setToasts((list) => [...list.filter((t) => t.text !== text), { id, text, tone }].slice(-4));
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), tone === "error" ? 6000 : 3200);
  }, []);
  return { toasts, notify };
}

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[120] flex w-[min(92vw,380px)] flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = toast.tone === "error" ? AlertTriangle : toast.tone === "info" ? Info : CheckCircle2;
        return (
          <div key={toast.id} className={`pointer-events-auto flex items-start gap-3 rounded-sm border-l-4 bg-pm-black px-4 py-3 text-sm font-semibold text-white shadow-2xl ${toast.tone === "error" ? "border-status-late" : "border-pm-gold"}`}>
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${toast.tone === "error" ? "text-red-300" : "text-pm-gold-light"}`} />
            <span>{toast.text}</span>
          </div>
        );
      })}
    </div>
  );
}
