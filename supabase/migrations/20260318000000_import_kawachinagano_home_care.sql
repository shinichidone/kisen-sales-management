-- 河内長野市 居宅介護支援事業所の一括登録（冪等）
-- 表示用住所は提供テキストのまま。Google の表記では上書きしない。
-- 営業対象サービスは未選択のまま（facility_target_services は触らない）。
-- SQL Editor でこのファイル全体を1回実行する。2回目は既存判定でスキップされる。

with incoming (name, address, phone, google_place_id, lat, lng) as (
  values
    ('ケア南海株式会社居宅介護支援事業所', '河内長野市市町765番1', '0721-52-0503', 'ChIJe3M-CdnVAGARo3plXEGYc4c', 34.4656137, 135.5749696),
    ('パウハウスケアプランセンター', '河内長野市市町1353番地の11', '0721-56-7437', 'ChIJA3nioXfWAGARTB19Cz9RjI0', 34.4699172, 135.5735412),
    ('翠浩苑居宅介護支援事業所', '河内長野市松ケ丘中町1454番地の1', '0721-53-5565', 'ChIJeaj9bYvWAGAR6iZokq_ocKk', 34.4775337, 135.5591218),
    ('滝谷病院ケアプランセンター', '河内長野市松ケ丘中町1453番地', '0721-53-5002', 'ChIJZc3EaIvWAGARYkoIaUZ_9fE', 34.4777852, 135.5588854),
    ('河内長野市医師会ケアプランセンター', '河内長野市菊水町2番13号', '0721-50-0500', 'ChIJyz3jv8fVAGARSqrGt2HjHJs', 34.451138, 135.5736393),
    ('医療法人健真会福寿ケアプランセンター', '河内長野市西代町2番12号', '0721-26-7711', 'ChIJKWEYtM7VAGARf8fQXrlPzLU', 34.452499, 135.568475),
    ('医療法人生登会 てらもとケアプランセンター', '河内長野市古野町4番11号', '0721-50-1123', 'ChIJky8NFADVAGARjOWcF5mVR0A', 34.4558637, 135.569543),
    ('ケアサポートアベンダー', '河内長野市千代田南町9番23号', '0721-51-7034', 'ChIJT1GlItbVAGAR_mgEoUj4dac', 34.4652819, 135.5689045),
    ('介護支援センターみかん', '河内長野市原町一丁目20番21号', '0721-50-0117', 'ChIJtexWb9HVAGARIOWsdEHiJHM', 34.4596316, 135.5682788),
    ('タンポポケアプランセンター', '河内長野市加賀田263番地1', '0721-55-3558', 'ChIJrY0cBfbVAGARm0I9znnxw8o', 34.429288, 135.5698557),
    ('ケアセンターレモン', '河内長野市西之山町16番3号', '0721-56-1007', 'ChIJ9858AC3UAGARWiAP7K4O8m4', 34.4552067, 135.5606161),
    ('やすらぎの村 ケアプランセンター河内長野', '河内長野市西之山町7-2', '0721-53-0586', 'ChIJsfs9FC3UAGARdeoSUs1UGp8', 34.454876, 135.561543),
    ('リンクケアプランセンター河内長野', '河内長野市西之山町10番28号サンライズビル303号', '0721-53-7070', 'ChIJuZwrGaTVAGAR34E27enHnU0', 34.4571972, 135.5638952),
    ('寿里苑居宅介護支援事業所', '河内長野市昭栄町3番56号', '0721-50-3510', 'ChIJt9GtfjLUAGARAJqja4bl9XI', 34.4532585, 135.5605309),
    ('青春ケアプランセンター', '河内長野市千代田台町2番11号', '0721-26-8656', 'ChIJTWYhnyrUAGARBCzSCuS7Pds', 34.4622582, 135.56161),
    ('あすなろケアプランセンター', '河内長野市錦町15番47号', '0721-53-8188', 'ChIJF_BVzczVAGARCT2fUJ-N1yI', 34.4513883, 135.5629571),
    ('社会福祉法人河内長野市社会福祉協議会居宅介護支援事業所', '河内長野市喜多町663番1', '0721-64-9000', 'ChIJEdvPxLnVAGARQ6AkRKzPVt0', 34.4469017, 135.5730476),
    ('社会福祉法人恩徳福祉会 青山第二病院ケアプランセンター', '河内長野市喜多町192番地の1', '0721-60-5565', 'ChIJC1PKjrbVAGARdiwFOE-gerA', 34.445158, 135.568576),
    ('ケアプランセンターふれあいの丘', '河内長野市上田町155番地5', '0721-65-1818', 'ChIJm8CaeFrVAGAR62epJEp1j2M', 34.4408616, 135.5682123),
    ('つるかめ居宅介護支援センター', '河内長野市小塩町578番地', '0721-69-4171', 'ChIJPRq4Da3VAGARD1vcKil7g2Y', 34.4358619, 135.5648179),
    ('青空居宅介護支援センター', '河内長野市上原町495番1の2', '0721-56-5683', 'ChIJ4yBBVjbUAGAR_M27eqN-Xzk', 34.4443352, 135.5562439),
    ('いっぽケアプランセンター', '河内長野市楠ケ丘28番20号', '0721-55-2189', 'ChIJdwTMzU3UAGARvOFQKFpz9hU', 34.4365215, 135.5589461),
    ('花音ケアプランセンター', '河内長野市日東町7番20号', '0721-81-8550', 'ChIJPdIzVZ_VAGARxzIvKb2cFcc', 34.4405309, 135.5819267),
    ('古川ケアプランセンター', '河内長野市中片添町25番10号', '0721-69-5166', 'ChIJiaddNQjVAGARC8mkAFo9-kI', 34.4316749, 135.5746624),
    ('エスコープ大阪サポートセンター河内長野', '河内長野市西片添町12番9号', '0721-60-2230', 'ChIJ0aCQtqnVAGARhtZmxx_qj1U', 34.4318087, 135.5697015),
    ('きらら', '河内長野市大矢船南町30番8号', '0721-63-5261', 'ChIJaVDbS-PUAGARFoO_ziiYa-A', 34.416514, 135.5592036),
    ('ありがとうケアプランセンター', '河内長野市大矢船中町21番9号', '0721-21-6220', 'ChIJ8RjH-vzUAGARSCeStT3KUvM', 34.4188837, 135.560068),
    ('上野ケアプランセンター', '河内長野市南花台一丁目16番6号', '0721-63-6277', 'ChIJNWv1LrXVAGAR_rZnPKzblvs', 34.4311667, 135.5583957),
    ('ケアステーションニシバタ', '河内長野市緑ケ丘北町2番4号', '0721-56-3580', 'ChIJewUM6xjUAGARS3ofnMI8TQg', 34.4480612, 135.542753),
    ('ケアプランセンターベル', '河内長野市あかしあ台一丁目8番16号西井あかしあ台ビル2階', '0721-53-9550', 'ChIJm3J6qo_WAGARbjJlaWqdCiw', 34.4708016, 135.5558271),
    ('居宅介護支援事業所 そら', '河内長野市市町501番地4', '0721-55-3261', 'ChIJZVq6Os_VAGAR3U2nIghKKwY', 34.4720846, 135.5771936),
    ('凪ケアプランセンター', '河内長野市大矢船北町2番3号', '0721-21-8372', 'ChIJOzoXs__UAGARJ3BaeV8inms', 34.4245119, 135.5613298),
    ('ベルツリーケアプランセンター', '河内長野市美加の台三丁目14番11号', '0721-51-4024', 'ChIJZbv6sWjVAGAR6cSOAP60EjA', 34.4263563, 135.5906285),
    ('うえるらいふケアプランセンター', '河内長野市木戸三丁目11番5号サンコート千代田205号室', '0721-70-7695', 'El9KYXBhbiwg44CSNTg2LTAwMDEgT3Nha2EsIEthd2FjaGluYWdhbm8sIEtpZG8sIDMtY2jFjW1l4oiSMTHiiJLvvJUg44K144Oz44Kz44O844OI5Y2D5Luj55SwIDIwNSIfGh0KFgoUChIJD2vZSXvWAGARJI9HTWmh9M0SAzIwNQ', 34.4743987, 135.5688302),
    ('ケアプランセンターりはのあ', '河内長野市向野町149番地16', '0721-55-2502', 'ChIJ33RouGbVAGARxkYYCsqrLI4', 34.4558902, 135.5763092)
),
inserted as (
  insert into public.facilities (
    google_place_id,
    name,
    facility_type,
    address,
    city,
    phone,
    lat,
    lng,
    shared_memo
  )
  select
    i.google_place_id,
    i.name,
    'home_care_support'::public.facility_type,
    i.address,
    '河内長野市',
    i.phone,
    i.lat,
    i.lng,
    ''
  from incoming i
  where not exists (
    select 1
    from public.facilities f
    where 
    (i.google_place_id is not null and f.google_place_id = i.google_place_id)
    or (
      coalesce(regexp_replace(f.phone, '\D', '', 'g'), '') <> ''
      and regexp_replace(f.phone, '\D', '', 'g') = regexp_replace(i.phone, '\D', '', 'g')
    )
    or (
      regexp_replace(
        replace(replace(replace(replace(replace(f.name, '社会福祉法人', ''), '医療法人', ''), '株式会社', ''), '（株）', ''), ' ', ''),
        '　',
        '',
        'g'
      )
      =
      regexp_replace(
        replace(replace(replace(replace(replace(i.name, '社会福祉法人', ''), '医療法人', ''), '株式会社', ''), '（株）', ''), ' ', ''),
        '　',
        '',
        'g'
      )
      and regexp_replace(
        regexp_replace(replace(replace(f.address, ' ', ''), '　', ''), '(番地の|番地|丁目|番|号室|号)', '-', 'g'),
        '-+',
        '-',
        'g'
      )
      =
      regexp_replace(
        regexp_replace(replace(replace(i.address, ' ', ''), '　', ''), '(番地の|番地|丁目|番|号室|号)', '-', 'g'),
        '-+',
        '-',
        'g'
      )
    )
    or (f.city = '河内長野市' and f.name like '%ケア南海%' and i.name like '%ケア南海%')
    or (f.city = '河内長野市' and f.name like '%やすらぎの村%' and i.name like '%やすらぎの村%')
    or (f.city = '河内長野市' and f.name like '%ベルツリー%' and i.name like '%ベルツリー%')

  )
  returning id, name, phone
)
select
  i.name,
  i.address,
  i.phone,
  case
    when ins.id is not null then 'inserted'
    else 'skipped_existing'
  end as result,
  coalesce(ins.id, f.id) as facility_id
from incoming i
left join inserted ins on ins.name = i.name and ins.phone = i.phone
left join public.facilities f
  on ins.id is null and (
    (i.google_place_id is not null and f.google_place_id = i.google_place_id)
    or (
      coalesce(regexp_replace(f.phone, '\D', '', 'g'), '') <> ''
      and regexp_replace(f.phone, '\D', '', 'g') = regexp_replace(i.phone, '\D', '', 'g')
    )
    or (
      regexp_replace(
        replace(replace(replace(replace(replace(f.name, '社会福祉法人', ''), '医療法人', ''), '株式会社', ''), '（株）', ''), ' ', ''),
        '　',
        '',
        'g'
      )
      =
      regexp_replace(
        replace(replace(replace(replace(replace(i.name, '社会福祉法人', ''), '医療法人', ''), '株式会社', ''), '（株）', ''), ' ', ''),
        '　',
        '',
        'g'
      )
      and regexp_replace(
        regexp_replace(replace(replace(f.address, ' ', ''), '　', ''), '(番地の|番地|丁目|番|号室|号)', '-', 'g'),
        '-+',
        '-',
        'g'
      )
      =
      regexp_replace(
        regexp_replace(replace(replace(i.address, ' ', ''), '　', ''), '(番地の|番地|丁目|番|号室|号)', '-', 'g'),
        '-+',
        '-',
        'g'
      )
    )
    or (f.city = '河内長野市' and f.name like '%ケア南海%' and i.name like '%ケア南海%')
    or (f.city = '河内長野市' and f.name like '%やすらぎの村%' and i.name like '%やすらぎの村%')
    or (f.city = '河内長野市' and f.name like '%ベルツリー%' and i.name like '%ベルツリー%')
);
