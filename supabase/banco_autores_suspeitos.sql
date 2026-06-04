-- Banco de autores/suspeitos e anexos de inteligência
-- Execute este arquivo no SQL Editor do Supabase.

-- Pastas/modalidades do Banco de Alvos
create table if not exists public.author_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.author_categories (name, description) values
  ('Tráfico de drogas', 'Autores e suspeitos vinculados ao tráfico de drogas.'),
  ('Receptação', 'Autores e suspeitos vinculados à receptação.'),
  ('Arrombamento', 'Autores e suspeitos vinculados a arrombamentos.'),
  ('Furto de correntinha', 'Autores e suspeitos vinculados a furtos de correntinha.')
on conflict (name) do nothing;

create table if not exists public.crime_authors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  alias text,
  mother_name text,
  birth_date date,
  document text,
  address text,
  neighborhood text,
  city text,
  crimes text,
  category_id uuid references public.author_categories(id) on delete set null,
  status text default 'Suspeito',
  risk_level text default 'Médio',
  notes text,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.author_photos (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.crime_authors(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  description text,
  uploaded_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.author_reports (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.crime_authors(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  description text,
  uploaded_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.crime_authors add column if not exists category_id uuid references public.author_categories(id) on delete set null;

create index if not exists crime_authors_category_id_idx on public.crime_authors(category_id);
create index if not exists author_categories_name_idx on public.author_categories(name);
create index if not exists crime_authors_name_idx on public.crime_authors using gin (to_tsvector('portuguese', coalesce(name,'') || ' ' || coalesce(alias,'') || ' ' || coalesce(crimes,'') || ' ' || coalesce(notes,'')));
create index if not exists author_photos_author_id_idx on public.author_photos(author_id);
create index if not exists author_reports_author_id_idx on public.author_reports(author_id);

alter table public.author_categories enable row level security;
alter table public.crime_authors enable row level security;
alter table public.author_photos enable row level security;
alter table public.author_reports enable row level security;


do $$ begin
  create policy "author_categories_all" on public.author_categories for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "crime_authors_all" on public.crime_authors for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "author_photos_all" on public.author_photos for all using (true) with check (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "author_reports_all" on public.author_reports for all using (true) with check (true);
exception when duplicate_object then null; end $$;

insert into storage.buckets (id, name, public)
values ('intelligence-files', 'intelligence-files', true)
on conflict (id) do nothing;

-- Políticas simples para ambiente interno já autenticado pelo app.
do $$ begin
  create policy "intelligence_files_select" on storage.objects for select using (bucket_id = 'intelligence-files');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "intelligence_files_insert" on storage.objects for insert with check (bucket_id = 'intelligence-files');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "intelligence_files_update" on storage.objects for update using (bucket_id = 'intelligence-files') with check (bucket_id = 'intelligence-files');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "intelligence_files_delete" on storage.objects for delete using (bucket_id = 'intelligence-files');
exception when duplicate_object then null; end $$;
