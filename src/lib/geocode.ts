import { cityFromAddressComponents, cityFromAddressText } from './city'

export type GeocodeResult = {
  lat: number
  lng: number
  formattedAddress: string
  city: string
}

/** 住所文字列を緯度経度に変換する（手動登録用） */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const query = address.trim()
  if (!query || !window.google?.maps?.Geocoder) return null

  const geocoder = new google.maps.Geocoder()
  const response = await geocoder.geocode({
    address: query,
    region: 'JP',
    language: 'ja',
  })
  const first = response.results[0]
  const location = first?.geometry?.location
  if (!location) return null

  return {
    lat: location.lat(),
    lng: location.lng(),
    formattedAddress: first.formatted_address ?? query,
    city:
      cityFromAddressComponents(first.address_components) ||
      cityFromAddressText(first.formatted_address ?? query) ||
      cityFromAddressText(query),
  }
}
