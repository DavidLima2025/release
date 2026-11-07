import type * as React from "react";
import { useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Field, Input } from "./ui/input";
import { Modal } from "./ui/modal";
import { PmmgShield } from "./Brand";

/** Regras mínimas de senha (as mesmas conferidas no servidor: 8+ caracteres). */
export function passwordProblems(value: string) {
  const problems: string[] = [];
  if (value.length < 8) problems.push("pelo menos 8 caracteres");
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) problems.push("letras e números");
  return problems;
}

export function generateTempPassword() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const base = Array.from({ length: 6 }, () => pick(letters)).join("");
  return `${base}${pick(digits)}${pick(digits)}@`;
}

export function PasswordInput({ value, onChange, autoFocus, autoComplete, name, className = "h-11" }: { value: string; onChange: (v: string) => void; autoFocus?: boolean; autoComplete?: string; name?: string; className?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} name={name} value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} autoComplete={autoComplete} className={`${className} pr-11`} />
      <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-1 top-1 grid h-9 w-9 place-items-center text-pm-muted hover:text-pm-ink" aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

type FormProps = { onSubmit: (current: string, next: string) => Promise<string | null>; submitLabel: string; onCancel?: () => void; username?: string };

export function ChangePasswordForm({ onSubmit, submitLabel, onCancel, username = "" }: FormProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const problems = passwordProblems(next);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!current) return setError("Informe a senha atual.");
    if (problems.length) return setError(`A nova senha precisa ter ${problems.join(" e ")}.`);
    if (next !== confirm) return setError("A confirmação não confere com a nova senha.");
    setBusy(true);
    const message = await onSubmit(current, next);
    setBusy(false);
    if (message) setError(message);
  };

  return (
    <form onSubmit={submit} className="space-y-4" autoComplete="on">
      {/* Campo de usuário (oculto) para o navegador ATUALIZAR a senha salva em vez de continuar preenchendo a antiga. */}
      <input type="text" name="username" autoComplete="username" value={username} readOnly tabIndex={-1} aria-hidden="true" className="sr-only" />
      <Field label="Senha atual"><PasswordInput name="current-password" value={current} onChange={setCurrent} autoFocus autoComplete="current-password" /></Field>
      <Field label="Nova senha" hint="Mínimo de 8 caracteres, com letras e números."><PasswordInput name="new-password" value={next} onChange={setNext} autoComplete="new-password" /></Field>
      <Field label="Confirme a nova senha"><PasswordInput name="confirm-password" value={confirm} onChange={setConfirm} autoComplete="new-password" /></Field>
      {next && (
        <ul className="space-y-0.5 text-xs">
          {["pelo menos 8 caracteres", "letras e números"].map((rule) => (
            <li key={rule} className={problems.includes(rule) ? "text-pm-muted" : "font-semibold text-status-done"}>{problems.includes(rule) ? "○" : "✓"} {rule}</li>
          ))}
          {confirm && <li className={next === confirm ? "font-semibold text-status-done" : "text-status-late"}>{next === confirm ? "✓" : "✗"} confirmação</li>}
        </ul>
      )}
      {error && <p className="rounded-sm border-l-4 border-status-late bg-red-50 px-3 py-2 text-sm font-semibold text-status-late">{error}</p>}
      <div className="flex gap-2 pt-1">
        <Button type="submit" variant="primary" size="lg" className="flex-1" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Check />}{submitLabel}</Button>
        {onCancel && <Button size="lg" onClick={onCancel}>Cancelar</Button>}
      </div>
    </form>
  );
}

/** Tela cheia exibida no primeiro acesso ou após a senha ser redefinida pelo administrador. */
export function ForcePasswordChange({ name, login = "", onSubmit, onLogout }: { name: string; login?: string; onSubmit: FormProps["onSubmit"]; onLogout: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-pm-black p-4">
      <div className="w-full max-w-md overflow-hidden rounded-sm bg-pm-cream shadow-2xl">
        <div className="relative flex items-center gap-4 bg-pm-black px-6 py-5 text-white">
          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-pm-gold" />
          <PmmgShield className="h-14 w-auto" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-pm-gold-light">Primeiro acesso</p>
            <h1 className="font-display text-2xl font-black uppercase">Defina sua senha</h1>
          </div>
        </div>
        <div className="p-6">
          <p className="mb-5 text-sm text-pm-ink">Olá, <b>{name}</b>. Sua senha atual é provisória. Crie uma senha pessoal para continuar — só você deve conhecê-la.</p>
          <ChangePasswordForm onSubmit={onSubmit} submitLabel="Salvar e entrar" username={login} />
          <p className="mt-3 text-xs text-pm-muted">Quando o navegador perguntar, escolha <b>atualizar/salvar a senha</b>. Se ele continuar preenchendo a senha antiga, apague o campo e digite a nova.</p>
          <button type="button" onClick={onLogout} className="mt-4 w-full text-center text-xs font-bold uppercase tracking-wider text-pm-muted hover:text-pm-ink">Sair</button>
        </div>
      </div>
    </main>
  );
}

export function ChangePasswordModal({ open, onClose, onSubmit, login = "" }: { open: boolean; onClose: () => void; onSubmit: FormProps["onSubmit"]; login?: string }) {
  return (
    <Modal open={open} onClose={onClose} size="md" eyebrow="Minha conta" title={<span className="inline-flex items-center gap-2"><KeyRound className="h-5 w-5 text-pm-gold-light" />Alterar senha</span>}>
      <p className="mb-4 text-sm text-pm-muted">Ao trocar a senha, as suas sessões abertas em outros computadores são encerradas.</p>
      {open && <ChangePasswordForm username={login} submitLabel="Alterar senha" onCancel={onClose} onSubmit={async (c, n) => { const err = await onSubmit(c, n); if (!err) onClose(); return err; }} />}
    </Modal>
  );
}
