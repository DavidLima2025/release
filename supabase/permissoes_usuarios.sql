alter table app_users
add column if not exists permissions jsonb not null default '{}'::jsonb;

drop policy if exists allow_app_users_update on app_users;
create policy allow_app_users_update
on app_users for update
to anon
using (true)
with check (true);
