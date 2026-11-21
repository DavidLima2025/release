-- SI 6ª CIA — 13: posições do quadro por núcleos arrastadas à mão. Idempotente.
-- investigations.org_layout : {"groups": {"<chave do núcleo>": {x, y}}, "cards": {"<id do alvo>": {x, y, g}}}
--   vazio ({}) = tudo no posicionamento automático. g = núcleo em que o cartão estava quando foi movido.
alter table public.investigations add column if not exists org_layout jsonb not null default '{}'::jsonb;
notify pgrst, 'reload schema';
