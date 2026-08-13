-- 社員名簿などと auth.users を共有しているため、
-- 既存アカウントで営業管理にログインしても app_users が無いことがある。
-- ログイン中ユーザーが自分の行を pending で作れるようにする。

create or replace function public.kisen_sales_ensure_app_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  uemail text;
  uname text;
begin
  if uid is null then
    return;
  end if;

  select
    au.email,
    coalesce(
      nullif(btrim(au.raw_user_meta_data ->> 'display_name'), ''),
      split_part(au.email, '@', 1)
    )
  into uemail, uname
  from auth.users au
  where au.id = uid;

  if uemail is null then
    return;
  end if;

  insert into public.app_users (id, email, display_name, role, status)
  values (uid, uemail, uname, 'staff', 'pending')
  on conflict (id) do nothing;
end;
$$;

grant execute on function public.kisen_sales_ensure_app_user() to authenticated;
