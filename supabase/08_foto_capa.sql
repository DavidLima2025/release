-- SI 6ª CIA — 08: escolher a foto de capa do alvo. Idempotente.
alter table public.author_photos add column if not exists is_cover boolean not null default false;
create index if not exists author_photos_cover_idx on public.author_photos (author_id, is_cover);
notify pgrst, 'reload schema';
