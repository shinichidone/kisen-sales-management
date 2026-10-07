-- 営業結果を複数選択できるようにする。
-- 既存の result は互換性のため残し、全履歴を results 配列へ移行する。

alter table public.sales_visits
  add column if not exists results public.sales_visit_result[] not null default '{}';

update public.sales_visits
set results = array[result]::public.sales_visit_result[]
where cardinality(results) = 0;

comment on column public.sales_visits.results is
  '営業結果の複数選択。旧result列は既存機能との互換性のため代表値を保持する。';
