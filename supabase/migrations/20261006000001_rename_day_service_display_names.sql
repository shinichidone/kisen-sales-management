-- サービスID・コードは変更せず、画面に表示する名称だけを変更する。
-- 既存の営業履歴・紹介案件との紐付けは維持される。

update public.services
set name = 'デイサービス 昭栄町'
where code = 'shoeicho';

update public.services
set name = 'デイサービス 南花台'
where code = 'minami-hanadai';
