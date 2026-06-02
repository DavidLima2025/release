create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  user_name text,
  user_role text,
  action text not null,
  details text,
  created_at timestamptz not null default now()
);

alter table audit_logs enable row level security;

drop policy if exists allow_audit_logs_all on audit_logs;
create policy allow_audit_logs_all
on audit_logs for all
to anon
using (true)
with check (true);

drop policy if exists allow_app_users_insert on app_users;
create policy allow_app_users_insert on app_users for insert to anon with check (true);

drop policy if exists allow_app_users_update on app_users;
create policy allow_app_users_update on app_users for update to anon using (true) with check (true);

drop policy if exists allow_app_users_delete on app_users;
create policy allow_app_users_delete on app_users for delete to anon using (true);
