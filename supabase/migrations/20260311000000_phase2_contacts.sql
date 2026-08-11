-- STEP2: 施設・担当者管理（人物と所属を分離、共有メモ履歴）

create type public.contact_job_role as enum (
  'care_manager',           -- ケアマネジャー
  'chief_care_manager',     -- 主任ケアマネジャー
  'social_worker',          -- 社会福祉士
  'msw',                    -- MSW
  'nurse',                  -- 看護師
  'public_health_nurse',    -- 保健師
  'discharge_support',      -- 退院支援担当
  'counselor',              -- 相談員
  'facility_manager',       -- 施設長・管理者
  'doctor',                 -- 医師
  'other'                   -- その他（自由入力）
);

-- 担当者（人物マスタ。施設を異動しても同一人物として残す）
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  job_role public.contact_job_role not null,
  job_role_other text,
  note text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_name_not_blank check (char_length(trim(name)) > 0),
  constraint contacts_other_role_requires_text check (
    (
      job_role <> 'other'
      and (job_role_other is null or btrim(job_role_other) = '')
    )
    or (
      job_role = 'other'
      and char_length(btrim(coalesce(job_role_other, ''))) > 0
    )
  )
);

create trigger contacts_set_updated_at
  before update on public.contacts
  for each row execute function public.set_updated_at();

-- 施設への所属（現在所属は ended_on is null）
create table public.facility_affiliations (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete restrict,
  started_on date not null default (timezone('Asia/Tokyo', now()))::date,
  ended_on date,
  created_at timestamptz not null default now(),
  constraint facility_affiliations_date_range check (
    ended_on is null or ended_on >= started_on
  )
);

create unique index facility_affiliations_active_uidx
  on public.facility_affiliations (facility_id, contact_id)
  where ended_on is null;

create index facility_affiliations_facility_idx
  on public.facility_affiliations (facility_id);

create index facility_affiliations_contact_idx
  on public.facility_affiliations (contact_id);

-- 施設共有メモの変更履歴
create table public.facility_memo_histories (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  previous_memo text not null default '',
  new_memo text not null default '',
  changed_by_label text not null default '未ログイン',
  created_at timestamptz not null default now()
);

create index facility_memo_histories_facility_idx
  on public.facility_memo_histories (facility_id, created_at desc);

-- Phase1同様、STEP7まで暫定で anon に開放
alter table public.contacts enable row level security;
alter table public.facility_affiliations enable row level security;
alter table public.facility_memo_histories enable row level security;

create policy "phase2_contacts_select_all"
  on public.contacts for select to anon, authenticated using (true);
create policy "phase2_contacts_insert_all"
  on public.contacts for insert to anon, authenticated with check (true);
create policy "phase2_contacts_update_all"
  on public.contacts for update to anon, authenticated using (true) with check (true);

create policy "phase2_facility_affiliations_select_all"
  on public.facility_affiliations for select to anon, authenticated using (true);
create policy "phase2_facility_affiliations_insert_all"
  on public.facility_affiliations for insert to anon, authenticated with check (true);
create policy "phase2_facility_affiliations_update_all"
  on public.facility_affiliations for update to anon, authenticated using (true) with check (true);

create policy "phase2_facility_memo_histories_select_all"
  on public.facility_memo_histories for select to anon, authenticated using (true);
create policy "phase2_facility_memo_histories_insert_all"
  on public.facility_memo_histories for insert to anon, authenticated with check (true);

grant select, insert, update on table public.contacts to anon, authenticated;
grant select, insert, update on table public.facility_affiliations to anon, authenticated;
grant select, insert on table public.facility_memo_histories to anon, authenticated;
