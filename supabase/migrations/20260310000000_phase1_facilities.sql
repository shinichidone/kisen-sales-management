-- Phase1: 施設MAP基盤
-- 最終MVPへ拡張する前提の本番スキーマ（認証・RLSの本格運用はSTEP7）

create extension if not exists "pgcrypto";

-- 施設種別
create type public.facility_type as enum (
  'home_care_support',      -- 居宅介護支援事業所
  'community_support',      -- 地域包括支援センター
  'hospital',               -- 病院
  'clinic',                 -- クリニック・診療所
  'care_facility',          -- 介護施設
  'other'                   -- その他
);

-- 自社サービス（営業対象）
create table public.services (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.services (code, name, sort_order) values
  ('shoeicho', 'デイサービス喜仙 昭栄町', 1),
  ('minami-hanadai', 'デイサービス喜仙 南花台', 2),
  ('houmon-kango', '訪問看護ステーション喜仙', 3);

-- 営業先施設
create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  google_place_id text,
  name text not null,
  facility_type public.facility_type not null,
  address text not null,
  city text not null,
  phone text,
  lat double precision not null,
  lng double precision not null,
  shared_memo text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint facilities_name_not_blank check (char_length(trim(name)) > 0),
  constraint facilities_address_not_blank check (char_length(trim(address)) > 0),
  constraint facilities_city_not_blank check (char_length(trim(city)) > 0)
);

-- Place ID がある場合は一意（重複登録防止）
create unique index facilities_google_place_id_uidx
  on public.facilities (google_place_id)
  where google_place_id is not null;

create index facilities_city_idx on public.facilities (city);
create index facilities_is_active_idx on public.facilities (is_active);
create index facilities_location_idx on public.facilities (lat, lng);

-- 施設 × 営業対象サービス（多対多）
create table public.facility_target_services (
  facility_id uuid not null references public.facilities (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (facility_id, service_id)
);

create index facility_target_services_service_idx
  on public.facility_target_services (service_id);

-- updated_at 自動更新
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger facilities_set_updated_at
  before update on public.facilities
  for each row execute function public.set_updated_at();

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- Phase1: ログイン前でもMAP検証できるよう anon に限定開放
-- ※ STEP7（権限管理）で本番RLSへ締め直すこと
alter table public.services enable row level security;
alter table public.facilities enable row level security;
alter table public.facility_target_services enable row level security;

create policy "phase1_services_select_all"
  on public.services for select
  to anon, authenticated
  using (true);

create policy "phase1_facilities_select_all"
  on public.facilities for select
  to anon, authenticated
  using (true);

create policy "phase1_facilities_insert_all"
  on public.facilities for insert
  to anon, authenticated
  with check (true);

create policy "phase1_facilities_update_all"
  on public.facilities for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "phase1_facility_target_services_select_all"
  on public.facility_target_services for select
  to anon, authenticated
  using (true);

create policy "phase1_facility_target_services_insert_all"
  on public.facility_target_services for insert
  to anon, authenticated
  with check (true);

create policy "phase1_facility_target_services_delete_all"
  on public.facility_target_services for delete
  to anon, authenticated
  using (true);

-- RLS に加えて、ロールへのテーブル権限付与が必要
grant usage on schema public to anon, authenticated;
grant select on table public.services to anon, authenticated;
grant select, insert, update on table public.facilities to anon, authenticated;
grant select, insert, delete on table public.facility_target_services to anon, authenticated;
