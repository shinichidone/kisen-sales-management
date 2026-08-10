/**
 * Google Place の address_components または住所文字列から市区町村を抽出する。
 * 将来の MAP / 分析フィルター（河内長野市・富田林市 等）用。
 */
export function cityFromAddressComponents(
  components: google.maps.GeocoderAddressComponent[] | undefined,
): string {
  if (!components?.length) return ''

  const byType = (type: string) =>
    components.find((c) => c.types.includes(type))?.long_name ?? ''

  // 政令指定都市の区 → 市＋区、それ以外は locality / admin_level_2
  const locality = byType('locality')
  const ward = byType('sublocality_level_1') || byType('administrative_area_level_3')
  const county = byType('administrative_area_level_2')

  if (locality && ward && /区$/.test(ward)) {
    return `${locality}${ward}`
  }
  if (locality) return locality
  if (county) return county
  return ''
}

/** 住所テキストから粗い市区町村推定（手動登録フォールバック） */
export function cityFromAddressText(address: string): string {
  const text = address.trim()
  if (!text) return ''

  const patterns = [
    /([^都道府県]+[都道府県])([^市区町村]+市)/,
    /([^都道府県]+[都道府県])([^市区町村]+区)/,
    /([^都道府県]+[都道府県])([^市区町村]+町)/,
    /([^都道府県]+[都道府県])([^市区町村]+村)/,
    /([^市]+市)/,
    /([^区]+区)/,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match) continue
    if (match[2]) return match[2]
    if (match[1] && /[市区町村]$/.test(match[1])) return match[1]
  }
  return ''
}
