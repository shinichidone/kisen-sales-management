-- STEP7: RLSを anon 全開放 から 役割ベース(authenticated + app_users.status/role) へ締め直す
--
-- これ以降、anon（未ログイン）ではデータが一切見えなくなる。意図的な破壊的変更。
-- 最初の system_admin は Supabase SQL Editor で手動ブートストラップする
-- （docs/SETUP_HANDS_ON.md の STEP7セクション参照）。

-- ============================================================
-- 1. 既存の anon 全開放ポリシーを削除
-- ============================================================

drop policy if exists "phase1_services_select_all" on public.services;

drop policy if exists "phase1_facilities_select_all" on public.facilities;
drop policy if exists "phase1_facilities_insert_all" on public.facilities;
drop policy if exists "phase1_facilities_update_all" on public.facilities;

drop policy if exists "phase1_facility_target_services_select_all" on public.facility_target_services;
drop policy if exists "phase1_facility_target_services_insert_all" on public.facility_target_services;
drop policy if exists "phase1_facility_target_services_delete_all" on public.facility_target_services;

drop policy if exists "phase2_contacts_select_all" on public.contacts;
drop policy if exists "phase2_contacts_insert_all" on public.contacts;
drop policy if exists "phase2_contacts_update_all" on public.contacts;
drop policy if exists "phase2_contacts_delete_all" on public.contacts;

drop policy if exists "phase2_facility_affiliations_select_all" on public.facility_affiliations;
drop policy if exists "phase2_facility_affiliations_insert_all" on public.facility_affiliations;
drop policy if exists "phase2_facility_affiliations_update_all" on public.facility_affiliations;
drop policy if exists "phase2_facility_affiliations_delete_all" on public.facility_affiliations;

drop policy if exists "phase2_facility_memo_histories_select_all" on public.facility_memo_histories;
drop policy if exists "phase2_facility_memo_histories_insert_all" on public.facility_memo_histories;

drop policy if exists "phase3_sales_visits_select_all" on public.sales_visits;
drop policy if exists "phase3_sales_visits_insert_all" on public.sales_visits;
drop policy if exists "phase3_sales_visits_update_all" on public.sales_visits;

drop policy if exists "phase3_sales_visit_contacts_select_all" on public.sales_visit_contacts;
drop policy if exists "phase3_sales_visit_contacts_insert_all" on public.sales_visit_contacts;
drop policy if exists "phase3_sales_visit_contacts_delete_all" on public.sales_visit_contacts;

drop policy if exists "phase3_sales_visit_services_select_all" on public.sales_visit_services;
drop policy if exists "phase3_sales_visit_services_insert_all" on public.sales_visit_services;
drop policy if exists "phase3_sales_visit_services_delete_all" on public.sales_visit_services;

drop policy if exists "phase5_referral_cases_select_all" on public.referral_cases;
drop policy if exists "phase5_referral_cases_insert_all" on public.referral_cases;
drop policy if exists "phase5_referral_cases_update_all" on public.referral_cases;

-- ============================================================
-- 2. 役割ベースの新しいポリシー
--    共通ルール: is_active_app_user() = false（未ログイン/未承認/無効化）は何もできない
-- ============================================================

-- services（マスタ。閲覧のみ）
create policy "phase7_services_select_active"
  on public.services for select
  to authenticated
  using (public.is_active_app_user());

-- facilities（施設情報は全active ユーザーが編集可）
create policy "phase7_facilities_select_active"
  on public.facilities for select
  to authenticated
  using (public.is_active_app_user());

create policy "phase7_facilities_insert_active"
  on public.facilities for insert
  to authenticated
  with check (public.is_active_app_user());

create policy "phase7_facilities_update_active"
  on public.facilities for update
  to authenticated
  using (public.is_active_app_user())
  with check (public.is_active_app_user());

-- facility_target_services
create policy "phase7_facility_target_services_select_active"
  on public.facility_target_services for select
  to authenticated
  using (public.is_active_app_user());

create policy "phase7_facility_target_services_insert_active"
  on public.facility_target_services for insert
  to authenticated
  with check (public.is_active_app_user());

create policy "phase7_facility_target_services_delete_active"
  on public.facility_target_services for delete
  to authenticated
  using (public.is_active_app_user());

-- contacts（担当者マスタは全active ユーザーが編集可）
create policy "phase7_contacts_select_active"
  on public.contacts for select
  to authenticated
  using (public.is_active_app_user());

create policy "phase7_contacts_insert_active"
  on public.contacts for insert
  to authenticated
  with check (public.is_active_app_user());

create policy "phase7_contacts_update_active"
  on public.contacts for update
  to authenticated
  using (public.is_active_app_user())
  with check (public.is_active_app_user());

create policy "phase7_contacts_delete_active"
  on public.contacts for delete
  to authenticated
  using (public.is_active_app_user());

-- facility_affiliations
create policy "phase7_facility_affiliations_select_active"
  on public.facility_affiliations for select
  to authenticated
  using (public.is_active_app_user());

create policy "phase7_facility_affiliations_insert_active"
  on public.facility_affiliations for insert
  to authenticated
  with check (public.is_active_app_user());

create policy "phase7_facility_affiliations_update_active"
  on public.facility_affiliations for update
  to authenticated
  using (public.is_active_app_user())
  with check (public.is_active_app_user());

create policy "phase7_facility_affiliations_delete_active"
  on public.facility_affiliations for delete
  to authenticated
  using (public.is_active_app_user());

-- facility_memo_histories（共有メモの変更履歴。全active ユーザーが追記可、履歴は不変）
create policy "phase7_facility_memo_histories_select_active"
  on public.facility_memo_histories for select
  to authenticated
  using (public.is_active_app_user());

create policy "phase7_facility_memo_histories_insert_active"
  on public.facility_memo_histories for insert
  to authenticated
  with check (public.is_active_app_user());

-- sales_visits（本人7日以内 / 事業所管理者は自事業所関連分 / システム管理者は全件）
create policy "phase7_sales_visits_select_active"
  on public.sales_visits for select
  to authenticated
  using (public.is_active_app_user());

create policy "phase7_sales_visits_insert_active"
  on public.sales_visits for insert
  to authenticated
  with check (public.is_active_app_user() and created_by = auth.uid());

create policy "phase7_sales_visits_update_scoped"
  on public.sales_visits for update
  to authenticated
  using (
    public.is_active_app_user()
    and (
      public.is_system_admin()
      or (
        public.current_app_role() = 'facility_admin'
        and exists (
          select 1 from public.sales_visit_services svs
          where svs.visit_id = sales_visits.id
            and svs.service_id = any (public.current_app_service_ids())
        )
      )
      or (created_by = auth.uid() and created_at > now() - interval '7 days')
    )
  )
  with check (
    public.is_active_app_user()
    and (
      public.is_system_admin()
      or (
        public.current_app_role() = 'facility_admin'
        and exists (
          select 1 from public.sales_visit_services svs
          where svs.visit_id = sales_visits.id
            and svs.service_id = any (public.current_app_service_ids())
        )
      )
      or (created_by = auth.uid() and created_at > now() - interval '7 days')
    )
  );

create policy "phase7_sales_visits_delete_system_admin"
  on public.sales_visits for delete
  to authenticated
  using (public.is_system_admin());

-- sales_visit_contacts / sales_visit_services
-- （sales_visits側のupdate/insert権限で実質制御されるため、こちらは active であれば操作可）
create policy "phase7_sales_visit_contacts_select_active"
  on public.sales_visit_contacts for select
  to authenticated
  using (public.is_active_app_user());

create policy "phase7_sales_visit_contacts_insert_active"
  on public.sales_visit_contacts for insert
  to authenticated
  with check (public.is_active_app_user());

create policy "phase7_sales_visit_contacts_delete_active"
  on public.sales_visit_contacts for delete
  to authenticated
  using (public.is_active_app_user());

create policy "phase7_sales_visit_services_select_active"
  on public.sales_visit_services for select
  to authenticated
  using (public.is_active_app_user());

create policy "phase7_sales_visit_services_insert_active"
  on public.sales_visit_services for insert
  to authenticated
  with check (public.is_active_app_user());

create policy "phase7_sales_visit_services_delete_active"
  on public.sales_visit_services for delete
  to authenticated
  using (public.is_active_app_user());

-- referral_cases（追加は全active / 編集は事業所管理者(自事業所)・システム管理者のみ）
create policy "phase7_referral_cases_select_active"
  on public.referral_cases for select
  to authenticated
  using (public.is_active_app_user());

create policy "phase7_referral_cases_insert_active"
  on public.referral_cases for insert
  to authenticated
  with check (public.is_active_app_user());

create policy "phase7_referral_cases_update_scoped"
  on public.referral_cases for update
  to authenticated
  using (
    public.is_active_app_user()
    and (
      public.is_system_admin()
      or (
        public.current_app_role() = 'facility_admin'
        and service_id = any (public.current_app_service_ids())
      )
    )
  )
  with check (
    public.is_active_app_user()
    and (
      public.is_system_admin()
      or (
        public.current_app_role() = 'facility_admin'
        and service_id = any (public.current_app_service_ids())
      )
    )
  );

create policy "phase7_referral_cases_delete_system_admin"
  on public.referral_cases for delete
  to authenticated
  using (public.is_system_admin());

-- app_users（自分の行は誰でも見える。全件閲覧・更新はシステム管理者のみ）
create policy "phase7_app_users_select_self_or_admin"
  on public.app_users for select
  to authenticated
  using (id = auth.uid() or public.is_system_admin());

create policy "phase7_app_users_update_admin"
  on public.app_users for update
  to authenticated
  using (public.is_system_admin())
  with check (public.is_system_admin());

-- app_user_services（システム管理者のみが割当を操作。閲覧は本人も可）
create policy "phase7_app_user_services_select_self_or_admin"
  on public.app_user_services for select
  to authenticated
  using (user_id = auth.uid() or public.is_system_admin());

create policy "phase7_app_user_services_insert_admin"
  on public.app_user_services for insert
  to authenticated
  with check (public.is_system_admin());

create policy "phase7_app_user_services_delete_admin"
  on public.app_user_services for delete
  to authenticated
  using (public.is_system_admin());

-- ============================================================
-- 3. GRANT の締め直し（anon からは全テーブルの権限を剥奪）
-- ============================================================

revoke all on table public.services from anon;
revoke all on table public.facilities from anon;
revoke all on table public.facility_target_services from anon;
revoke all on table public.contacts from anon;
revoke all on table public.facility_affiliations from anon;
revoke all on table public.facility_memo_histories from anon;
revoke all on table public.sales_visits from anon;
revoke all on table public.sales_visit_contacts from anon;
revoke all on table public.sales_visit_services from anon;
revoke all on table public.referral_cases from anon;

-- authenticated ロールへの GRANT（RLSでさらに絞られる）
grant select, insert, update, delete on table public.sales_visits to authenticated;
grant select, insert, update, delete on table public.referral_cases to authenticated;

grant select, update on table public.app_users to authenticated;
grant select, insert, delete on table public.app_user_services to authenticated;
