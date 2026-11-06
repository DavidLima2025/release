import * as React from "react";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", type = "text", ...props }, ref) => <input ref={ref} type={type} className={`pm-field ${className}`} {...props} />,
);
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = "", children, ...props }, ref) => <select ref={ref} className={`pm-field pr-8 ${className}`} {...props}>{children}</select>,
);
Select.displayName = "Select";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = "", ...props }, ref) => <textarea ref={ref} className={`pm-field ${className}`} {...props} />,
);
Textarea.displayName = "Textarea";

export function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="pm-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-pm-muted">{hint}</span>}
    </label>
  );
}
