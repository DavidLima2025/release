import * as React from "react";

type Tone = "default" | "dark" | "gold" | "todo" | "late" | "paused" | "risk" | "done" | "high" | "medium" | "low";

const tones: Record<Tone, string> = {
  default: "bg-pm-sand text-pm-ink",
  dark: "bg-pm-black text-white",
  gold: "bg-pm-gold/20 text-pm-gold-dark ring-1 ring-inset ring-pm-gold/40",
  todo: "bg-status-todo/10 text-status-todo ring-1 ring-inset ring-status-todo/30",
  late: "bg-status-late/10 text-status-late ring-1 ring-inset ring-status-late/30",
  paused: "bg-status-paused/10 text-status-paused ring-1 ring-inset ring-status-paused/30",
  risk: "bg-status-risk/10 text-[#8a6200] ring-1 ring-inset ring-status-risk/40",
  done: "bg-status-done/10 text-status-done ring-1 ring-inset ring-status-done/30",
  high: "bg-status-late text-white",
  medium: "bg-status-risk/90 text-pm-black",
  low: "bg-pm-sand text-pm-ink",
};

export function Badge({ children, tone = "default", className = "" }: { children: React.ReactNode; tone?: Tone; className?: string }) {
  return <span className={`pm-chip ${tones[tone]} ${className}`}>{children}</span>;
}

export const STATUS_TONE: Record<string, Tone> = {
  "A fazer": "todo",
  Atrasada: "late",
  Paralisada: "paused",
  "Risco de prazo": "risk",
  "Concluída": "done",
};

export const STATUS_COLOR: Record<string, string> = {
  "A fazer": "#2F5D7C",
  Atrasada: "#B3261E",
  Paralisada: "#5F5E5A",
  "Risco de prazo": "#C28A12",
  "Concluída": "#2E6B3A",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] || "default"}>{status}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const tone: Tone = priority === "Crítica" ? "high" : priority === "Alta" ? "late" : priority === "Média" ? "gold" : "low";
  return <Badge tone={tone}>{priority}</Badge>;
}
