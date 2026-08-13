-- STEP2追加: 担当者・所属の削除（登録ミス訂正用）を許可
-- 異動（endAffiliation）とは別に、完全削除の導線を用意する

create policy "phase2_contacts_delete_all"
  on public.contacts for delete
  to anon, authenticated
  using (true);

create policy "phase2_facility_affiliations_delete_all"
  on public.facility_affiliations for delete
  to anon, authenticated
  using (true);

grant delete on table public.contacts to anon, authenticated;
grant delete on table public.facility_affiliations to anon, authenticated;
