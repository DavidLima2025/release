import { useState } from "react";
import { Activity, Search } from "lucide-react";
import { Card, CardContent, EmptyState, SectionHeader } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { matchesText } from "../lib/domain";
import { formatDateTimeBR } from "../lib/dates";
import type { AppData } from "../hooks/useAppData";

export function AuditView({ data }: { data: AppData }) {
  const [query, setQuery] = useState("");
  const logs = data.auditLogs.filter((log) => matchesText([log.action, log.details, log.user_name, log.user_role], query));
  return (
    <Card>
      <CardContent>
        <SectionHeader icon={Activity} title="Registro de ações" subtitle="Últimas 300 ações gravadas no sistema."
          actions={<div className="relative w-72 max-w-full"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-pm-muted" /><Input className="pl-9" placeholder="Filtrar por usuário ou ação" value={query} onChange={(e) => setQuery(e.target.value)} /></div>} />
        {logs.length === 0 && <EmptyState icon={Activity} title="Nenhum registro encontrado" />}
        <div className="divide-y divide-pm-line">
          {logs.map((log) => (
            <div key={log.id} className="flex flex-col gap-1 py-2.5 md:flex-row md:items-center md:gap-4">
              <span className="w-36 shrink-0 text-xs tabular-nums text-pm-muted">{formatDateTimeBR(log.created_at)}</span>
              <span className="w-56 shrink-0 text-sm font-bold">{log.action}</span>
              <span className="min-w-0 flex-1 text-sm text-pm-ink">{log.details}</span>
              <Badge tone="dark">{log.user_name}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
