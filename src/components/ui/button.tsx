import * as React from "react";

type Variant = "primary" | "gold" | "outline" | "ghost" | "danger" | "light";
type Size = "sm" | "md" | "lg" | "icon";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

const variants: Record<Variant, string> = {
  primary: "bg-pm-black text-white hover:bg-pm-ink border border-pm-black",
  gold: "bg-pm-gold text-pm-black hover:bg-pm-gold-light border border-pm-gold",
  outline: "border border-pm-line bg-white text-pm-ink hover:border-pm-gold hover:bg-pm-cream",
  ghost: "text-pm-ink hover:bg-pm-sand",
  danger: "border border-pm-line bg-white text-pm-red hover:border-pm-red hover:bg-red-50",
  light: "border border-white/15 bg-white/5 text-white hover:bg-white/15",
};

const sizes: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-2.5 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-5 text-sm",
  icon: "h-9 w-9",
};

export function Button({ className = "", variant = "outline", size = "md", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center rounded-sm font-bold uppercase tracking-wide transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-pm-gold focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
