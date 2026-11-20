-- SI 6ª CIA — 12: grau na hierarquia definido pelo analista (1 = topo). Vazio = pela função. Idempotente.
alter table public.investigation_targets add column if not exists grade int;
notify pgrst, 'reload schema';
