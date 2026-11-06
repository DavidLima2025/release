import type * as React from "react";
import { useState } from "react";
import { Activity, CalendarDays, KeyRound, FolderOpen, GitBranch, LayoutDashboard, ListChecks, LogOut, Menu, MonitorPlay, ScanText, Users, X } from "lucide-react";
import { Brand, PmFooterRule } from "../components/Brand";
import type { AppData } from "../hooks/useAppData";

export type View = "painel" | "tarefas" | "workflow" | "dashboard" | "alvos" | "usuarios" | "auditoria";

type NavItem = { id: View; label: string; icon: any; show: boolean };

type Props = {
  view: View;
  setView: (view: View) => void;
  data: AppData;
  onOpenTv: () => void;
  onImportBo: () => void;
  onChangePassword: () => void;
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
};

export function Layout({ view, setView, data, onOpenTv, onImportBo, onChangePassword, title, subtitle, actions, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { permissions, currentUser } = data;
  const lateCount = data.tasks.filter((t) => t.status === "Atrasada").length;

  const items: NavItem[] = [
    { id: "painel", label: "Painel", icon: CalendarDays, show: true },
    { id: "tarefas", label: "Demandas", icon: ListChecks, show: true },
    { id: "workflow", label: "Workflow", icon: GitBranch, show: true },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, show: permissions.dashboard },
    { id: "alvos", label: "Banco de alvos", icon: FolderOpen, show: permissions.targets },
    { id: "usuarios", label: "Usuários", icon: Users, show: permissions.users },
    { id: "auditoria", label: "Auditoria", icon: Activity, show: permissions.audit },
  ];

  const go = (next: View) => { setView(next); setMenuOpen(false); window.scrollTo({ top: 0 }); };

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      {items.filter((item) => item.show).map(({ id, label, icon: Icon }) => {
        const active = view === id;
        return (
          <button key={id} type="button" onClick={() => go(id)}
            className={`group relative flex items-center gap-3 rounded-sm px-3 py-2.5 text-left text-sm font-bold uppercase tracking-wide transition ${active ? "bg-pm-gold text-pm-black" : "text-white/75 hover:bg-white/5 hover:text-white"}`}>
            <Icon className="h-4 w-4" />
            <span className="flex-1">{label}</span>
            {id === "tarefas" && lateCount > 0 && <span className={`rounded-sm px-1.5 text-[10px] ${active ? "bg-pm-black text-white" : "bg-status-late text-white"}`}>{lateCount}</span>}
          </button>
        );
      })}
      <div className="my-3 h-px bg-white/10" />
      <button type="button" onClick={() => { onImportBo(); setMenuOpen(false); }} className="flex items-center gap-3 rounded-sm border border-pm-gold/50 px-3 py-2.5 text-left text-sm font-bold uppercase tracking-wide text-pm-gold-light hover:bg-pm-gold/10">
        <ScanText className="h-4 w-4" />Importar BO (PDF)
      </button>
      {permissions.tv && (
        <button type="button" onClick={() => { onOpenTv(); setMenuOpen(false); }} className="flex items-center gap-3 rounded-sm px-3 py-2.5 text-left text-sm font-bold uppercase tracking-wide text-white/75 hover:bg-white/5 hover:text-white">
          <MonitorPlay className="h-4 w-4" />Tela TV
        </button>
      )}
    </nav>
  );

  const userBox = (
    <div className="mt-6 border-t border-white/10 pt-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-pm-gold font-black text-pm-black">{(currentUser?.warName || "U").slice(0, 2).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-white">{currentUser?.warName || currentUser?.name}</p>
          <p className="truncate text-[11px] uppercase tracking-wider text-pm-gold-light">{currentUser?.role}</p>
        </div>
        <button type="button" title="Alterar minha senha" onClick={() => { onChangePassword(); setMenuOpen(false); }} className="grid h-9 w-9 place-items-center rounded-sm text-white/70 hover:bg-white/10 hover:text-white"><KeyRound className="h-4 w-4" /></button>
        <button type="button" title="Sair" onClick={() => data.logout()} className="grid h-9 w-9 place-items-center rounded-sm text-white/70 hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" /></button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Faixa preta lateral com filete dourado, como no modelo de slides */}
      <aside className="pm-stripe fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-pm-black px-4 py-6 lg:flex">
        <div className="mb-8 px-1"><Brand /></div>
        {nav}
        {userBox}
      </aside>

      <div className="pm-stripe sticky top-0 z-40 flex items-center justify-between bg-pm-black px-4 py-3 lg:hidden">
        <Brand compact />
        <button type="button" onClick={() => setMenuOpen(true)} className="grid h-10 w-10 place-items-center rounded-sm text-white hover:bg-white/10" aria-label="Abrir menu"><Menu className="h-5 w-5" /></button>
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="pm-stripe absolute inset-y-0 left-0 flex w-72 flex-col overflow-y-auto bg-pm-black px-4 py-5">
            <div className="mb-6 flex items-center justify-between"><Brand compact /><button type="button" onClick={() => setMenuOpen(false)} className="text-white/80" aria-label="Fechar menu"><X className="h-5 w-5" /></button></div>
            {nav}
            {userBox}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1400px] px-4 pb-10 pt-6 md:px-8 md:pt-8">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="pm-title">{title}</h1>
            <p className="pm-subtitle">{subtitle}</p>
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </header>
        {children}
        <PmFooterRule />
      </main>
    </div>
  );
}
