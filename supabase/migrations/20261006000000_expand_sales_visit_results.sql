-- 営業結果の「資料渡しのみ」を、実際に渡した資料・依頼内容へ細分化する。
-- 既存の materials_only は過去データ保護のため enum 内に残すが、画面の新規選択肢からは外す。

alter type public.sales_visit_result add value if not exists 'report_delivered';
alter type public.sales_visit_result add value if not exists 'flyer_delivered';
alter type public.sales_visit_result add value if not exists 'brochure_delivered';
alter type public.sales_visit_result add value if not exists 'service_sheet_delivered';
alter type public.sales_visit_result add value if not exists 'instruction_request';
