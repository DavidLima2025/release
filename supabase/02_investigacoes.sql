-- =====================================================================
-- SI 6ª CIA — Investigações / Dossiês + proteção das tabelas por sessão
-- Rode depois do 00_autenticacao_admin.sql e do 01_complementos.sql.
-- Idempotente: pode rodar mais de uma vez.
--
-- A partir deste script o site envia o token da sessão no cabeçalho
-- "x-session-token" de cada consulta. As políticas abaixo só liberam as
-- tabelas quando esse token é de uma sessão válida — a chave pública
-- sozinha deixa de dar acesso aos dados.
-- =====================================================================

-- ---------- Sessão da requisição ----------
create or replace function public.request_session_user()
returns public.app_users language plpgsql stable security definer set search_path = public as $$
declare
  v_token text;
  u public.app_users;
begin
  begin
    v_token := nullif(current_setting('request.headers', true)::json ->> 'x-session-token', '');
  exception when others then
    v_token := null;
  end;
  if v_token is null then return null; end if;
  select a.* into u from public.app_sessions s join public.app_users a on a.id = s.user_id
  where s.token = v_token and s.expires_at > now() and a.status = 'Ativo';
  return u;
end $$;

create or replace function public.request_session_valid()
returns boolean language sql stable security definer set search_path = public as $$
  select (public.request_session_user()).id is not null
$$;

-- Investigações: administrador, gestor e analista (colaborador não acessa).
create or replace function public.request_can_investigate()
returns boolean language plpgsql stable security definer set search_path = public as $$
declare u public.app_users := public.request_session_user();
begin
  return u.id is not null and (u.role in ('Administrador', 'Gestor', 'Analista') or upper(u.login) = 'ADM6CIA');
end $$;

grant execute on function public.request_session_valid() to anon, authenticated;
grant execute on function public.request_can_investigate() to anon, authenticated;
revoke all on function public.request_session_user() from public, anon, authenticated;

-- ---------- Tabelas ----------
create table if not exists public.investigations (
  id uuid primary key default gen_random_uuid(),
  code text,
  title text not null,
  objective text,
  origin text,
  destination text,
  summary text,
  analysis text,
  conclusion text,
  recommendations text,
  methodology text,
  classification text not null default 'Reservado',
  status text not null default 'Em andamento',
  stage text not null default 'abertura',
  stages jsonb not null default '{}'::jsonb,
  priority text not null default 'Média',
  nature text,
  area text,
  responsible_id uuid references public.app_users(id) on delete set null,
  team uuid[] not null default '{}',
  opened_at date not null default current_date,
  due_date date,
  closed_at date,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists investigations_code_unique on public.investigations (code) where code is not null;

create table if not exists public.investigation_items (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  kind text not null default 'Documento',
  title text not null,
  item_date date,
  source text,
  reference text,
  url text,
  source_rating text,
  info_rating text,
  summary text,
  author_ids uuid[] not null default '{}',
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  include_in_report boolean not null default true,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists investigation_items_inv_idx on public.investigation_items (investigation_id);

create table if not exists public.investigation_targets (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  author_id uuid not null references public.crime_authors(id) on delete cascade,
  role text not null default 'Associado',
  parent_id uuid references public.investigation_targets(id) on delete set null,
  notes text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (investigation_id, author_id)
);
create index if not exists investigation_targets_inv_idx on public.investigation_targets (investigation_id);

create table if not exists public.investigation_links (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations(id) on delete cascade,
  from_target uuid not null references public.investigation_targets(id) on delete cascade,
  to_target uuid not null references public.investigation_targets(id) on delete cascade,
  relation text not null default 'Associado',
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists investigation_links_inv_idx on public.investigation_links (investigation_id);

-- Código sequencial por ano: INV-2026-001
create or replace function public.set_investigation_code()
returns trigger language plpgsql as $$
declare v_next int;
begin
  if new.code is null or new.code = '' then
    select coalesce(max(nullif(split_part(code, '-', 3), '')::int), 0) + 1 into v_next
    from public.investigations where code like 'INV-' || to_char(new.opened_at, 'YYYY') || '-%';
    new.code := 'INV-' || to_char(new.opened_at, 'YYYY') || '-' || lpad(v_next::text, 3, '0');
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_investigation_code on public.investigations;
create trigger trg_investigation_code before insert or update on public.investigations
for each row execute function public.set_investigation_code();

-- ---------- Arquivos das investigações (privado) ----------
insert into storage.buckets (id, name, public) values ('investigation-files', 'investigation-files', false)
on conflict (id) do update set public = false;
drop policy if exists investigation_files_select on storage.objects;
create policy investigation_files_select on storage.objects for select to anon, authenticated using (bucket_id = 'investigation-files');
drop policy if exists investigation_files_insert on storage.objects;
create policy investigation_files_insert on storage.objects for insert to anon, authenticated with check (bucket_id = 'investigation-files');
drop policy if exists investigation_files_delete on storage.objects;
create policy investigation_files_delete on storage.objects for delete to anon, authenticated using (bucket_id = 'investigation-files');

-- ---------- Políticas: só com sessão válida ----------
do $$
declare t text;
begin
  -- Investigações: sessão válida + perfil de investigação.
  foreach t in array array['investigations', 'investigation_items', 'investigation_targets', 'investigation_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists allow_%1$s_all on public.%1$I', t);
    execute format('drop policy if exists session_%1$s_all on public.%1$I', t);
    execute format('create policy session_%1$s_all on public.%1$I for all to anon, authenticated using ((select public.request_can_investigate())) with check ((select public.request_can_investigate()))', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
  end loop;

  -- Demais tabelas operacionais: qualquer usuário logado.
  foreach t in array array['workflows', 'demands', 'demand_attachments', 'author_folders', 'crime_authors', 'author_photos', 'author_reports'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security', t);
      execute format('drop policy if exists allow_%1$s_all on public.%1$I', t);
      execute format('drop policy if exists session_%1$s_all on public.%1$I', t);
      execute format('create policy session_%1$s_all on public.%1$I for all to anon, authenticated using ((select public.request_session_valid())) with check ((select public.request_session_valid()))', t);
    end if;
  end loop;
end $$;

-- Lista de usuários (sem senha) e registro de auditoria: só logado.
drop policy if exists allow_app_users_select on public.app_users;
drop policy if exists session_app_users_select on public.app_users;
create policy session_app_users_select on public.app_users for select to anon, authenticated using ((select public.request_session_valid()));

drop policy if exists allow_audit_logs_insert on public.audit_logs;
drop policy if exists session_audit_logs_insert on public.audit_logs;
create policy session_audit_logs_insert on public.audit_logs for insert to anon, authenticated with check ((select public.request_session_valid()));

notify pgrst, 'reload schema';
