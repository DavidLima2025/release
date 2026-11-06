-- =====================================================================
-- SI 6ª CIA — Autenticação, sessões, administrador e auditoria
-- Execute no Supabase: SQL Editor > New query > cole tudo > Run.
-- Pode rodar mais de uma vez (é idempotente).
--
-- O que este script faz:
--  * cria as tabelas principais se ainda não existirem;
--  * guarda senhas com bcrypt (nunca em texto) e migra senhas antigas;
--  * cria sessões com token: o navegador não consegue mais "se promover"
--    a administrador editando o localStorage;
--  * gestão de usuários e leitura da auditoria só por funções que
--    conferem no servidor se a sessão é de administrador/gestor;
--  * bloqueia edição direta da tabela app_users pela chave pública;
--  * cria o administrador inicial ADM6CIA (senha provisória abaixo).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- Tabelas principais ----------
create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  war_name text,
  register text,
  unit text,
  role text not null default 'Colaborador',
  email text,
  phone text,
  login text not null,
  status text not null default 'Ativo',
  created_at timestamptz not null default now()
);
alter table public.app_users add column if not exists password_hash text;
alter table public.app_users add column if not exists must_change_password boolean not null default false;
alter table public.app_users add column if not exists last_login_at timestamptz;
alter table public.app_users add column if not exists failed_attempts int not null default 0;
alter table public.app_users add column if not exists locked_until timestamptz;
alter table public.app_users add column if not exists permissions jsonb not null default '{}'::jsonb;
create unique index if not exists app_users_login_unique on public.app_users (upper(login));

create table if not exists public.workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null default 1,
  created_at timestamptz not null default now()
);
insert into public.workflows (name, position)
select v.name, v.position from (values ('Triagem', 1), ('Coleta', 2), ('Análise', 3), ('Difusão', 4)) as v(name, position)
where not exists (select 1 from public.workflows);

create table if not exists public.demands (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text default 'Inteligência',
  status text default 'A fazer',
  priority text default 'Média',
  responsible_id uuid references public.app_users(id) on delete set null,
  manager_id uuid references public.app_users(id) on delete set null,
  date date not null default current_date,
  official_deadline date,
  internal_deadline date,
  overdue_date date,
  workflow_id uuid references public.workflows(id) on delete set null,
  checklist jsonb default '[]'::jsonb,
  done jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_name text,
  user_role text,
  action text not null,
  details text,
  user_agent text,
  created_at timestamptz not null default now()
);
alter table public.audit_logs add column if not exists user_agent text;
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

create table if not exists public.app_sessions (
  token text primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  user_agent text
);
create index if not exists app_sessions_user_idx on public.app_sessions (user_id);

-- ---------- Migração de senhas antigas (colunas "password" ou "senha" em texto) ----------
do $$
declare col text;
begin
  foreach col in array array['password', 'senha'] loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'app_users' and column_name = col) then
      execute format(
        'update public.app_users set password_hash = extensions.crypt(%1$I::text, extensions.gen_salt(''bf'')) where password_hash is null and %1$I is not null and %1$I::text <> ''''',
        col);
      execute format('alter table public.app_users drop column %I', col);
    end if;
  end loop;
end $$;

-- Senhas que estavam em texto puro na coluna password_hash viram bcrypt
-- (hashes bcrypt começam com "$2").
update public.app_users
set password_hash = extensions.crypt(password_hash, extensions.gen_salt('bf'))
where password_hash is not null and password_hash <> '' and password_hash not like '$2%';

-- ---------- Funções auxiliares ----------
-- Remove versões antigas (com outra assinatura) das funções recriadas abaixo.
do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'login_user', 'create_app_user', 'validate_session', 'logout_user', 'change_own_password',
      'admin_update_user', 'admin_set_user_status', 'admin_delete_user', 'admin_reset_password',
      'list_audit_logs', 'session_user_row', 'write_audit')
  loop
    execute format('drop function %s', fn.sig);
  end loop;
end $$;

create or replace function public.session_user_row(p_token text)
returns public.app_users language plpgsql security definer set search_path = public, extensions as $$
declare u public.app_users;
begin
  select a.* into u from public.app_sessions s join public.app_users a on a.id = s.user_id
  where s.token = p_token and s.expires_at > now() and a.status = 'Ativo';
  if u.id is null then raise exception 'Sessão inválida ou expirada' using errcode = '28000'; end if;
  return u;
end $$;

create or replace function public.is_admin(u public.app_users)
returns boolean language sql immutable as $$
  select u.role = 'Administrador' or upper(u.login) = 'ADM6CIA'
$$;

create or replace function public.write_audit(p_user public.app_users, p_action text, p_details text)
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs (user_id, user_name, user_role, action, details)
  values (p_user.id, coalesce(p_user.war_name, p_user.name, 'Sistema'), p_user.role, p_action, p_details)
$$;

-- Campos do usuário devolvidos ao navegador (nunca a senha).
drop type if exists public.app_user_public cascade;
create type public.app_user_public as (
  id uuid, name text, war_name text, register text, unit text, role text, email text, phone text,
  login text, status text, must_change_password boolean, last_login_at timestamptz, session_token text
);

-- ---------- Login / sessão ----------
create or replace function public.login_user(p_login text, p_password text, p_user_agent text default null)
returns setof public.app_user_public language plpgsql security definer set search_path = public, extensions as $$
declare
  u public.app_users;
  v_token text;
begin
  select * into u from public.app_users where upper(login) = upper(trim(p_login));

  if u.id is null then
    insert into public.audit_logs (user_name, user_role, action, details, user_agent)
    values (trim(p_login), null, 'Falha de login', 'Login inexistente.', p_user_agent);
    return;
  end if;

  if u.locked_until is not null and u.locked_until > now() then
    perform public.write_audit(u, 'Login bloqueado', 'Tentativa durante bloqueio por senhas erradas.');
    return;
  end if;

  if u.status <> 'Ativo' or u.password_hash is null or u.password_hash <> extensions.crypt(p_password, u.password_hash) then
    update public.app_users set
      failed_attempts = failed_attempts + 1,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else null end
    where id = u.id;
    perform public.write_audit(u, 'Falha de login', case when u.status <> 'Ativo' then 'Usuário inativo.' else 'Senha incorreta.' end);
    return;
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.app_sessions (token, user_id, expires_at, user_agent) values (v_token, u.id, now() + interval '12 hours', p_user_agent);
  delete from public.app_sessions where expires_at < now();
  update public.app_users set last_login_at = now(), failed_attempts = 0, locked_until = null where id = u.id;
  perform public.write_audit(u, 'Login', format('Usuário %s acessou o sistema.', coalesce(u.war_name, u.name)));

  return query select u.id, u.name, u.war_name, u.register, u.unit, u.role, u.email, u.phone, u.login, u.status,
    u.must_change_password, now(), v_token;
end $$;

create or replace function public.validate_session(p_token text)
returns setof public.app_user_public language plpgsql security definer set search_path = public, extensions as $$
declare u public.app_users;
begin
  select a.* into u from public.app_sessions s join public.app_users a on a.id = s.user_id
  where s.token = p_token and s.expires_at > now() and a.status = 'Ativo';
  if u.id is null then return; end if;
  -- Sessão deslizante: renova enquanto o sistema estiver em uso.
  update public.app_sessions set expires_at = greatest(expires_at, now() + interval '12 hours') where token = p_token;
  return query select u.id, u.name, u.war_name, u.register, u.unit, u.role, u.email, u.phone, u.login, u.status,
    u.must_change_password, u.last_login_at, p_token;
end $$;

create or replace function public.logout_user(p_token text)
returns void language plpgsql security definer set search_path = public as $$
declare u public.app_users;
begin
  select a.* into u from public.app_sessions s join public.app_users a on a.id = s.user_id where s.token = p_token;
  delete from public.app_sessions where token = p_token;
  if u.id is not null then perform public.write_audit(u, 'Logout', 'Saiu do sistema.'); end if;
end $$;

create or replace function public.change_own_password(p_token text, p_current text, p_new text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare u public.app_users := public.session_user_row(p_token);
begin
  if u.password_hash <> extensions.crypt(p_current, u.password_hash) then
    perform public.write_audit(u, 'Falha ao trocar senha', 'Senha atual incorreta.');
    raise exception 'Senha atual incorreta' using errcode = '28P01';
  end if;
  if length(coalesce(p_new, '')) < 8 then raise exception 'A nova senha precisa ter pelo menos 8 caracteres'; end if;
  if p_new = p_current then raise exception 'A nova senha deve ser diferente da atual'; end if;
  update public.app_users set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf')), must_change_password = false where id = u.id;
  -- Encerra as outras sessões abertas desse usuário.
  delete from public.app_sessions where user_id = u.id and token <> p_token;
  perform public.write_audit(u, 'Senha alterada', 'Alterou a própria senha.');
end $$;

-- ---------- Gestão de usuários (somente administrador) ----------
create or replace function public.create_app_user(
  p_token text, p_name text, p_war_name text, p_register text, p_unit text, p_role text,
  p_email text, p_phone text, p_login text, p_password text, p_status text default 'Ativo'
) returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  actor public.app_users := public.session_user_row(p_token);
  v_id uuid;
begin
  if not public.is_admin(actor) then raise exception 'Somente o administrador pode cadastrar usuários' using errcode = '42501'; end if;
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_login), '') = '' then raise exception 'Nome e login são obrigatórios'; end if;
  if length(coalesce(p_password, '')) < 8 then raise exception 'A senha provisória precisa ter pelo menos 8 caracteres'; end if;
  if p_role not in ('Administrador', 'Gestor', 'Analista', 'Colaborador') then raise exception 'Perfil inválido'; end if;
  if exists (select 1 from public.app_users where upper(login) = upper(trim(p_login))) then raise exception 'Já existe usuário com esse login'; end if;

  insert into public.app_users (name, war_name, register, unit, role, email, phone, login, status, password_hash, must_change_password)
  values (trim(p_name), coalesce(nullif(trim(p_war_name), ''), trim(p_name)), p_register, p_unit, p_role, p_email, p_phone,
          trim(p_login), coalesce(p_status, 'Ativo'), extensions.crypt(p_password, extensions.gen_salt('bf')), true)
  returning id into v_id;

  perform public.write_audit(actor, 'Usuário cadastrado', format('Cadastrou %s (login %s, perfil %s).', coalesce(nullif(trim(p_war_name), ''), p_name), p_login, p_role));
  return v_id;
end $$;

create or replace function public.admin_update_user(
  p_token text, p_user_id uuid, p_name text, p_war_name text, p_register text, p_unit text, p_role text, p_email text, p_phone text
) returns void language plpgsql security definer set search_path = public as $$
declare
  actor public.app_users := public.session_user_row(p_token);
  target public.app_users;
begin
  if not public.is_admin(actor) then raise exception 'Somente o administrador pode editar usuários' using errcode = '42501'; end if;
  select * into target from public.app_users where id = p_user_id;
  if target.id is null then raise exception 'Usuário não encontrado'; end if;
  if p_role not in ('Administrador', 'Gestor', 'Analista', 'Colaborador') then raise exception 'Perfil inválido'; end if;
  if upper(target.login) = 'ADM6CIA' and p_role <> 'Administrador' then raise exception 'O administrador principal não pode perder o perfil'; end if;
  if target.id = actor.id and p_role <> 'Administrador' then raise exception 'Você não pode remover seu próprio perfil de administrador'; end if;

  update public.app_users set name = p_name, war_name = p_war_name, register = p_register, unit = p_unit,
    role = p_role, email = p_email, phone = p_phone where id = p_user_id;

  perform public.write_audit(actor, 'Usuário atualizado',
    format('Atualizou %s%s.', coalesce(p_war_name, p_name), case when target.role <> p_role then format(' (perfil %s → %s)', target.role, p_role) else '' end));
end $$;

create or replace function public.admin_set_user_status(p_token text, p_user_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
declare
  actor public.app_users := public.session_user_row(p_token);
  target public.app_users;
begin
  if not public.is_admin(actor) then raise exception 'Somente o administrador pode ativar/inativar usuários' using errcode = '42501'; end if;
  if p_status not in ('Ativo', 'Inativo') then raise exception 'Situação inválida'; end if;
  select * into target from public.app_users where id = p_user_id;
  if target.id is null then raise exception 'Usuário não encontrado'; end if;
  if p_status = 'Inativo' and (upper(target.login) = 'ADM6CIA' or target.id = actor.id) then raise exception 'Este usuário não pode ser inativado'; end if;
  update public.app_users set status = p_status, locked_until = null, failed_attempts = 0 where id = p_user_id;
  if p_status = 'Inativo' then delete from public.app_sessions where user_id = p_user_id; end if;
  perform public.write_audit(actor, 'Situação de usuário alterada', format('Alterou %s para %s.', coalesce(target.war_name, target.name), p_status));
end $$;

create or replace function public.admin_reset_password(p_token text, p_user_id uuid, p_new_password text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  actor public.app_users := public.session_user_row(p_token);
  target public.app_users;
begin
  if not public.is_admin(actor) then raise exception 'Somente o administrador pode redefinir senhas' using errcode = '42501'; end if;
  if length(coalesce(p_new_password, '')) < 8 then raise exception 'A senha provisória precisa ter pelo menos 8 caracteres'; end if;
  select * into target from public.app_users where id = p_user_id;
  if target.id is null then raise exception 'Usuário não encontrado'; end if;
  update public.app_users set password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
    must_change_password = true, failed_attempts = 0, locked_until = null where id = p_user_id;
  delete from public.app_sessions where user_id = p_user_id;
  perform public.write_audit(actor, 'Senha redefinida', format('Redefiniu a senha de %s (troca obrigatória no próximo acesso).', coalesce(target.war_name, target.name)));
end $$;

create or replace function public.admin_delete_user(p_token text, p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  actor public.app_users := public.session_user_row(p_token);
  target public.app_users;
begin
  if not public.is_admin(actor) then raise exception 'Somente o administrador pode excluir usuários' using errcode = '42501'; end if;
  select * into target from public.app_users where id = p_user_id;
  if target.id is null then return; end if;
  if upper(target.login) = 'ADM6CIA' or target.id = actor.id then raise exception 'Este usuário não pode ser excluído'; end if;
  if exists (select 1 from public.demands where responsible_id = p_user_id and status <> 'Concluída') then
    raise exception 'O usuário tem demandas em aberto. Transfira-as ou inative o usuário';
  end if;
  delete from public.app_users where id = p_user_id;
  perform public.write_audit(actor, 'Usuário removido', format('Removeu %s (login %s).', coalesce(target.war_name, target.name), target.login));
end $$;

-- ---------- Auditoria (administrador e gestor) ----------
create or replace function public.list_audit_logs(
  p_token text, p_from timestamptz default null, p_to timestamptz default null, p_limit int default 1000
) returns setof public.audit_logs language plpgsql security definer set search_path = public as $$
declare actor public.app_users := public.session_user_row(p_token);
begin
  if not (public.is_admin(actor) or actor.role = 'Gestor') then raise exception 'Sem permissão para a auditoria' using errcode = '42501'; end if;
  return query select * from public.audit_logs
    where (p_from is null or created_at >= p_from) and (p_to is null or created_at < p_to)
    order by created_at desc limit least(greatest(coalesce(p_limit, 1000), 1), 5000);
end $$;

-- ---------- Permissões da chave pública (anon) ----------
alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.audit_logs enable row level security;

-- app_users: só leitura das colunas públicas; escrita apenas pelas funções acima.
drop policy if exists allow_app_users_insert on public.app_users;
drop policy if exists allow_app_users_update on public.app_users;
drop policy if exists allow_app_users_delete on public.app_users;
drop policy if exists allow_app_users_select on public.app_users;
create policy allow_app_users_select on public.app_users for select to anon, authenticated using (true);
revoke all on public.app_users from anon, authenticated;
grant select (id, name, war_name, register, unit, role, email, phone, login, status, created_at, last_login_at, must_change_password)
  on public.app_users to anon, authenticated;

-- app_sessions: nenhum acesso direto.
revoke all on public.app_sessions from anon, authenticated;

-- audit_logs: o sistema pode registrar ações, mas a leitura é só pela função list_audit_logs.
drop policy if exists allow_audit_logs_all on public.audit_logs;
drop policy if exists allow_audit_logs_insert on public.audit_logs;
create policy allow_audit_logs_insert on public.audit_logs for insert to anon, authenticated with check (true);
revoke all on public.audit_logs from anon, authenticated;
grant insert on public.audit_logs to anon, authenticated;

revoke all on function public.session_user_row(text) from public, anon, authenticated;
revoke all on function public.write_audit(public.app_users, text, text) from public, anon, authenticated;
grant execute on function public.login_user(text, text, text) to anon, authenticated;
grant execute on function public.validate_session(text) to anon, authenticated;
grant execute on function public.logout_user(text) to anon, authenticated;
grant execute on function public.change_own_password(text, text, text) to anon, authenticated;
grant execute on function public.create_app_user(text, text, text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_update_user(text, uuid, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.admin_set_user_status(text, uuid, text) to anon, authenticated;
grant execute on function public.admin_reset_password(text, uuid, text) to anon, authenticated;
grant execute on function public.admin_delete_user(text, uuid) to anon, authenticated;
grant execute on function public.list_audit_logs(text, timestamptz, timestamptz, int) to anon, authenticated;

-- Demais tabelas operacionais continuam liberadas para o app (como antes).
do $$
declare t text;
begin
  foreach t in array array['workflows', 'demands'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists allow_%1$s_all on public.%1$I', t);
    execute format('create policy allow_%1$s_all on public.%1$I for all to anon, authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
  end loop;
end $$;

-- ---------- Administrador inicial ----------
-- Login: ADM6CIA   Senha provisória: Pmmg@6cia2026  (o sistema obriga a trocar no primeiro acesso)
insert into public.app_users (name, war_name, role, login, status, unit, password_hash, must_change_password)
select 'Administrador do Sistema', 'ADMINISTRADOR', 'Administrador', 'ADM6CIA', 'Ativo', '6ª CIA PM',
       extensions.crypt('Pmmg@6cia2026', extensions.gen_salt('bf')), true
where not exists (select 1 from public.app_users where upper(login) = 'ADM6CIA');

-- Se o ADM6CIA já existia sem senha válida, define a provisória:
update public.app_users
set password_hash = extensions.crypt('Pmmg@6cia2026', extensions.gen_salt('bf')), must_change_password = true,
    role = 'Administrador', status = 'Ativo'
where upper(login) = 'ADM6CIA' and (password_hash is null or password_hash not like '$2%');

-- Esqueceu a senha do ADM6CIA? Descomente e rode só a linha abaixo:
-- update public.app_users set password_hash = extensions.crypt('Pmmg@6cia2026', extensions.gen_salt('bf')), must_change_password = true, failed_attempts = 0, locked_until = null where upper(login) = 'ADM6CIA';

-- Recarrega o cache da API para enxergar as funções novas.
notify pgrst, 'reload schema';
