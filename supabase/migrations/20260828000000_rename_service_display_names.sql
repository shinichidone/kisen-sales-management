-- 画面表示用のサービス名を匿名化する

update public.services
set name = 'デイサービスA'
where code = 'shoeicho'
   or name in ('デイサービス喜仙 昭栄町', 'デイサービス喜仙　昭栄町');

update public.services
set name = 'デイサービスB'
where code = 'minami-hanadai'
   or name in ('デイサービス喜仙 南花台', 'デイサービス喜仙　南花台');

update public.services
set name = '訪問看護ステーション'
where code = 'houmon-kango'
   or name = '訪問看護ステーション喜仙';
