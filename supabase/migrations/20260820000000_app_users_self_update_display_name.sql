-- 表示名を本人が変更できるようにする。
-- 役割・ステータス・メールはシステム管理者以外は変更不可。

create or replace function public.kisen_sales_guard_app_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if btrim(coalesce(new.display_name, '')) = '' then
    raise exception '表示名を入力してください';
  end if;
  new.display_name := btrim(new.display_name);

  if public.is_system_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
     or new.email is distinct from old.email
     or new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.created_at is distinct from old.created_at then
    raise exception '名前以外は変更できません';
  end if;

  if new.id is distinct from auth.uid() then
    raise exception '自分の名前だけ変更できます';
  end if;

  return new;
end;
$$;

drop trigger if exists kisen_sales_guard_app_user_update on public.app_users;
create trigger kisen_sales_guard_app_user_update
  before update on public.app_users
  for each row execute function public.kisen_sales_guard_app_user_update();

drop policy if exists "phase7_app_users_update_own_name" on public.app_users;
create policy "phase7_app_users_update_own_name"
  on public.app_users for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
