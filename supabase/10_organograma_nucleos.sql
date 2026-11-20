-- SI 6ª CIA — 10: organograma por núcleos, área de atuação e indícios da função. Idempotente.
-- investigation_targets.cluster  : núcleo do alvo no organograma (vazio = núcleo automático pela função)
-- investigation_targets.area     : área/local de atuação
-- investigation_targets.evidence : indícios da função/atuação [{id, source, note, date}]
-- investigations.org_groups      : núcleos definidos pelo analista [{name, activities, color}]
alter table public.investigation_targets add column if not exists cluster text not null default '';
alter table public.investigation_targets add column if not exists area text not null default '';
alter table public.investigation_targets add column if not exists evidence jsonb not null default '[]'::jsonb;
alter table public.investigations add column if not exists org_groups jsonb not null default '[]'::jsonb;
notify pgrst, 'reload schema';
