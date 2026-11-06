import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "";
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

/** false quando as variáveis de ambiente não foram configuradas (ex.: deploy sem .env). */
export const supabaseConfigured = Boolean(url && anonKey);

// Sem configuração, cria um cliente apontando para um host inválido só para não quebrar
// o import — a tela de configuração é exibida antes de qualquer chamada.
export const supabase = createClient(url || "http://localhost.invalid", anonKey || "missing-key");

export const DEMAND_BUCKET = "demand-files";
export const INTEL_BUCKET = "intelligence-files";
