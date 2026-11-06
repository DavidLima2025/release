import type * as React from "react";
import { useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { PmmgShield } from "../components/Brand";
import { Button } from "../components/ui/button";
import { Field, Input } from "../components/ui/input";

export function LoginView({ onLogin }: { onLogin: (login: string, password: string) => Promise<boolean> }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!login.trim() || !password) return setError("Informe usuário e senha.");
    setBusy(true);
    setError("");
    const ok = await onLogin(login.trim(), password);
    setBusy(false);
    if (!ok) setError("Usuário ou senha inválidos, ou usuário inativo.");
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Lado esquerdo: capa no estilo do slide de título do modelo */}
      <section className="relative hidden flex-col overflow-hidden lg:flex">
        <div className="relative flex flex-[1.2] items-end justify-center bg-pm-black pb-0">
          <div className="absolute inset-x-0 bottom-0 h-10 bg-[repeating-linear-gradient(110deg,#0b0b0c_0_28px,#1c1b1b_28px_40px,#3a3a3a_40px_42px)]" />
          <PmmgShield className="relative z-10 -mb-24 h-80 w-auto" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-end bg-pm-gold px-10 pb-14 text-center">
          <h1 className="font-display text-5xl font-black uppercase tracking-tight text-pm-black">SI 6ª CIA</h1>
          <p className="mt-3 text-sm font-bold uppercase tracking-[0.3em] text-pm-black/80">Observar · Analisar · Antecipar</p>
        </div>
      </section>

      <section className="pm-stripe flex items-center justify-center bg-pm-cream p-6 lg:shadow-none">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <PmmgShield className="h-28 w-auto" />
            <h1 className="mt-4 font-display text-4xl font-black uppercase">SI 6ª CIA</h1>
          </div>
          <p className="pm-eyebrow">Polícia Militar de Minas Gerais</p>
          <h2 className="pm-title mt-1">Acesso restrito</h2>
          <p className="pm-subtitle">Controle de demandas da Seção de Inteligência</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            <Field label="Usuário"><Input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoFocus className="h-12" /></Field>
            <Field label="Senha"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="h-12" /></Field>
            {error && <p className="rounded-sm border-l-4 border-status-late bg-red-50 px-3 py-2 text-sm font-semibold text-status-late">{error}</p>}
            <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Lock />}Entrar</Button>
          </form>
          <div className="mt-10 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.2em]"><span className="shrink-0 whitespace-nowrap">6ª CIA · 1º BPM</span><div className="pm-rule" /></div>
        </div>
      </section>
    </main>
  );
}
