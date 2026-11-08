-- =====================================================================
-- SI 6ª CIA — 04: correções do armazenamento de fotos + link externo de
-- cadastro de alvos (outro policial cadastra; você aprova).
-- Audiências NÃO precisam de script (usam as demandas).
-- Idempotente: pode rodar mais de uma vez.
-- =====================================================================

-- ---------- 1. Armazenamento: tira limites de tipo/tamanho que bloqueavam fotos do celular ----------
update storage.buckets
   set file_size_limit = null, allowed_mime_types = null
 where id in ('intelligence-files', 'demand-files', 'investigation-files');

drop policy if exists intelligence_files_insert on storage.objects;
create policy intelligence_files_insert on storage.objects for insert to anon, authenticated with check (bucket_id = 'intelligence-files');
drop policy if exists intelligence_files_select on storage.objects;
create policy intelligence_files_select on storage.objects for select to anon, authenticated using (bucket_id = 'intelligence-files');
drop policy if exists intelligence_files_update on storage.objects;
create policy intelligence_files_update on storage.objects for update to anon, authenticated using (bucket_id = 'intelligence-files') with check (bucket_id = 'intelligence-files');
drop policy if exists intelligence_files_delete on storage.objects;
create policy intelligence_files_delete on storage.objects for delete to anon, authenticated using (bucket_id = 'intelligence-files');

-- ---------- 2. Links externos de cadastro ----------
create table if not exists public.intake_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  label text not null,
  folder_id uuid,
  created_by uuid,
  expires_at timestamptz,
  active boolean not null default true,
  uses int not null default 0,
  max_uses int not null default 300,
  created_at timestamptz not null default now()
);

create table if not exists public.intake_submissions (
  id uuid primary key default gen_random_uuid(),
  link_id uuid references public.intake_links(id) on delete set null,
  link_label text,
  submitter jsonb not null default '{}'::jsonb,   -- nome, matrícula, unidade, telefone
  payload jsonb not null default '{}'::jsonb,     -- dados do alvo
  files jsonb not null default '[]'::jsonb,       -- [{path, name, size, type, kind}]
  status text not null default 'Pendente',        -- Pendente | Aprovado | Recusado
  author_id uuid references public.crime_authors(id) on delete set null,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create index if not exists intake_submissions_status_idx on public.intake_submissions (status, created_at desc);

alter table public.intake_links enable row level security;
alter table public.intake_submissions enable row level security;
grant select, insert, update, delete on public.intake_links, public.intake_submissions to anon, authenticated;

-- Só quem está logado no sistema (sessão válida) vê e gerencia links e recebidos.
drop policy if exists session_intake_links_all on public.intake_links;
create policy session_intake_links_all on public.intake_links for all to anon, authenticated
  using ((select public.request_session_valid())) with check ((select public.request_session_valid()));
drop policy if exists session_intake_submissions_all on public.intake_submissions;
create policy session_intake_submissions_all on public.intake_submissions for all to anon, authenticated
  using ((select public.request_session_valid())) with check ((select public.request_session_valid()));

-- Página pública: confere o link sem expor nada da base.
create or replace function public.intake_link_info(p_token text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare l public.intake_links;
begin
  select * into l from public.intake_links where token = p_token;
  if l.id is null then return jsonb_build_object('valid', false, 'reason', 'Link inválido.'); end if;
  if not l.active then return jsonb_build_object('valid', false, 'reason', 'Este link foi desativado.'); end if;
  if l.expires_at is not null and l.expires_at < now() then return jsonb_build_object('valid', false, 'reason', 'Este link expirou.'); end if;
  if l.uses >= l.max_uses then return jsonb_build_object('valid', false, 'reason', 'Limite de envios deste link atingido.'); end if;
  return jsonb_build_object('valid', true, 'label', l.label, 'link_id', l.id, 'expires_at', l.expires_at);
end $$;

-- Página pública: grava o envio (fica "Pendente" até você aprovar).
create or replace function public.intake_submit(p_token text, p_submitter jsonb, p_payload jsonb, p_files jsonb)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare l public.intake_links; v_id uuid;
begin
  select * into l from public.intake_links where token = p_token for update;
  if l.id is null or not l.active or (l.expires_at is not null and l.expires_at < now()) or l.uses >= l.max_uses then
    raise exception 'Link inválido ou expirado.';
  end if;
  if coalesce(trim(p_payload->>'name'), '') = '' then raise exception 'Informe o nome do alvo.'; end if;
  if coalesce(trim(p_submitter->>'name'), '') = '' then raise exception 'Identifique-se (nome e unidade).'; end if;
  if length(p_payload::text) > 30000 or length(p_submitter::text) > 2000 or jsonb_array_length(coalesce(p_files, '[]'::jsonb)) > 12 then
    raise exception 'Envio grande demais.';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_files, '[]'::jsonb)) f where (f->>'path') not like 'externo/' || l.id::text || '/%') then
    raise exception 'Arquivo inválido.';
  end if;
  insert into public.intake_submissions (link_id, link_label, submitter, payload, files)
  values (l.id, l.label, p_submitter, p_payload, coalesce(p_files, '[]'::jsonb))
  returning id into v_id;
  update public.intake_links set uses = uses + 1 where id = l.id;
  insert into public.audit_logs (action, details, user_name, user_role)
  values ('Cadastro externo recebido', format('%s (%s) enviou o alvo %s pelo link "%s".', p_submitter->>'name', coalesce(p_submitter->>'unit', '—'), p_payload->>'name', l.label), coalesce(p_submitter->>'name', 'Externo'), 'Externo');
  return v_id;
end $$;

grant execute on function public.intake_link_info(text) to anon, authenticated;
grant execute on function public.intake_submit(text, jsonb, jsonb, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';

-- Conferência: configuração dos espaços de arquivos.
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
