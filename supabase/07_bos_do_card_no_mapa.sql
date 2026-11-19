-- =====================================================================
-- SI 6ª CIA — 07: dados do fato nos BOs anexados ao card do alvo,
-- para aparecerem no mapa criminal e na linha do tempo. Idempotente.
-- =====================================================================

alter table public.author_reports
  add column if not exists reds text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geo_source text,
  add column if not exists place text,
  add column if not exists crime text,
  add column if not exists event_date date,
  add column if not exists event_time text;

-- Preenche o nº do REDS dos BOs já anexados (vem na descrição "REDS nº — papel").
update public.author_reports
   set reds = substring(coalesce(description, '') || ' ' || coalesce(file_name, '') from '(\d{4}-\d{9}-\d{3})')
 where reds is null and (coalesce(description, '') || ' ' || coalesce(file_name, '')) ~ '\d{4}-\d{9}-\d{3}';

create index if not exists author_reports_reds_idx on public.author_reports (reds);

notify pgrst, 'reload schema';
