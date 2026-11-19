-- SI 6ª CIA — 09: dados adicionais do alvo e categorias de foto
-- (perfil, ocorrencia, levantamento). Idempotente.
alter table public.author_photos add column if not exists category text not null default 'perfil';
alter table public.crime_authors add column if not exists extra jsonb not null default '{}'::jsonb;
notify pgrst, 'reload schema';
