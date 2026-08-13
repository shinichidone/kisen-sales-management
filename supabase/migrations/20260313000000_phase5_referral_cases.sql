-- STEP5: 紹介案件管理（営業履歴とは別管理。紹介→調整→見学・面談→利用開始 or 利用に至らず）

create type public.referral_status as enum (
  'referred',   -- 紹介
  'adjusting',  -- 調整
  'visiting',   -- 見学・面談
  'started',    -- 利用開始
  'lost'        -- 利用に至らず
);

create type public.referral_lost_reason as enum (
  'no_vacancy',           -- 空きなし
  'schedule_mismatch',    -- 曜日が合わない
  'out_of_area',          -- エリア外
  'family_declined',      -- 本人・家族希望なし
  'chose_other_provider', -- 他事業所に決定
  'hospitalized',         -- 入院・状態変化
  'condition_mismatch',   -- 条件不一致
  'other'                 -- その他（自由入力）
);

create sequence public.referral_case_number_seq start 1;

-- 紹介案件（利用者個人情報は持たず、案件番号で管理）
create table public.referral_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique
    default ('RC-' || lpad(nextval('public.referral_case_number_seq')::text, 5, '0')),
  source_facility_id uuid not null references public.facilities (id) on delete restrict,
  source_contact_id uuid references public.contacts (id) on delete set null,
  service_id uuid not null references public.services (id) on delete restrict,
  related_visit_id uuid references public.sales_visits (id) on delete set null,
  referred_on date not null default (timezone('Asia/Tokyo', now()))::date,
  status public.referral_status not null default 'referred',
  lost_reason public.referral_lost_reason,
  lost_reason_other text,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint referral_cases_lost_reason_requires_status check (
    (status = 'lost' and lost_reason is not null)
    or (status <> 'lost' and lost_reason is null)
  ),
  constraint referral_cases_lost_other_requires_text check (
    lost_reason is null
    or lost_reason <> 'other'
    or char_length(btrim(coalesce(lost_reason_other, ''))) > 0
  )
);

create trigger referral_cases_set_updated_at
  before update on public.referral_cases
  for each row execute function public.set_updated_at();

create index referral_cases_facility_idx
  on public.referral_cases (source_facility_id, referred_on desc);

create index referral_cases_status_idx
  on public.referral_cases (status);

-- Phase1〜4同様、STEP7（権限管理）まで暫定で anon に開放
alter table public.referral_cases enable row level security;

create policy "phase5_referral_cases_select_all"
  on public.referral_cases for select to anon, authenticated using (true);
create policy "phase5_referral_cases_insert_all"
  on public.referral_cases for insert to anon, authenticated with check (true);
create policy "phase5_referral_cases_update_all"
  on public.referral_cases for update to anon, authenticated using (true) with check (true);

grant usage on sequence public.referral_case_number_seq to anon, authenticated;
grant select, insert, update on table public.referral_cases to anon, authenticated;
