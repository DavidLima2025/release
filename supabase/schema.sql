create extension if not exists pgcrypto;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  war_name text not null,
  register text,
  unit text,
  role text not null default 'Analista',
  email text,
  phone text,
  login text not null unique,
  password_hash text not null,
  status text not null default 'Ativo',
  created_at timestamptz not null default now()
);

create table if not exists workflows (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists demands (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'Inteligência',
  status text not null default 'A fazer',
  priority text not null default 'Média',
  responsible_id uuid references app_users(id) on delete set null,
  manager_id uuid references app_users(id) on delete set null,
  date date not null default current_date,
  internal_deadline date,
  official_deadline date,
  overdue_date date,
  workflow_id uuid references workflows(id) on delete set null,
  checklist jsonb not null default '["Triar demanda","Executar atividade","Registrar conclusão"]'::jsonb,
  done jsonb not null default '[false,false,false]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

insert into workflows (name, position) values
('Triagem',1),('Produção',2),('Validação',3),('Encaminhamento',4),('Conclusão',5)
on conflict (name) do nothing;

insert into app_users (name, war_name, register, unit, role, email, phone, login, password_hash, status)
values ('Administrador SI 6ª CIA','ADM','ADM-6CIA','SI 6ª CIA','Administrador','adm@si6cia.local','','ADM6CIA',crypt('123456', gen_salt('bf')),'Ativo')
on conflict (login) do nothing;

create or replace function login_user(p_login text, p_password text)
returns table (id uuid, name text, war_name text, register text, unit text, role text, email text, phone text, login text, status text)
language sql security definer set search_path = public as $$
select id,name,war_name,register,unit,role,email,phone,login,status
from app_users
where lower(login)=lower(p_login)
and status='Ativo'
and password_hash = crypt(p_password, password_hash)
limit 1;
$$;

create or replace function create_app_user(
  p_name text, p_war_name text, p_register text, p_unit text, p_role text,
  p_email text, p_phone text, p_login text, p_password text, p_status text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  insert into app_users (name, war_name, register, unit, role, email, phone, login, password_hash, status)
  values (p_name, p_war_name, p_register, p_unit, p_role, p_email, p_phone, p_login, crypt(p_password, gen_salt('bf')), p_status)
  returning id into new_id;
  return new_id;
end;
$$;

alter table app_users enable row level security;
alter table workflows enable row level security;
alter table demands enable row level security;

drop policy if exists allow_app_users_select on app_users;
create policy allow_app_users_select on app_users for select to anon using (true);

drop policy if exists allow_workflows_all on workflows;
create policy allow_workflows_all on workflows for all to anon using (true) with check (true);

drop policy if exists allow_demands_all on demands;
create policy allow_demands_all on demands for all to anon using (true) with check (true);
