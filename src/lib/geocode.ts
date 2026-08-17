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

function pickBestResult(
  results: google.maps.GeocoderResult[],
): google.maps.GeocoderResult | undefined {
  const rank = (item: google.maps.GeocoderResult) => {
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
  return [...results].sort((a, b) => rank(a) - rank(b))[0]
}

/** 住所文字列を緯度経度に変換する（番地までの位置を優先） */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const query = withPrefecture(address)
  if (!query || !window.google?.maps?.Geocoder) return null

  const geocoder = new google.maps.Geocoder()
  const response = await geocoder.geocode({
    address: query,
    region: 'JP',
    language: 'ja',
    componentRestrictions: { country: 'JP' },
  })
  const best = pickBestResult(response.results)
  const location = best?.geometry?.location
  if (!location) return null

  return {
    lat: location.lat(),
    lng: location.lng(),
    formattedAddress: best.formatted_address ?? query,
    city:
      cityFromAddressComponents(best.address_components) ||
      cityFromAddressText(best.formatted_address ?? query) ||
      cityFromAddressText(address),
  }
}
