import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, Download, Loader2, LogIn, RefreshCw, Search, ShieldAlert, UserCog } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, EmptyState, SectionHeader } from "../components/ui/card";
import { Field, Input, Select } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { AuditLog, matchesText } from "../lib/domain";
import { addDays, formatDateTimeBR } from "../lib/dates";
import type { AppData } from "../hooks/useAppData";

const SECURITY = /falha|bloquead|senha/i;
const USER_ADMIN = /usu[aá]rio/i;

function category(action: string) {
  if (SECURITY.test(action)) return "Segurança";
  if (/^log(in|out)$/i.test(action)) return "Acesso";
  if (USER_ADMIN.test(action)) return "Usuários";
  if (/demanda|status|checklist|workflow|etapa|anexo|arquivo/i.test(action)) return "Demandas";
  if (/alvo|pasta|foto|relat|trello/i.test(action)) return "Banco de alvos";
  return "Outros";
}

function toCsv(rows: AuditLog[]) {
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Data/hora", "Usuário", "Perfil", "Categoria", "Ação", "Detalhes"];
  const lines = rows.map((r) => [formatDateTimeBR(r.created_at), r.user_name, r.user_role, category(r.action), r.action, r.details].map(esc).join(";"));
  return "﻿" + [header.map(esc).join(";"), ...lines].join("\r\n");
}

export function AuditView({ data }: { data: AppData }) {
  const [from, setFrom] = useState(addDays(data.today, -30));
  const [to, setTo] = useState(data.today);
  const [logs, setLogs] = useState<AuditLog[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [user, setUser] = useState("");
  const [cat, setCat] = useState("");

  const load = async () => {
    setBusy(true);
    const result = await data.fetchAuditLogs(from, to);
    if (result) setLogs(result);
    setBusy(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [from, to]);

  const source = logs || data.auditLogs;
  const people = useMemo(() => [...new Set(source.map((l) => l.user_name).filter(Boolean))].sort(), [source]);
  const filtered = source.filter((l) => (!user || l.user_name === user) && (!cat || category(l.action) === cat) && matchesText([l.action, l.details, l.user_name, l.user_role], query));

  const kpis = [
    { label: "Registros no período", value: source.length, icon: Activity },
    { label: "Logins", value: source.filter((l) => l.action === "Login").length, icon: LogIn },
    { label: "Falhas e bloqueios", value: source.filter((l) => /falha|bloquead/i.test(l.action)).length, icon: ShieldAlert },
    { label: "Gestão de usuários", value: source.filter((l) => USER_ADMIN.test(l.action) || /senha redefinida/i.test(l.action)).length, icon: UserCog },
  ];

  const exportCsv = () => {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria_${from}_a_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <div key={label} className="pm-panel p-4">
            <div className="flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-pm-muted">{label}</p><Icon className="h-4 w-4 text-pm-gold-dark" /></div>
            <p className="mt-2 font-display text-4xl font-black leading-none">{value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardContent>
          <SectionHeader icon={Activity} title="Registro de ações" subtitle="Logins, falhas, alterações de usuários e senhas, demandas e banco de alvos."
            actions={<>
              <Button onClick={load} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}Atualizar</Button>
              <Button variant="primary" onClick={exportCsv} disabled={!filtered.length}><Download />Exportar CSV</Button>
            </>} />

          <div className="mb-4 grid gap-2 md:grid-cols-[150px_150px_1fr_1fr_2fr]">
            <Field label="De"><Input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="Até"><Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
            <Field label="Usuário"><Select value={user} onChange={(e) => setUser(e.target.value)}><option value="">Todos</option>{people.map((p) => <option key={p}>{p}</option>)}</Select></Field>
            <Field label="Categoria"><Select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">Todas</option>{["Acesso", "Segurança", "Usuários", "Demandas", "Banco de alvos", "Outros"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
            <Field label="Pesquisar">
              <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-pm-muted" /><Input className="pl-9" placeholder="Ação ou detalhe" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
            </Field>
          </div>

          {filtered.length === 0 && <EmptyState icon={Activity} title={busy ? "Carregando…" : "Nenhum registro encontrado"} />}
          <div className="divide-y divide-pm-line">
            {filtered.map((log) => {
              const security = SECURITY.test(log.action);
              return (
                <div key={log.id} className={`flex flex-col gap-1 px-2 py-2.5 md:flex-row md:items-center md:gap-4 ${security ? "bg-status-late/[0.04]" : ""}`}>
                  <span className="w-32 shrink-0 text-xs tabular-nums text-pm-muted">{formatDateTimeBR(log.created_at)}</span>
                  <span className="flex w-60 shrink-0 items-center gap-2 text-sm font-bold">{security && <AlertTriangle className="h-3.5 w-3.5 text-status-late" />}{log.action}</span>
                  <span className="min-w-0 flex-1 text-sm text-pm-ink">{log.details}</span>
                  <span className="flex shrink-0 items-center gap-1.5"><Badge>{category(log.action)}</Badge><Badge tone="dark">{log.user_name || "—"}</Badge></span>
                </div>
              );
            })}
          </div>
          {filtered.length >= 5000 && <p className="mt-3 text-xs text-pm-muted">Mostrando os 5.000 registros mais recentes do período. Reduza o intervalo para ver os anteriores.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
