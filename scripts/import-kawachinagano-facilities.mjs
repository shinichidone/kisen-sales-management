/**
 * 河内長野市 居宅介護支援事業所の一括登録補助。
 *
 * Google Maps API キーは HTTP リファラ制限があるため、
 * 位置情報の取得は Maps JavaScript API（localhost）で行う。
 *
 * 使い方:
 *   node --env-file=.env scripts/import-kawachinagano-facilities.mjs --write-geocode-page
 *   → http://localhost:5173/kawachinagano-geocode.html を開く
 *   → 結果 JSON を scripts/output/geocode-results.json に保存
 *   node --env-file=.env scripts/import-kawachinagano-facilities.mjs --build-sql
 *
 * 生成 SQL は冪等。2回実行しても二重登録しない。
 * 営業対象サービス（facility_target_services）は触れない。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DATA_PATH = path.join(__dirname, 'data/kawachinagano-home-care-support.json')
const OUTPUT_DIR = path.join(__dirname, 'output')
const RESULTS_PATH = path.join(OUTPUT_DIR, 'geocode-results.json')
const SQL_PATH = path.join(
  ROOT,
  'supabase/migrations/20260318000000_import_kawachinagano_home_care.sql',
)
const PUBLIC_PAGE = path.join(ROOT, 'public/kawachinagano-geocode.html')

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL'
  return `'${String(value).replaceAll("'", "''")}'`
}

function sqlNumber(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`数値が必要です: ${value}`)
  }
  return String(value)
}

async function writeGeocodePage() {
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    throw new Error('VITE_GOOGLE_MAPS_API_KEY が .env にありません')
  }
  const facilities = JSON.parse(await readFile(DATA_PATH, 'utf8'))
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>河内長野市 居宅介護支援 位置確認（一時ページ）</title>
  <style>
    body { font-family: sans-serif; margin: 16px; }
    pre { white-space: pre-wrap; background: #f6f8fa; padding: 12px; }
    .ok { color: #047857; }
    .hold { color: #b45309; }
  </style>
</head>
<body>
  <p id="status">Google Maps を読み込み中…</p>
  <pre id="result"></pre>
  <script>
    window.__IMPORT_SOURCE__ = ${JSON.stringify(facilities)};
  </script>
  <script>
    const LEGAL_PREFIXES = ['社会福祉法人','医療法人社団','医療法人','一般社団法人','特定非営利活動法人','NPO法人','株式会社','有限会社','合同会社','（株）','(株)','（有）','(有)'];
    const NAME_SUFFIXES = ['居宅介護支援事業所','居宅介護支援センター','ケアプランセンター','介護支援センター'];
    const KANJI_NUM = {一:'1',二:'2',三:'3',四:'4',五:'5',六:'6',七:'7',八:'8',九:'9',十:'10'};
    const CITY_CENTER = { lat: 34.4583, lng: 135.5661 };

    function digitsOnly(v) { return String(v ?? '').replace(/\\D/g, ''); }
    function normalizeName(value) {
      let text = String(value ?? '').normalize('NFKC').trim();
      for (const prefix of LEGAL_PREFIXES) text = text.split(prefix).join('');
      return text.replace(/[ 　]/g, '');
    }
    function nameCore(value) {
      let text = normalizeName(value);
      for (const suffix of NAME_SUFFIXES) text = text.split(suffix).join('');
      return text;
    }
    function normalizeAddress(value) {
      let text = String(value ?? '').normalize('NFKC').trim();
      text = text.replace(/日本|, Japan/g, '').replace(/〒\\d{3}-?\\d{4}/g, '').replace(/大阪府/g, '');
      text = text.replace(/[ 　]/g, '').replace(/[‐－―ー−]/g, '-');
      text = text.replace(/([一二三四五六七八九十])丁目/g, (_, k) => (KANJI_NUM[k] || k) + '丁目');
      text = text.replace(/丁目/g, '-').replace(/番地の/g, '-').replace(/番地/g, '-').replace(/番/g, '-');
      text = text.replace(/号室/g, '').replace(/号/g, '').replace(/の/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      return text;
    }
    function streetKey(value) {
      const n = normalizeAddress(value);
      const m = n.match(/河内長野市(.+)/);
      return m ? m[1] : n;
    }
    function namesLikelySame(a, b) {
      const na = normalizeName(a), nb = normalizeName(b);
      if (!na || !nb) return false;
      if (na === nb) return true;
      const ca = nameCore(a), cb = nameCore(b);
      return !!(ca && cb && ca.length >= 2 && cb.length >= 2 && (ca === cb || ca.includes(cb) || cb.includes(ca)));
    }
    function addressesLikelySame(a, b) {
      const sa = streetKey(a), sb = streetKey(b);
      if (!sa || !sb) return false;
      if (sa === sb) return true;
      const ca = sa.replace(/-/g, ''), cb = sb.replace(/-/g, '');
      if (ca === cb) return true;
      return (ca.length >= 8 && cb.includes(ca.slice(0, 8))) || (cb.length >= 8 && ca.includes(cb.slice(0, 8)));
    }
    function phonesLikelySame(a, b) {
      const da = digitsOnly(a), db = digitsOnly(b);
      return da.length >= 9 && da === db;
    }
    function scoreCandidate(incoming, candidate) {
      let score = 0;
      const reasons = [];
      if (namesLikelySame(incoming.name, candidate.name)) { score += 40; reasons.push('name'); }
      else if (nameCore(incoming.name) && normalizeName(candidate.name).includes(nameCore(incoming.name))) {
        score += 20; reasons.push('name_partial');
      }
      if (addressesLikelySame(incoming.address, candidate.address)) { score += 40; reasons.push('address'); }
      if (phonesLikelySame(incoming.phone, candidate.phone)) { score += 50; reasons.push('phone'); }
      if (String(candidate.address || '').includes('河内長野')) { score += 10; reasons.push('city'); }
      return { score, reasons };
    }
    function distanceKm(a, b) {
      const toRad = (d) => d * Math.PI / 180;
      const dLat = toRad(b.lat - a.lat);
      const dLng = toRad(b.lng - a.lng);
      const s = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng/2)**2;
      return 6371 * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
    }
    function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

    function geocode(address) {
      return new Promise((resolve) => {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({
          address,
          region: 'JP',
          language: 'ja',
          componentRestrictions: { country: 'JP' },
        }, (results, status) => {
          if (status !== 'OK' || !results?.length) return resolve(null);
          const ranked = [...results].sort((x, y) => {
            const rank = (t) => ({ ROOFTOP: 0, RANGE_INTERPOLATED: 1, GEOMETRIC_CENTER: 2 }[t] ?? 3);
            return rank(x.geometry.location_type) - rank(y.geometry.location_type);
          });
          const best = ranked[0];
          resolve({
            lat: best.geometry.location.lat(),
            lng: best.geometry.location.lng(),
            formatted_address: best.formatted_address || '',
            place_id: best.place_id || null,
            location_type: best.geometry.location_type || '',
          });
        });
      });
    }

    function findPlaces(query) {
      return new Promise((resolve) => {
        const svc = new google.maps.places.PlacesService(document.createElement('div'));
        svc.textSearch({ query, language: 'ja', region: 'jp' }, (results, status) => {
          if (status !== 'OK' || !results?.length) return resolve([]);
          resolve(results.slice(0, 5).map((r) => ({
            place_id: r.place_id,
            name: r.name,
            address: r.formatted_address || '',
            lat: r.geometry?.location?.lat() ?? null,
            lng: r.geometry?.location?.lng() ?? null,
          })));
        });
      });
    }

    function getDetails(placeId) {
      return new Promise((resolve) => {
        const svc = new google.maps.places.PlacesService(document.createElement('div'));
        svc.getDetails({
          placeId,
          language: 'ja',
          fields: ['place_id','name','formatted_address','formatted_phone_number','international_phone_number','geometry'],
        }, (place, status) => {
          if (status !== 'OK' || !place) return resolve(null);
          resolve({
            place_id: place.place_id,
            name: place.name,
            address: place.formatted_address || '',
            phone: place.formatted_phone_number || place.international_phone_number || '',
            lat: place.geometry?.location?.lat() ?? null,
            lng: place.geometry?.location?.lng() ?? null,
          });
        });
      });
    }

    async function resolveFacility(item, index, total) {
      document.getElementById('status').textContent = '確認中 ' + (index + 1) + '/' + total + ' ' + item.name;
      const searchAddress = '大阪府' + item.address + ' 日本';
      const queries = [
        item.name + ' ' + searchAddress,
        item.name + ' 河内長野市',
        item.name + ' ' + item.phone,
      ];
      const seen = new Set();
      const candidates = [];
      for (const query of queries) {
        const found = await findPlaces(query);
        await sleep(250);
        for (const row of found) {
          if (!row.place_id || seen.has(row.place_id)) continue;
          seen.add(row.place_id);
          const details = await getDetails(row.place_id);
          await sleep(200);
          candidates.push(details || row);
        }
      }
      const scored = candidates
        .filter((c) => c && c.lat != null && c.lng != null)
        .map((c) => ({ ...c, ...scoreCandidate(item, c) }))
        .sort((a, b) => b.score - a.score);

      const geo = await geocode(searchAddress);
      await sleep(200);

      const best = scored[0] || null;
      const second = scored[1] || null;
      const geoPrecise = geo && geo.location_type !== 'APPROXIMATE';
      const geoNearCity = geo ? distanceKm(geo, CITY_CENTER) < 0.35 && geo.location_type === 'APPROXIMATE' : false;

      if (best && best.score >= 80 && (!second || best.score - second.score >= 20)) {
        return {
          status: 'ok',
          source: item,
          google_place_id: best.place_id,
          lat: best.lat,
          lng: best.lng,
          maps_name: best.name,
          maps_address: best.address,
          maps_phone: best.phone || '',
          match_reasons: best.reasons,
          candidates: scored.slice(0, 3),
        };
      }

      if (best && best.score >= 50 && phonesLikelySame(item.phone, best.phone)) {
        return {
          status: 'ok',
          source: item,
          google_place_id: best.place_id,
          lat: best.lat,
          lng: best.lng,
          maps_name: best.name,
          maps_address: best.address,
          maps_phone: best.phone || '',
          match_reasons: best.reasons,
          candidates: scored.slice(0, 3),
        };
      }

      if (best && best.score >= 50 && addressesLikelySame(item.address, best.address) && namesLikelySame(item.name, best.name)) {
        return {
          status: 'ok',
          source: item,
          google_place_id: best.place_id,
          lat: best.lat,
          lng: best.lng,
          maps_name: best.name,
          maps_address: best.address,
          maps_phone: best.phone || '',
          match_reasons: best.reasons,
          candidates: scored.slice(0, 3),
        };
      }

      if (geo && geoPrecise && !geoNearCity) {
        const conflict = best && best.score >= 40 && distanceKm(geo, best) > 1.5 && !addressesLikelySame(item.address, best.address);
        if (conflict) {
          return {
            status: 'needs_review',
            reason: '住所ジオコードと施設候補の位置が食い違う',
            source: item,
            geocode: geo,
            candidates: scored.slice(0, 3),
          };
        }
        return {
          status: 'ok',
          source: item,
          google_place_id: (best && addressesLikelySame(item.address, best.address) ? best.place_id : geo.place_id),
          lat: geo.lat,
          lng: geo.lng,
          maps_name: best?.name || null,
          maps_address: geo.formatted_address,
          maps_phone: best?.phone || '',
          match_reasons: ['geocode_' + geo.location_type],
          candidates: scored.slice(0, 3),
        };
      }

      return {
        status: 'needs_review',
        reason: !geo ? '位置を特定できなかった' : (geoNearCity ? '市中心の概算位置しか取れなかった' : '候補が施設と明確に一致しない'),
        source: item,
        geocode: geo,
        candidates: scored.slice(0, 3),
      };
    }

    async function run() {
      const items = window.__IMPORT_SOURCE__;
      const results = [];
      for (let i = 0; i < items.length; i++) {
        try {
          results.push(await resolveFacility(items[i], i, items.length));
        } catch (err) {
          results.push({
            status: 'error',
            reason: String(err && err.message ? err.message : err),
            source: items[i],
          });
        }
      }
      const report = {
        generated_at: new Date().toISOString(),
        ok: results.filter((r) => r.status === 'ok').length,
        needs_review: results.filter((r) => r.status === 'needs_review').length,
        error: results.filter((r) => r.status === 'error').length,
        results,
      };
      window.__GEOCODE_REPORT__ = report;
      document.getElementById('status').innerHTML =
        '<span class="ok">完了 成功 ' + report.ok + '</span> / <span class="hold">確認必要 ' + report.needs_review + '</span> / エラー ' + report.error;
      document.getElementById('result').textContent = JSON.stringify(report, null, 2);
    }

    window.initKawachinaganoGeocode = () => {
      document.getElementById('status').textContent = '位置確認を開始します…';
      run();
    };
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=ja&region=JP&callback=initKawachinaganoGeocode" async defer></script>
</body>
</html>
`
  await writeFile(PUBLIC_PAGE, html, 'utf8')
  console.log('Wrote', PUBLIC_PAGE)
  console.log('Open http://localhost:5173/kawachinagano-geocode.html')
}

function buildSql(resultsFile) {
  const okRows = resultsFile.results.filter((row) => row.status === 'ok')
  const values = okRows.map((row) => {
    const src = row.source
    return `    (${sqlLiteral(src.name)}, ${sqlLiteral(src.address)}, ${sqlLiteral(src.phone)}, ${sqlLiteral(row.google_place_id)}, ${sqlNumber(row.lat)}, ${sqlNumber(row.lng)})`
  })

  const dupPredicate = `
    (i.google_place_id is not null and f.google_place_id = i.google_place_id)
    or (
      coalesce(regexp_replace(f.phone, '\\D', '', 'g'), '') <> ''
      and regexp_replace(f.phone, '\\D', '', 'g') = regexp_replace(i.phone, '\\D', '', 'g')
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
`

  return `-- 河内長野市 居宅介護支援事業所の一括登録（冪等）
-- 表示用住所は提供テキストのまま。Google の表記では上書きしない。
-- 営業対象サービスは未選択のまま（facility_target_services は触らない）。
-- SQL Editor でこのファイル全体を1回実行する。2回目は既存判定でスキップされる。

with incoming (name, address, phone, google_place_id, lat, lng) as (
  values
${values.join(',\n')}
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
    where ${dupPredicate}
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
  on ins.id is null and (${dupPredicate});
`
}

async function buildSqlFromResults() {
  const raw = JSON.parse(await readFile(RESULTS_PATH, 'utf8'))
  const sql = buildSql(raw)
  await writeFile(SQL_PATH, sql, 'utf8')
  console.log('Wrote', SQL_PATH)
  console.log('ok:', raw.ok, 'needs_review:', raw.needs_review, 'error:', raw.error)
}

const args = process.argv.slice(2)
if (args.includes('--write-geocode-page')) {
  await writeGeocodePage()
} else if (args.includes('--build-sql')) {
  await mkdir(OUTPUT_DIR, { recursive: true })
  await buildSqlFromResults()
} else {
  console.log('Usage:')
  console.log('  node --env-file=.env scripts/import-kawachinagano-facilities.mjs --write-geocode-page')
  console.log('  node --env-file=.env scripts/import-kawachinagano-facilities.mjs --build-sql')
}
