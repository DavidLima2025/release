import { useState } from "react";
import { Building2, Copy, Edit3, KeyRound, Lock, Mail, Phone, RefreshCw, Search, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardContent, EmptyState, SectionHeader } from "../components/ui/card";
import { Field, Input, Select } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Modal } from "../components/ui/modal";
import { generateTempPassword, passwordProblems } from "../components/PasswordForm";
import { AppUser, MAIN_ADMIN_LOGIN, USER_ROLES, matchesText } from "../lib/domain";
import { formatDateTimeBR } from "../lib/dates";
import type { AppData } from "../hooks/useAppData";

const EMPTY = { name: "", warName: "", register: "", unit: "6ª CIA PM", role: "Analista", email: "", phone: "", login: "", password: "", status: "Ativo" };

const ROLE_INFO: Record<string, string> = {
  Administrador: "Tudo, inclusive usuários, senhas e auditoria",
  Gestor: "Demandas, workflow, dashboard e auditoria",
  Analista: "Demandas, dashboard e banco de alvos",
  Colaborador: "Demandas e banco de alvos",
};

function copy(text: string) {
  navigator.clipboard?.writeText(text).catch(() => undefined);
}

export function UsersView({ data }: { data: AppData }) {
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [resetting, setResetting] = useState<AppUser | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [created, setCreated] = useState<{ login: string; password: string } | null>(null);
  const set = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const list = data.users
    .filter((u) => !statusFilter || u.status === statusFilter)
    .filter((u) => matchesText([u.name, u.warName, u.login, u.role, u.unit, u.email, u.register], query));
  const open = (userId: string) => data.tasks.filter((t) => t.responsibleId === userId && t.status !== "Concluída").length;
  const isMain = (u: AppUser) => u.login.toUpperCase() === MAIN_ADMIN_LOGIN;
  const isSelf = (u: AppUser) => u.id === data.currentUser?.id;

  const startEdit = (user: AppUser) => { setEditing(user); setForm({ ...EMPTY, ...user, password: "" }); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const reset = () => { setEditing(null); setForm(EMPTY); };

  const save = async () => {
    if (!form.name.trim()) { window.alert("Informe o nome completo."); return; }
    if (editing) {
      if (await data.updateUser(editing.id, form)) reset();
      return;
    }
    if (!form.login.trim()) { window.alert("Informe o login."); return; }
    const problems = passwordProblems(form.password);
    if (problems.length) { window.alert(`A senha provisória precisa ter ${problems.join(" e ")}.`); return; }
    if (await data.addUser(form)) { setCreated({ login: form.login, password: form.password }); reset(); }
  };

  const openReset = (user: AppUser) => { setResetting(user); setTempPassword(generateTempPassword()); };
  const confirmReset = async () => {
    if (!resetting || passwordProblems(tempPassword).length) return;
    if (await data.resetUserPassword(resetting, tempPassword)) { setCreated({ login: resetting.login, password: tempPassword }); setResetting(null); }
  };

  const counts = USER_ROLES.map((role) => ({ role, total: data.users.filter((u) => u.role === role && u.status === "Ativo").length }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {counts.map(({ role, total }) => (
          <div key={role} className="pm-panel p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-pm-muted">{role}</p>
            <p className="mt-1 font-display text-3xl font-black">{total}</p>
            <p className="mt-1 text-xs text-pm-muted">{ROLE_INFO[role]}</p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[400px_1fr]">
        <Card className="xl:sticky xl:top-6">
          <CardContent>
            <SectionHeader icon={UserPlus} title={editing ? "Editar usuário" : "Novo usuário"} subtitle={editing ? `Login: ${editing.login}` : "Quem pode receber demandas e acessar o sistema."} />
            <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <Field label="Nome completo"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nome de guerra"><Input value={form.warName} onChange={(e) => set("warName", e.target.value)} placeholder="Ex.: SD GOMES" /></Field>
                <Field label="Matrícula"><Input value={form.register} onChange={(e) => set("register", e.target.value)} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Unidade"><Input value={form.unit} onChange={(e) => set("unit", e.target.value)} /></Field>
                <Field label="Perfil">
                  <Select value={form.role} onChange={(e) => set("role", e.target.value)} disabled={Boolean(editing && (isMain(editing) || isSelf(editing)))}>
                    {USER_ROLES.map((r) => <option key={r}>{r}</option>)}
                  </Select>
                </Field>
              </div>
              <p className="-mt-1 text-xs text-pm-muted">{ROLE_INFO[form.role]}</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
                <Field label="Telefone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              </div>
              {!editing && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Login"><Input value={form.login} onChange={(e) => set("login", e.target.value.replace(/\s/g, ""))} autoComplete="off" /></Field>
                  <Field label="Senha provisória">
                    <div className="flex gap-1">
                      <Input value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="off" />
                      <Button size="icon" title="Gerar senha" onClick={() => set("password", generateTempPassword())}><RefreshCw /></Button>
                    </div>
                  </Field>
                </div>
              )}
              {!editing && <p className="-mt-1 text-xs text-pm-muted">O usuário será obrigado a trocar a senha no primeiro acesso.</p>}
              <div className="flex gap-2 pt-1">
                <Button type="submit" variant="primary" className="flex-1"><UserPlus />{editing ? "Salvar alterações" : "Cadastrar usuário"}</Button>
                {editing && <Button onClick={reset}>Cancelar</Button>}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <SectionHeader icon={Users} title="Usuários cadastrados" subtitle={`${data.users.filter((u) => u.status === "Ativo").length} ativos de ${data.users.length}`}
              actions={<>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-36"><option value="">Todos</option><option>Ativo</option><option>Inativo</option></Select>
                <div className="relative w-60"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-pm-muted" /><Input className="pl-9" placeholder="Pesquisar" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
              </>} />
            {data.users.length === 0 && <EmptyState icon={Users} title="Nenhum usuário carregado">Rode o script supabase/00_autenticacao_admin.sql no Supabase.</EmptyState>}
            <div className="grid gap-2">
              {list.map((user) => {
                const pending = open(user.id);
                return (
                  <div key={user.id} className={`flex flex-col gap-3 rounded-sm border border-pm-line bg-white p-3 md:flex-row md:items-center ${user.status !== "Ativo" ? "opacity-60" : ""}`}>
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-sm bg-pm-black font-black text-pm-gold-light">{(user.warName || user.name).slice(0, 2).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-black uppercase">{user.warName}</p>
                        <Badge tone={user.role === "Administrador" ? "dark" : user.role === "Gestor" ? "gold" : "default"}>{user.role}</Badge>
                        {isMain(user) && <Badge tone="gold"><ShieldCheck className="h-3 w-3" />Admin principal</Badge>}
                        {isSelf(user) && <Badge tone="todo">Você</Badge>}
                        {user.status !== "Ativo" && <Badge tone="late">Inativo</Badge>}
                        {user.mustChangePassword && <Badge tone="risk"><Lock className="h-3 w-3" />Senha provisória</Badge>}
                        {pending > 0 && <Badge tone="todo">{pending} em aberto</Badge>}
                      </div>
                      <p className="text-sm text-pm-muted">{user.name}{user.register ? ` · Nº ${user.register}` : ""} · login <b className="text-pm-ink">{user.login}</b></p>
                      <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-pm-muted">
                        {user.unit && <span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" />{user.unit}</span>}
                        {user.email && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{user.email}</span>}
                        {user.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{user.phone}</span>}
                        <span>Último acesso: {user.lastLoginAt ? formatDateTimeBR(user.lastLoginAt) : "nunca"}</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" onClick={() => startEdit(user)}><Edit3 />Editar</Button>
                      {!isSelf(user) && <Button size="sm" onClick={() => openReset(user)}><KeyRound />Senha</Button>}
                      {!isMain(user) && !isSelf(user) && <Button size="sm" onClick={() => data.toggleUserStatus(user)}>{user.status === "Ativo" ? "Inativar" : "Ativar"}</Button>}
                      {!isMain(user) && !isSelf(user) && <Button size="sm" variant="danger" title="Excluir" onClick={() => data.deleteUser(user)}><Trash2 /></Button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal open={Boolean(resetting)} onClose={() => setResetting(null)} size="md" eyebrow="Redefinir senha" title={resetting?.warName || ""}
        footer={<><Button onClick={() => setResetting(null)}>Cancelar</Button><Button variant="primary" disabled={passwordProblems(tempPassword).length > 0} onClick={confirmReset}><KeyRound />Redefinir</Button></>}>
        <p className="mb-4 text-sm text-pm-ink">A senha atual deixa de funcionar e as sessões abertas desse usuário são encerradas. No próximo acesso ele terá que criar uma senha pessoal.</p>
        <Field label="Senha provisória">
          <div className="flex gap-1">
            <Input value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} className="font-mono" />
            <Button size="icon" title="Gerar outra" onClick={() => setTempPassword(generateTempPassword())}><RefreshCw /></Button>
          </div>
        </Field>
      </Modal>

      <Modal open={Boolean(created)} onClose={() => setCreated(null)} size="md" eyebrow="Entregue ao usuário" title="Dados de acesso"
        footer={<Button variant="primary" onClick={() => setCreated(null)}>Pronto</Button>}>
        <p className="mb-4 text-sm text-pm-ink">Repasse pessoalmente. Esta senha não será exibida de novo.</p>
        <div className="space-y-2">
          {created && [["Login", created.login], ["Senha provisória", created.password]].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 rounded-sm border border-pm-line bg-white px-3 py-2">
              <div><p className="text-[10px] font-bold uppercase tracking-wider text-pm-muted">{label}</p><p className="font-mono text-lg font-bold">{value}</p></div>
              <Button size="sm" onClick={() => copy(value)}><Copy />Copiar</Button>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
