-- SI 6ª CIA — 14: catálogo de papéis (funções) dos alvos, com opção de criar e excluir. Idempotente.
-- target_roles.name       : nome do papel (único, sem diferenciar maiúsculas)
-- target_roles.color      : cor do papel no organograma, PDF e legendas (#RRGGBB)
-- target_roles.level      : grau/linha em que o papel aparece no quadro (0 = topo ... 6)
-- target_roles.group_name : núcleo automático do papel (vazio = o próprio nome, em maiúsculas). Papéis com o mesmo núcleo ficam juntos.
-- investigation_targets.role continua sendo o nome do papel (texto); excluir um papel não apaga alvos.
create table if not exists public.target_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#6B655A',
  level int not null default 3,
  group_name text not null default '',
  position int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint target_roles_level_ck check (level between 0 and 6),
  constraint target_roles_name_ck check (char_length(btrim(name)) between 2 and 40),
  constraint target_roles_color_ck check (color ~ '^#[0-9A-Fa-f]{6}$')
);
create unique index if not exists target_roles_name_uq on public.target_roles (lower(btrim(name)));

-- Os 10 papéis que o sistema já usava (só entram se a tabela estiver vazia).
insert into public.target_roles (name, color, level, group_name, position)
select v.name, v.color, v.level, v.grp, v.pos
from (values
  ('Líder', '#B3261E', 0, 'LIDERANÇA', 0),
  ('Gerente', '#C28A12', 1, 'GERÊNCIA', 1),
  ('Financeiro', '#7A6C45', 1, 'OPERADORES FINANCEIROS', 2),
  ('Executor', '#231F20', 2, 'EXECUTORES', 3),
  ('Apoio / logística', '#2F5D7C', 2, 'APOIO E LOGÍSTICA', 4),
  ('Receptador', '#5B3E8A', 2, 'RECEPTAÇÃO', 5),
  ('Olheiro', '#5F5E5A', 2, 'OLHEIROS / VIGILÂNCIA', 6),
  ('Associado', '#6B655A', 3, 'ASSOCIADOS', 7),
  ('Vítima', '#2E6B3A', 4, 'VÍTIMAS E TESTEMUNHAS', 8),
  ('Testemunha', '#2E6B3A', 4, 'VÍTIMAS E TESTEMUNHAS', 9)
) as v(name, color, level, grp, pos)
where not exists (select 1 from public.target_roles);

alter table public.target_roles enable row level security;
drop policy if exists session_target_roles_all on public.target_roles;
create policy session_target_roles_all on public.target_roles for all to anon, authenticated
  using ((select public.request_can_investigate())) with check ((select public.request_can_investigate()));
grant select, insert, update, delete on public.target_roles to anon, authenticated;
notify pgrst, 'reload schema';
