import { cityFromAddressComponents, cityFromAddressText } from './city'

export type GeocodeResult = {
  lat: number
  lng: number
  formattedAddress: string
  city: string
}

function withPrefecture(address: string): string {
  const text = address.trim()
  if (!text) return ''
  if (/[都道府県]/.test(text)) return text
  return `大阪府${text}`
}

/** よくある誤字・省略を、地図検索で当たりやすい表記に直す */
function normalizeAddress(address: string): string {
  return address
    .trim()
    .replace(/美加の代/g, '美加の台')
    .replace(/([0-9０-９]+)丁目/g, '$1丁目')
    .replace(
      /([0-9０-９]+)[-−ー]([0-9０-９]+)[-−ー]([0-9０-９]+)/,
      '$1丁目$2-$3',
    )
}

function candidateQueries(address: string): string[] {
  const raw = address.trim()
  const normalized = normalizeAddress(raw)
  const withPref = withPrefecture(normalized)
  return [...new Set([withPref, normalized, raw].filter(Boolean))]
}

function precisionRank(item: google.maps.GeocoderResult): number {
  switch (item.geometry.location_type) {
    case 'ROOFTOP':
      return 0
    case 'RANGE_INTERPOLATED':
      return 1
    case 'GEOMETRIC_CENTER':
      return 2
    default:
      return 3
  }
}

function pickBestResult(
  results: google.maps.GeocoderResult[],
  query: string,
): google.maps.GeocoderResult | undefined {
  const streetHint = normalizeAddress(query).replace(/大阪府|〒\d{3}-?\d{4}/g, '')
  const scored = results.map((item) => {
    const formatted = item.formatted_address ?? ''
    const matchesStreet =
      /丁目/.test(formatted) ||
      (streetHint.length >= 6 && formatted.includes(streetHint.slice(0, 8)))
    return {
      item,
      score: precisionRank(item) - (matchesStreet ? 2 : 0) - (formatted.includes('美加の台') ? 2 : 0),
    }
  })
  scored.sort((a, b) => a.score - b.score)
  return scored[0]?.item
}

async function geocodeQuery(query: string): Promise<google.maps.GeocoderResult | null> {
  const geocoder = new google.maps.Geocoder()
  try {
    const response = await geocoder.geocode({
      address: query,
      region: 'JP',
      language: 'ja',
      componentRestrictions: { country: 'JP' },
    })
    return pickBestResult(response.results, query) ?? null
  } catch {
    return null
  }
}

function toResult(
  location: google.maps.LatLng,
  formattedAddress: string,
  components: google.maps.GeocoderAddressComponent[] | undefined,
  original: string,
): GeocodeResult {
  return {
    lat: location.lat(),
    lng: location.lng(),
    formattedAddress,
    city:
      cityFromAddressComponents(components) ||
      cityFromAddressText(formattedAddress) ||
      cityFromAddressText(original),
  }
}

/** 住所文字列を緯度経度に変換する（番地までの位置を優先） */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const original = address.trim()
  if (!original || !window.google?.maps?.Geocoder) return null

  for (const query of candidateQueries(original)) {
    const best = await geocodeQuery(query)
    const location = best?.geometry?.location
    if (!location) continue
    if (best.geometry.location_type === 'APPROXIMATE' && /[0-9０-９]/.test(query)) {
      continue
    }
    return toResult(location, best.formatted_address ?? query, best.address_components, original)
  }

  const fallback = await geocodeQuery(withPrefecture(normalizeAddress(original)))
  const location = fallback?.geometry?.location
  if (!location) return null
  return toResult(
    location,
    fallback.formatted_address ?? original,
    fallback.address_components,
    original,
  )
}
