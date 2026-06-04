-- Melhorias: anexos de demandas no Supabase Storage
-- 1) Crie um bucket público chamado demand-files no painel do Supabase
--    ou execute a criação abaixo, se seu projeto permitir via SQL.

insert into storage.buckets (id, name, public)
values ('demand-files', 'demand-files', true)
on conflict (id) do update set public = true;

create table if not exists demand_attachments (
  id uuid primary key default gen_random_uuid(),
  demand_id uuid not null references demands(id) on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  mime_type text,
  uploaded_by uuid,
  created_at timestamptz not null default now()
);

alter table demand_attachments enable row level security;

drop policy if exists allow_demand_attachments_all on demand_attachments;
create policy allow_demand_attachments_all
on demand_attachments for all
to anon
using (true)
with check (true);

drop policy if exists allow_demand_files_read on storage.objects;
create policy allow_demand_files_read
on storage.objects for select
to anon
using (bucket_id = 'demand-files');

drop policy if exists allow_demand_files_insert on storage.objects;
create policy allow_demand_files_insert
on storage.objects for insert
to anon
with check (bucket_id = 'demand-files');

drop policy if exists allow_demand_files_update on storage.objects;
create policy allow_demand_files_update
on storage.objects for update
to anon
using (bucket_id = 'demand-files')
with check (bucket_id = 'demand-files');

drop policy if exists allow_demand_files_delete on storage.objects;
create policy allow_demand_files_delete
on storage.objects for delete
to anon
using (bucket_id = 'demand-files');
