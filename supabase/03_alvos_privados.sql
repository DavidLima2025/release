-- =====================================================================
-- SI 6ª CIA — Fotos e relatórios do banco de alvos em espaço privado
-- (o site passa a abrir esses arquivos por link temporário de 12 horas).
-- Idempotente: pode rodar mais de uma vez.
-- =====================================================================

update storage.buckets set public = false where id = 'intelligence-files';

alter table public.crime_authors add column if not exists father_name text;
alter table public.author_photos add column if not exists description text;
alter table public.author_reports add column if not exists description text;

drop policy if exists intelligence_files_delete on storage.objects;
create policy intelligence_files_delete on storage.objects for delete to anon, authenticated using (bucket_id = 'intelligence-files');

notify pgrst, 'reload schema';
