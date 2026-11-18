-- =====================================================================
-- SI 6ª CIA — 06: unir cadastros repetidos de alvos (numa transação só).
-- O cadastro principal recebe os dados escolhidos, as fotos, relatórios,
-- vínculos em investigações (sem duplicar) e as fontes; os demais são apagados.
-- Idempotente.
-- =====================================================================

create or replace function public.merge_authors(p_keep uuid, p_remove uuid[], p_fields jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  u public.app_users := public.request_session_user();
  t_rm record;
  t_keep uuid;
  v_names text;
  v_keep_name text;
  v_moved_targets int := 0;
begin
  if u.id is null then raise exception 'Sessão inválida. Entre novamente.'; end if;
  p_remove := array(select distinct x from unnest(coalesce(p_remove, '{}')) x where x is not null and x <> p_keep);
  if array_length(p_remove, 1) is null then raise exception 'Escolha pelo menos um cadastro para unir.'; end if;
  if not exists (select 1 from crime_authors where id = p_keep) then raise exception 'Cadastro principal não encontrado.'; end if;
  select string_agg(name, ', ') into v_names from crime_authors where id = any(p_remove);

  -- Dados escolhidos na tela (só os campos enviados).
  update crime_authors set
    name         = case when p_fields ? 'name' then nullif(trim(p_fields->>'name'), '') else name end,
    alias        = case when p_fields ? 'alias' then p_fields->>'alias' else alias end,
    mother_name  = case when p_fields ? 'motherName' then p_fields->>'motherName' else mother_name end,
    father_name  = case when p_fields ? 'fatherName' then p_fields->>'fatherName' else father_name end,
    birth_date   = case when p_fields ? 'birthDate' then nullif(p_fields->>'birthDate', '')::date else birth_date end,
    document     = case when p_fields ? 'document' then p_fields->>'document' else document end,
    address      = case when p_fields ? 'address' then p_fields->>'address' else address end,
    neighborhood = case when p_fields ? 'neighborhood' then p_fields->>'neighborhood' else neighborhood end,
    city         = case when p_fields ? 'city' then p_fields->>'city' else city end,
    crimes       = case when p_fields ? 'crimes' then p_fields->>'crimes' else crimes end,
    folder_id    = case when p_fields ? 'categoryId' then nullif(p_fields->>'categoryId', '')::uuid else folder_id end,
    status       = case when p_fields ? 'status' then p_fields->>'status' else status end,
    risk_level   = case when p_fields ? 'riskLevel' then p_fields->>'riskLevel' else risk_level end,
    notes        = case when p_fields ? 'notes' then p_fields->>'notes' else notes end,
    home_lat     = case when p_fields ? 'homeLat' then nullif(p_fields->>'homeLat', '')::double precision else home_lat end,
    home_lng     = case when p_fields ? 'homeLng' then nullif(p_fields->>'homeLng', '')::double precision else home_lng end
  where id = p_keep
  returning name into v_keep_name;

  -- Arquivos.
  update author_photos set author_id = p_keep where author_id = any(p_remove);
  update author_reports set author_id = p_keep where author_id = any(p_remove);
  if to_regclass('public.author_files') is not null then
    execute 'update public.author_files set author_id = $1 where author_id = any($2)' using p_keep, p_remove;
  end if;

  -- Investigações: o alvo repetido passa para o principal; se os dois já estavam na mesma, os vínculos são transferidos.
  for t_rm in select * from investigation_targets where author_id = any(p_remove) loop
    select id into t_keep from investigation_targets where investigation_id = t_rm.investigation_id and author_id = p_keep;
    if t_keep is null then
      update investigation_targets set author_id = p_keep where id = t_rm.id;
    else
      update investigation_links set from_target = t_keep where from_target = t_rm.id;
      update investigation_links set to_target = t_keep where to_target = t_rm.id;
      update investigation_targets set parent_id = t_keep where parent_id = t_rm.id and id <> t_keep;
      update investigation_targets set parent_id = null where id = t_keep and parent_id = t_keep;
      delete from investigation_targets where id = t_rm.id;
    end if;
    v_moved_targets := v_moved_targets + 1;
  end loop;
  delete from investigation_links where from_target = to_target;
  delete from investigation_links l using investigation_links d
   where l.investigation_id = d.investigation_id and l.relation = d.relation and l.id > d.id
     and ((l.from_target = d.from_target and l.to_target = d.to_target) or (l.from_target = d.to_target and l.to_target = d.from_target));

  -- Fontes (BOs) que citavam o repetido passam a citar o principal.
  update investigation_items
     set author_ids = array(select distinct case when x = any(p_remove) then p_keep else x end from unnest(author_ids) x)
   where author_ids && p_remove;

  update intake_submissions set author_id = p_keep where author_id = any(p_remove);
  delete from crime_authors where id = any(p_remove);

  insert into audit_logs (user_id, user_name, user_role, action, details)
  values (u.id, coalesce(nullif(u.war_name, ''), u.name), u.role, 'Alvos unidos',
          format('Uniu %s cadastro(s) (%s) ao card de %s.', array_length(p_remove, 1), v_names, v_keep_name));

  return jsonb_build_object('kept', p_keep, 'removed', array_length(p_remove, 1), 'targets', v_moved_targets);
end $$;

revoke all on function public.merge_authors(uuid, uuid[], jsonb) from public;
grant execute on function public.merge_authors(uuid, uuid[], jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
