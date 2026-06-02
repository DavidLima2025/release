import * as React from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "icon";
};

export function Button({ className = "", variant = "default", size = "default", type = "button", ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-xl font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]";
  const hasCustomBg = /(^|\s)(!?bg-|!?text-|!?border-)/.test(className);

  const variants = {
    default: hasCustomBg ? "" : "bg-slate-900 text-white hover:bg-slate-800",
    outline: hasCustomBg ? "" : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50",
    secondary: hasCustomBg ? "" : "bg-slate-100 text-slate-900 hover:bg-slate-200",
  };

  const sizes = {
    default: "h-10 px-4 py-2 text-sm",
    sm: "h-8 px-3 text-xs",
    icon: "h-10 w-10",
  };

  return <button type={type} className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}
