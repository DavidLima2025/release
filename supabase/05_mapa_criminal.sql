-- =====================================================================
-- SI 6ª CIA — 05: mapa criminal das investigações.
-- Coordenadas dos fatos (lidas do REDS ou marcadas no mapa) e da
-- residência dos alvos. Idempotente.
-- =====================================================================

alter table public.investigation_items
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geo_source text,      -- REDS | Mapa | Coordenada | Endereço
  add column if not exists place text,           -- endereço do fato
  add column if not exists event_time text,      -- HH:MM do fato
  add column if not exists crime text;           -- natureza resumida (FURTO, ROUBO…)

alter table public.crime_authors
  add column if not exists home_lat double precision,
  add column if not exists home_lng double precision;

notify pgrst, 'reload schema';
