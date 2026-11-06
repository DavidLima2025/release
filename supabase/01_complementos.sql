-- =====================================================================
-- SI 6ª CIA — Complementos que o site usa (rode depois do 00_autenticacao_admin.sql)
-- Idempotente: pode rodar mais de uma vez.
-- =====================================================================

-- ---------- Anexos das demandas ----------
create table if not exists public.demand_attachments (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references public.demands(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);
alter table public.demand_attachments enable row level security;
drop policy if exists allow_demand_attachments_all on public.demand_attachments;
create policy allow_demand_attachments_all on public.demand_attachments for all to anon, authenticated using (true) with check (true);
grant select, insert, update, delete on public.demand_attachments to anon, authenticated;

-- Privado: PDFs de BO têm dados pessoais. O site abre cada arquivo com link temporário (5 min).
insert into storage.buckets (id, name, public) values ('demand-files', 'demand-files', false)
on conflict (id) do update set public = false;

drop policy if exists allow_demand_files_read on storage.objects;
create policy allow_demand_files_read on storage.objects for select to anon, authenticated using (bucket_id = 'demand-files');
drop policy if exists allow_demand_files_insert on storage.objects;
create policy allow_demand_files_insert on storage.objects for insert to anon, authenticated with check (bucket_id = 'demand-files');
drop policy if exists allow_demand_files_delete on storage.objects;
create policy allow_demand_files_delete on storage.objects for delete to anon, authenticated using (bucket_id = 'demand-files');

-- ---------- Banco de alvos: colunas que o site usa ----------
alter table public.author_folders add column if not exists description text;
alter table public.author_folders add column if not exists created_by uuid references public.app_users(id) on delete set null;
create unique index if not exists author_folders_name_unique on public.author_folders (name);

alter table public.crime_authors add column if not exists folder_id uuid references public.author_folders(id) on delete set null;
alter table public.crime_authors add column if not exists name text;
alter table public.crime_authors add column if not exists alias text;
alter table public.crime_authors add column if not exists mother_name text;
alter table public.crime_authors add column if not exists birth_date date;
alter table public.crime_authors add column if not exists document text;
alter table public.crime_authors add column if not exists address text;
alter table public.crime_authors add column if not exists neighborhood text;
alter table public.crime_authors add column if not exists city text;
alter table public.crime_authors add column if not exists crimes text;
alter table public.crime_authors add column if not exists status text default 'Suspeito';
alter table public.crime_authors add column if not exists risk_level text default 'Médio';
alter table public.crime_authors add column if not exists notes text;
alter table public.crime_authors add column if not exists created_by uuid references public.app_users(id) on delete set null;

-- Cards antigos cadastrados com as colunas em português aparecem com nome e dados no site.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'crime_authors' and column_name = 'nome') then
    execute 'update public.crime_authors set name = nome where name is null and nome is not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'crime_authors' and column_name = 'vulgo') then
    execute 'update public.crime_authors set alias = vulgo where (alias is null or alias = '''') and vulgo is not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'crime_authors' and column_name = 'nome_mae') then
    execute 'update public.crime_authors set mother_name = nome_mae where (mother_name is null or mother_name = '''') and nome_mae is not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'crime_authors' and column_name = 'observacoes') then
    execute 'update public.crime_authors set notes = observacoes where (notes is null or notes = '''') and observacoes is not null';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'crime_authors' and column_name = 'endereco') then
    execute 'update public.crime_authors set address = endereco where (address is null or address = '''') and endereco is not null';
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['author_folders', 'crime_authors', 'author_photos', 'author_reports'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists allow_%1$s_all on public.%1$I', t);
    execute format('create policy allow_%1$s_all on public.%1$I for all to anon, authenticated using (true) with check (true)', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
  end loop;
end $$;

insert into storage.buckets (id, name, public) values ('intelligence-files', 'intelligence-files', true)
on conflict (id) do update set public = true;
drop policy if exists intelligence_files_select on storage.objects;
create policy intelligence_files_select on storage.objects for select to anon, authenticated using (bucket_id = 'intelligence-files');
drop policy if exists intelligence_files_insert on storage.objects;
create policy intelligence_files_insert on storage.objects for insert to anon, authenticated with check (bucket_id = 'intelligence-files');

notify pgrst, 'reload schema';
