-- STEP3: 営業履歴（訪問記録）

create type public.sales_visit_result as enum (
  'not_met',         -- 未面会
  'materials_only',  -- 資料渡しのみ
  'met'              -- 面会済み
);

-- 営業履歴本体（1回の訪問＝1件）
create table public.sales_visits (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities (id) on delete cascade,
  visited_at timestamptz not null default now(),   -- 訪問日時（後から修正可能）
  result public.sales_visit_result not null,
  memo text not null default '',
  registered_by text not null default '未ログイン', -- 登録者名（ログイン導入前の暫定）
  next_follow_up_on date,                           -- 次回フォロー予定日（任意）
  follow_up_note text not null default '',
  follow_up_assignee text not null default '',
  created_at timestamptz not null default now(),    -- 実際の登録日時（変更不可）
  updated_at timestamptz not null default now()
);

create trigger sales_visits_set_updated_at
  before update on public.sales_visits
  for each row execute function public.set_updated_at();

create index sales_visits_facility_idx
  on public.sales_visits (facility_id, visited_at desc);

create index sales_visits_follow_up_idx
  on public.sales_visits (next_follow_up_on)
  where next_follow_up_on is not null;

-- 面会者（複数選択可）
create table public.sales_visit_contacts (
  visit_id uuid not null references public.sales_visits (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete restrict,
  primary key (visit_id, contact_id)
);

create index sales_visit_contacts_contact_idx
  on public.sales_visit_contacts (contact_id);

-- 今回営業した対象サービス（複数選択可）
create table public.sales_visit_services (
  visit_id uuid not null references public.sales_visits (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  primary key (visit_id, service_id)
);

create index sales_visit_services_service_idx
  on public.sales_visit_services (service_id);

-- Phase1/2同様、STEP7（権限管理）まで暫定で anon に開放
alter table public.sales_visits enable row level security;
alter table public.sales_visit_contacts enable row level security;
alter table public.sales_visit_services enable row level security;

create policy "phase3_sales_visits_select_all"
  on public.sales_visits for select to anon, authenticated using (true);
create policy "phase3_sales_visits_insert_all"
  on public.sales_visits for insert to anon, authenticated with check (true);
create policy "phase3_sales_visits_update_all"
  on public.sales_visits for update to anon, authenticated using (true) with check (true);

create policy "phase3_sales_visit_contacts_select_all"
  on public.sales_visit_contacts for select to anon, authenticated using (true);
create policy "phase3_sales_visit_contacts_insert_all"
  on public.sales_visit_contacts for insert to anon, authenticated with check (true);
create policy "phase3_sales_visit_contacts_delete_all"
  on public.sales_visit_contacts for delete to anon, authenticated using (true);

create policy "phase3_sales_visit_services_select_all"
  on public.sales_visit_services for select to anon, authenticated using (true);
create policy "phase3_sales_visit_services_insert_all"
  on public.sales_visit_services for insert to anon, authenticated with check (true);
create policy "phase3_sales_visit_services_delete_all"
  on public.sales_visit_services for delete to anon, authenticated using (true);

grant select, insert, update on table public.sales_visits to anon, authenticated;
grant select, insert, delete on table public.sales_visit_contacts to anon, authenticated;
grant select, insert, delete on table public.sales_visit_services to anon, authenticated;
