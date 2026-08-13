-- STEP7: 認証・権限の基盤（テーブル・トリガー・ヘルパー関数）
-- RLSの締め直し自体は次の 20260314000001_phase7_rls_tighten.sql で行う。
--
-- 重要: このプロジェクトは社員名簿・家計簿と共有のSupabaseプロジェクトです。
-- 既存の public.profiles には一切触れません（参照・変更いずれも行いません）。
-- auth.users はプロジェクト共通のため、ログインアカウント自体は他アプリと共有されます。

create type public.app_role as enum (
  'staff',          -- 一般営業スタッフ
  'facility_admin', -- 事業所管理者
  'system_admin'    -- システム管理者
);

create type public.app_user_status as enum (
  'pending',  -- 自己登録直後・承認待ち
  'active',   -- 承認済み・利用可能
  'disabled'  -- 無効化（退職者など。物理削除はしない）
);

-- 本アプリ用のユーザー情報（auth.usersを拡張。emailはトリガーで複製して保持）
create table public.app_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text not null,
  role public.app_role not null default 'staff',
  status public.app_user_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger app_users_set_updated_at
  before update on public.app_users
  for each row execute function public.set_updated_at();

-- 所属事業所（= services への複数選択。事業所管理者の権限スコープに使う）
create table public.app_user_services (
  user_id uuid not null references public.app_users (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, service_id)
);

create index app_user_services_service_idx
  on public.app_user_services (service_id);

-- 新規サインアップ時に app_users 行を自動作成する（初期値: staff / pending）
-- 既存の他アプリ側トリガー（社員名簿の profiles 用など）とは別名にして共存させる。
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
  return new;
end;
$$;

create trigger kisen_sales_on_auth_user_created
  after insert on auth.users
  for each row execute function public.kisen_sales_handle_new_user();

-- RLSポリシーで使うヘルパー関数（security definer で app_users のRLSに関係なく判定できるようにする）
create or replace function public.is_active_app_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.app_users
  where id = auth.uid() and status = 'active';
$$;

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active' and role = 'system_admin'
  );
$$;

create or replace function public.current_app_service_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(aus.service_id), '{}'::uuid[])
  from public.app_user_services aus
  join public.app_users au on au.id = aus.user_id
  where aus.user_id = auth.uid() and au.status = 'active';
$$;

grant execute on function public.is_active_app_user() to anon, authenticated;
grant execute on function public.current_app_role() to anon, authenticated;
grant execute on function public.is_system_admin() to anon, authenticated;
grant execute on function public.current_app_service_ids() to anon, authenticated;

-- 「本人が7日以内に編集できる」判定用に、営業履歴の登録者をUUIDで持つ
alter table public.sales_visits
  add column created_by uuid references auth.users (id) on delete set null;

create index sales_visits_created_by_idx
  on public.sales_visits (created_by);

-- 新しいテーブルはRLSを有効化するのみ（ポリシーは次の締め直しマイグレーションで定義）
alter table public.app_users enable row level security;
alter table public.app_user_services enable row level security;
