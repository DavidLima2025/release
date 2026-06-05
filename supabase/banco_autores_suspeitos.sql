-- Banco de Alvos / Autores e Suspeitos
-- Execute no SQL Editor do Supabase.
-- Estrutura alinhada ao app: pastas, cards de autores, fotos e relatórios.

create table if not exists public.author_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.author_folders (name, description) values
  ('Tráfico de drogas', 'Autores e suspeitos vinculados ao tráfico de drogas.'),
  ('Receptação', 'Autores e suspeitos vinculados à receptação.'),
  ('Arrombamento', 'Autores e suspeitos vinculados a arrombamentos.'),
  ('Furto de correntinha', 'Autores e suspeitos vinculados a furtos de correntinha.')
on conflict (name) do nothing;

create table if not exists public.crime_authors (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public.author_folders(id) on delete set null,
  name text,
  alias text,
  mother_name text,
  father_name text,
  birth_date date,
  document text,
  cpf text,
  rg text,
  address text,
  neighborhood text,
  city text,
  state text,
  crimes text,
  status text default 'Suspeito',
  risk_level text default 'Médio',
  notes text,
  photo_url text,
  main_photo_url text,
  created_by uuid references public.app_users(id) on delete set null,
  updated_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.crime_authors add column if not exists folder_id uuid references public.author_folders(id) on delete set null;
alter table public.crime_authors add column if not exists name text;
alter table public.crime_authors add column if not exists alias text;
alter table public.crime_authors add column if not exists mother_name text;
alter table public.crime_authors add column if not exists father_name text;
alter table public.crime_authors add column if not exists birth_date date;
alter table public.crime_authors add column if not exists document text;
alter table public.crime_authors add column if not exists cpf text;
alter table public.crime_authors add column if not exists rg text;
alter table public.crime_authors add column if not exists address text;
alter table public.crime_authors add column if not exists neighborhood text;
alter table public.crime_authors add column if not exists city text;
alter table public.crime_authors add column if not exists state text;
alter table public.crime_authors add column if not exists crimes text;
alter table public.crime_authors add column if not exists status text default 'Suspeito';
alter table public.crime_authors add column if not exists risk_level text default 'Médio';
alter table public.crime_authors add column if not exists notes text;
alter table public.crime_authors add column if not exists photo_url text;
alter table public.crime_authors add column if not exists main_photo_url text;
alter table public.crime_authors add column if not exists created_by uuid references public.app_users(id) on delete set null;
alter table public.crime_authors add column if not exists updated_by uuid references public.app_users(id) on delete set null;
alter table public.crime_authors add column if not exists updated_at timestamptz default now();

-- Remove obrigatoriedade de colunas antigas, caso tenham sido criadas em versões anteriores.
alter table public.crime_authors alter column name drop not null;
do $$ begin
  alter table public.crime_authors alter column nome drop not null;
exception when undefined_column then null; end $$;

create table if not exists public.author_photos (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.crime_authors(id) on delete cascade,
  file_name text,
  file_path text,
  file_size bigint,
  mime_type text,
  description text,
  uploaded_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.author_reports (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.crime_authors(id) on delete cascade,
  file_name text,
  file_path text,
  file_size bigint,
  mime_type text,
  description text,
  uploaded_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists public.author_files (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.crime_authors(id) on delete cascade,
  file_name text,
  file_url text,
  file_path text,
  file_size bigint,
  mime_type text,
  created_at timestamptz default now()
);

create index if not exists crime_authors_folder_id_idx on public.crime_authors(folder_id);
create index if not exists author_folders_name_idx on public.author_folders(name);
create index if not exists crime_authors_name_idx on public.crime_authors using gin (to_tsvector('portuguese', coalesce(name,'') || ' ' || coalesce(alias,'') || ' ' || coalesce(crimes,'') || ' ' || coalesce(notes,'')));
create index if not exists author_photos_author_id_idx on public.author_photos(author_id);
create index if not exists author_reports_author_id_idx on public.author_reports(author_id);

-- App interno: libera tabelas para uso via chave anon do projeto.
alter table public.author_folders disable row level security;
alter table public.crime_authors disable row level security;
alter table public.author_photos disable row level security;
alter table public.author_reports disable row level security;
alter table public.author_files disable row level security;

insert into storage.buckets (id, name, public)
values ('intelligence-files', 'intelligence-files', true)
on conflict (id) do update set public = true;

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

notify pgrst, 'reload schema';
