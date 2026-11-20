-- SI 6ª CIA — 11: alvo "não identificado" no organograma (sem card no banco de alvos)
-- e histórico do grupo (entradas, saídas, prisões, troca de função). Idempotente.
alter table public.investigation_targets alter column author_id drop not null;
alter table public.investigation_targets add column if not exists label text not null default '';
alter table public.investigation_targets add column if not exists history jsonb not null default '[]'::jsonb;
alter table public.investigation_targets drop constraint if exists investigation_targets_author_or_label;
alter table public.investigation_targets add constraint investigation_targets_author_or_label check (author_id is not null or label <> '');
notify pgrst, 'reload schema';
