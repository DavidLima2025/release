import { useState } from "react";
import { Building2, Edit3, Mail, Phone, Search, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, EmptyState, SectionHeader } from "../components/ui/card";
import { Field, Input, Select } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { AppUser, MAIN_ADMIN_LOGIN, USER_ROLES, matchesText } from "../lib/domain";
import type { AppData } from "../hooks/useAppData";

const EMPTY = { name: "", warName: "", register: "", unit: "6ª CIA PM", role: "Analista", email: "", phone: "", login: "", password: "", status: "Ativo" };

export function UsersView({ data }: { data: AppData }) {
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [query, setQuery] = useState("");
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const list = data.users.filter((u) => matchesText([u.name, u.warName, u.login, u.role, u.unit, u.email, u.register], query));
  const open = (userId: string) => data.tasks.filter((t) => t.responsibleId === userId && t.status !== "Concluída").length;

  const startEdit = (user: AppUser) => { setEditing(user); setForm({ ...EMPTY, ...user, password: "" }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const reset = () => { setEditing(null); setForm(EMPTY); };

  const save = async () => {
    if (editing) {
      if (!form.name.trim()) return;
      if (await data.updateUser(editing.id, form)) reset();
      return;
    }
    if (!form.name.trim() || !form.login.trim() || !form.password.trim()) { window.alert("Informe nome completo, login e senha provisória."); return; }
    if (await data.addUser(form)) reset();
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
      <Card className="h-fit xl:sticky xl:top-6">
        <CardContent>
          <SectionHeader icon={UserPlus} title={editing ? "Editar usuário" : "Novo usuário"} subtitle={editing ? `Login: ${editing.login}` : "Quem pode receber demandas e acessar o sistema."} />
          <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Field label="Nome completo"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome de guerra"><Input value={form.warName} onChange={(e) => set("warName", e.target.value)} /></Field>
              <Field label="Matrícula"><Input value={form.register} onChange={(e) => set("register", e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unidade"><Input value={form.unit} onChange={(e) => set("unit", e.target.value)} /></Field>
              <Field label="Perfil"><Select value={form.role} onChange={(e) => set("role", e.target.value)}>{USER_ROLES.map((r) => <option key={r}>{r}</option>)}</Select></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Telefone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            </div>
            {!editing && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Login"><Input value={form.login} onChange={(e) => set("login", e.target.value)} autoComplete="off" /></Field>
                <Field label="Senha provisória"><Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" /></Field>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="submit" variant="primary" className="flex-1"><UserPlus />{editing ? "Salvar" : "Cadastrar usuário"}</Button>
              {editing && <Button onClick={reset}>Cancelar</Button>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <SectionHeader icon={Users} title="Usuários cadastrados" subtitle={`${data.users.filter((u) => u.status === "Ativo").length} ativos de ${data.users.length}`}
            actions={<div className="relative w-64"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-pm-muted" /><Input className="pl-9" placeholder="Pesquisar" value={query} onChange={(e) => setQuery(e.target.value)} /></div>} />
          {data.users.length === 0 && <EmptyState icon={Users} title="Nenhum usuário carregado">Verifique a política RLS de SELECT da tabela app_users.</EmptyState>}
          <div className="grid gap-2">
            {list.map((user) => {
              const main = user.login.toUpperCase() === MAIN_ADMIN_LOGIN;
              const pending = open(user.id);
              return (
                <div key={user.id} className={`flex flex-col gap-3 rounded-sm border border-pm-line bg-white p-3 md:flex-row md:items-center ${user.status !== "Ativo" ? "opacity-60" : ""}`}>
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-sm bg-pm-black font-black text-pm-gold-light">{(user.warName || user.name).slice(0, 2).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-black uppercase">{user.warName}</p>
                      <Badge tone={user.role === "Administrador" ? "dark" : user.role === "Gestor" ? "gold" : "default"}>{user.role}</Badge>
                      {user.status !== "Ativo" && <Badge tone="late">Inativo</Badge>}
                      {pending > 0 && <Badge tone="todo">{pending} em aberto</Badge>}
                    </div>
                    <p className="text-sm text-pm-muted">{user.name}{user.register ? ` · Nº ${user.register}` : ""} · login <b>{user.login}</b></p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-pm-muted">
                      {user.unit && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{user.unit}</span>}
                      {user.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{user.email}</span>}
                      {user.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{user.phone}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" onClick={() => startEdit(user)}><Edit3 />Editar</Button>
                    {!main && <Button size="sm" onClick={() => data.toggleUserStatus(user)}>{user.status === "Ativo" ? "Inativar" : "Ativar"}</Button>}
                    {!main && <Button size="sm" variant="danger" onClick={() => data.deleteUser(user)}><Trash2 /></Button>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
