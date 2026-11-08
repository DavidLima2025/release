import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

/** false quando as variáveis de ambiente não foram configuradas (ex.: deploy sem .env). */
export const supabaseConfigured = Boolean(url && anonKey);

// Token da sessão do usuário logado. Vai no cabeçalho "x-session-token" de toda consulta;
// as políticas do banco (supabase/02_investigacoes.sql) só liberam os dados com sessão válida.
let sessionToken = "";
export function setSessionToken(token: string) {
  sessionToken = token || "";
}

const fetchWithSession: typeof fetch = (input, init = {}) => {
  if (!sessionToken) return fetch(input, init);
  // O Storage não usa a sessão (as regras dele não leem esse cabeçalho); mandar só no banco evita bloqueio de CORS no envio de arquivos.
  const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (target.includes("/storage/v1/")) return fetch(input, init);
  const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
  headers.set("x-session-token", sessionToken);
  return fetch(input, { ...init, headers });
};

// Sem configuração, cria um cliente apontando para um host inválido só para não quebrar
// o import — a tela de configuração é exibida antes de qualquer chamada.
export const supabase = createClient(url || "http://localhost.invalid", anonKey || "missing-key", {
  global: { fetch: fetchWithSession },
});

export const DEMAND_BUCKET = "demand-files";
export const INTEL_BUCKET = "intelligence-files";
export const INVESTIGATION_BUCKET = "investigation-files";
