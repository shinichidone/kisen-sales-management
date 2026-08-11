-- Phase1: anon / authenticated にテーブル権限を付与
-- RLS ポリシーだけでは不足で、PostgreSQL の GRANT が必要

grant usage on schema public to anon, authenticated;

grant select on table public.services to anon, authenticated;

grant select, insert, update on table public.facilities to anon, authenticated;

grant select, insert, delete on table public.facility_target_services to anon, authenticated;
