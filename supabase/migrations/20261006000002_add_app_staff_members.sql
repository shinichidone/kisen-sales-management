-- 1つのログインアカウントを複数スタッフで共有する運用向けのスタッフ名簿。
-- 認証・権限は app_users のアカウント単位、営業履歴の表示名は選択スタッフ単位で記録する。

create table if not exists public.app_staff_members (
  id uuid primary key default gen_random_uuid(),
  app_user_id uuid not null references public.app_users (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists app_staff_members_set_updated_at on public.app_staff_members;
create trigger app_staff_members_set_updated_at
  before update on public.app_staff_members
  for each row execute function public.set_updated_at();

create unique index app_staff_members_active_name_unique
  on public.app_staff_members (app_user_id, lower(btrim(name)))
  where is_active;

insert into public.app_staff_members (app_user_id, name)
select au.id, au.display_name
from public.app_users au
where length(btrim(au.display_name)) > 0
  and not exists (
    select 1 from public.app_staff_members asm
    where asm.app_user_id = au.id and lower(btrim(asm.name)) = lower(btrim(au.display_name))
  );

alter table public.app_staff_members enable row level security;

drop policy if exists app_staff_members_select_own on public.app_staff_members;
create policy app_staff_members_select_own
  on public.app_staff_members for select
  to authenticated
  using (app_user_id = auth.uid() and public.is_active_app_user());

drop policy if exists app_staff_members_insert_own on public.app_staff_members;
create policy app_staff_members_insert_own
  on public.app_staff_members for insert
  to authenticated
  with check (app_user_id = auth.uid() and public.is_active_app_user());

drop policy if exists app_staff_members_update_own on public.app_staff_members;
create policy app_staff_members_update_own
  on public.app_staff_members for update
  to authenticated
  using (app_user_id = auth.uid() and public.is_active_app_user())
  with check (app_user_id = auth.uid() and public.is_active_app_user());

grant select, insert, update on public.app_staff_members to authenticated;
