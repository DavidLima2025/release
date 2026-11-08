import type * as React from "react";
import { useState } from "react";
import {
  Activity, CalendarDays, Map as MapIcon, ChevronsLeft, ChevronsRight, FolderLock, FolderOpen, GitBranch, KeyRound, LayoutDashboard, ListChecks,
  LogOut, Menu, MonitorPlay, ScanText, Users, X,
} from "lucide-react";
import { Brand, PmFooterRule, PmmgShield } from "../components/Brand";
import type { AppData } from "../hooks/useAppData";

export type View = "painel" | "tarefas" | "workflow" | "investigacoes" | "mapa" | "dashboard" | "alvos" | "usuarios" | "auditoria";

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

const COLLAPSE_KEY = "si6_menu_recolhido";

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
}

export function Layout({ view, setView, data, onOpenTv, onImportBo, onChangePassword, title, subtitle, actions, children }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const { permissions, currentUser } = data;
  const lateCount = data.tasks.filter((t) => t.status === "Atrasada").length;

  const toggleCollapsed = () => {
    setCollapsed((value) => {
      try { localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1"); } catch { /* sem armazenamento: vale só nesta aba */ }
      return !value;
    });
  };

  const items: NavItem[] = [
    { id: "painel", label: "Painel", icon: CalendarDays, show: true },
    { id: "tarefas", label: "Demandas", icon: ListChecks, show: true },
    { id: "workflow", label: "Workflow", icon: GitBranch, show: true },
    { id: "investigacoes", label: "Investigações", icon: FolderLock, show: permissions.investigations },
    { id: "mapa", label: "Mapa criminal", icon: MapIcon, show: permissions.investigations },
    { id: "alvos", label: "Banco de alvos", icon: FolderOpen, show: permissions.targets },
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, show: permissions.dashboard },
    { id: "usuarios", label: "Usuários", icon: Users, show: permissions.users },
    { id: "auditoria", label: "Auditoria", icon: Activity, show: permissions.audit },
  ];

  const go = (next: View) => { setView(next); setMenuOpen(false); window.scrollTo({ top: 0 }); };

  /** `mini` = menu recolhido: só ícones (o nome aparece ao parar o mouse em cima). */
  const nav = (mini: boolean) => (
    <nav className="flex flex-1 flex-col gap-1">
      {items.filter((item) => item.show).map(({ id, label, icon: Icon }) => {
        const active = view === id;
        return (
          <button key={id} type="button" onClick={() => go(id)} title={mini ? label : undefined}
            className={`group relative flex items-center gap-3 rounded-sm py-2.5 text-left text-sm font-bold uppercase tracking-wide transition ${mini ? "justify-center px-0" : "px-3"} ${active ? "bg-pm-gold text-pm-black" : "text-white/75 hover:bg-white/5 hover:text-white"}`}>
            <Icon className="h-4 w-4 shrink-0" />
            {!mini && <span className="flex-1">{label}</span>}
            {id === "tarefas" && lateCount > 0 && (
              <span className={`rounded-sm px-1.5 text-[10px] ${mini ? "absolute right-1 top-1" : ""} ${active ? "bg-pm-black text-white" : "bg-status-late text-white"}`}>{lateCount}</span>
            )}
          </button>
        );
      })}
      <div className="my-3 h-px bg-white/10" />
      <button type="button" title={mini ? "Importar BO (PDF)" : undefined} onClick={() => { onImportBo(); setMenuOpen(false); }}
        className={`flex items-center gap-3 rounded-sm border border-pm-gold/50 py-2.5 text-left text-sm font-bold uppercase tracking-wide text-pm-gold-light hover:bg-pm-gold/10 ${mini ? "justify-center px-0" : "px-3"}`}>
        <ScanText className="h-4 w-4 shrink-0" />{!mini && "Importar BO (PDF)"}
      </button>
      {permissions.tv && (
        <button type="button" title={mini ? "Tela TV" : undefined} onClick={() => { onOpenTv(); setMenuOpen(false); }}
          className={`flex items-center gap-3 rounded-sm py-2.5 text-left text-sm font-bold uppercase tracking-wide text-white/75 hover:bg-white/5 hover:text-white ${mini ? "justify-center px-0" : "px-3"}`}>
          <MonitorPlay className="h-4 w-4 shrink-0" />{!mini && "Tela TV"}
        </button>
      )}
    </nav>
  );

  const initials = (currentUser?.warName || "U").slice(0, 2).toUpperCase();
  const iconBtn = "grid h-9 w-9 place-items-center rounded-sm text-white/70 hover:bg-white/10 hover:text-white";
  const userBox = (mini: boolean) => (
    <div className="mt-6 border-t border-white/10 pt-4">
      {mini ? (
        <div className="flex flex-col items-center gap-1">
          <div className="grid h-10 w-10 place-items-center rounded-sm bg-pm-gold font-black text-pm-black" title={`${currentUser?.warName} · ${currentUser?.role}`}>{initials}</div>
          <button type="button" title="Alterar minha senha" onClick={onChangePassword} className={iconBtn}><KeyRound className="h-4 w-4" /></button>
          <button type="button" title="Sair" onClick={() => data.logout()} className={iconBtn}><LogOut className="h-4 w-4" /></button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-pm-gold font-black text-pm-black">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{currentUser?.warName || currentUser?.name}</p>
            <p className="truncate text-[11px] uppercase tracking-wider text-pm-gold-light">{currentUser?.role}</p>
          </div>
          <button type="button" title="Alterar minha senha" onClick={() => { onChangePassword(); setMenuOpen(false); }} className={iconBtn}><KeyRound className="h-4 w-4" /></button>
          <button type="button" title="Sair" onClick={() => data.logout()} className={iconBtn}><LogOut className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );

  return (
    <div className={`min-h-screen transition-[padding] duration-200 ${collapsed ? "lg:pl-[76px]" : "lg:pl-64"}`}>
      {/* Faixa preta lateral com filete dourado, como no modelo de slides */}
      <aside className={`pm-stripe fixed inset-y-0 left-0 z-40 hidden flex-col overflow-y-auto bg-pm-black py-6 transition-[width] duration-200 lg:flex ${collapsed ? "w-[76px] px-3" : "w-64 px-4"}`}>
        <div className={`mb-6 flex items-center ${collapsed ? "flex-col gap-3" : "justify-between px-1"}`}>
          {collapsed ? <PmmgShield className="h-10 w-auto" /> : <Brand />}
          <button type="button" onClick={toggleCollapsed} title={collapsed ? "Expandir menu" : "Recolher menu"} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-sm text-white/60 ring-1 ring-white/10 hover:bg-white/10 hover:text-white">
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
          </button>
        </div>
        {nav(collapsed)}
        {userBox(collapsed)}
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
            {nav(false)}
            {userBox(false)}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-[1500px] px-4 pb-10 pt-6 md:px-8 md:pt-8">
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
