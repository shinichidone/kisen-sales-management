-- 社内ツールのため、確認メールは使わない。
-- 利用開始の可否は app_users.status（管理者承認）だけで制御する。
--
-- 共有Supabaseのため、auth.users 全員は触らない。
-- このアプリの app_users が作られたアカウントだけメール確認済みにする。

create or replace function public.kisen_sales_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (id, email, display_name, role, status)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1)
    ),
    'staff',
    'pending'
  )
  on conflict (id) do nothing;

  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = new.id
    and email_confirmed_at is null;

  return new;
end;
$$;

-- すでに登録済みで確認メールが届いていないスタッフも、同じ扱いにする
update auth.users au
set email_confirmed_at = now()
where au.email_confirmed_at is null
  and exists (
    select 1 from public.app_users u where u.id = au.id
  );
