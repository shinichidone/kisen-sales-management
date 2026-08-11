import { useEffect, useRef, useState } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { cityFromAddressComponents } from '../../lib/city'
import type { PlaceCandidate } from '../../types/facility'
import styles from './MapPage.module.css'

/** 地図表示範囲（検索候補の優先エリア） */
export type MapBiasBounds = {
  south: number
  west: number
  north: number
  east: number
}

type Props = {
  onSelect: (place: PlaceCandidate) => void
  /** 現在の地図表示範囲。ある場合はその範囲を優先して候補を出す */
  biasBounds?: MapBiasBounds | null
  /** 地図中心（bounds未取得時のフォールバック） */
  biasCenter?: google.maps.LatLngLiteral | null
}

function toLatLngBounds(bounds: MapBiasBounds): google.maps.LatLngBounds {
  return new google.maps.LatLngBounds(
    { lat: bounds.south, lng: bounds.west },
    { lat: bounds.north, lng: bounds.east },
  )
}

/** 中心からおよそ半径kmの矩形を作る（bounds未取得時用） */
function boundsFromCenter(
  center: google.maps.LatLngLiteral,
  radiusKm = 12,
): MapBiasBounds {
  const latDelta = radiusKm / 111
  const lngDelta = radiusKm / (111 * Math.cos((center.lat * Math.PI) / 180))
  return {
    south: center.lat - latDelta,
    north: center.lat + latDelta,
    west: center.lng - lngDelta,
    east: center.lng + lngDelta,
  }
}

export function PlaceSearchField({ onSelect, biasBounds, biasCenter }: Props) {
  const placesLib = useMapsLibrary('places')
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const onSelectRef = useRef(onSelect)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    onSelectRef.current = onSelect
  }, [onSelect])

  // Autocomplete 初期化（1回）
  useEffect(() => {
    if (!placesLib || !inputRef.current || autocompleteRef.current) return

    const initialBounds =
      biasBounds ??
      (biasCenter ? boundsFromCenter(biasCenter) : null)

    const autocomplete = new placesLib.Autocomplete(inputRef.current, {
      fields: [
        'place_id',
        'name',
        'formatted_address',
        'geometry',
        'formatted_phone_number',
        'international_phone_number',
        'address_components',
      ],
      componentRestrictions: { country: 'jp' },
      ...(initialBounds
        ? {
            bounds: toLatLngBounds(initialBounds),
            strictBounds: false,
          }
        : {}),
    })

    autocompleteRef.current = autocomplete
    setReady(true)

    const listener = autocomplete.addListener('place_changed', () => {
      setError(null)
      const place = autocomplete.getPlace()
      const location = place.geometry?.location

      if (!place.place_id || !location || !place.name) {
        setError(
          '施設情報を取得できませんでした。別の候補を選ぶか、手動登録を使ってください。',
        )
        return
      }

      const address = place.formatted_address ?? ''
      const city = cityFromAddressComponents(place.address_components) || '未設定'
      const phone =
        place.formatted_phone_number ?? place.international_phone_number ?? ''

      onSelectRef.current({
        google_place_id: place.place_id,
        name: place.name,
        address,
        city,
        phone,
        lat: location.lat(),
        lng: location.lng(),
      })
    })

    return () => {
      listener.remove()
      google.maps.event.clearInstanceListeners(autocomplete)
      autocompleteRef.current = null
    }
    // 初期化は placesLib 準備時のみ。bounds 更新は次の effect で行う
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesLib])

  // 地図移動に合わせて検索優先エリアを更新
  useEffect(() => {
    const autocomplete = autocompleteRef.current
    if (!autocomplete || !window.google?.maps) return

    const next =
      biasBounds ??
      (biasCenter ? boundsFromCenter(biasCenter) : null)
    if (!next) return

    const latLngBounds = toLatLngBounds(next)
    autocomplete.setBounds(latLngBounds)
    autocomplete.setOptions({
      bounds: latLngBounds,
      strictBounds: false,
      componentRestrictions: { country: 'jp' },
    })
  }, [biasBounds, biasCenter])

  return (
    <div className={styles.form}>
      <label className={styles.label}>
        施設名検索（Google Maps）
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          placeholder={ready ? '例: ○○居宅介護支援事業所' : 'Maps読込中…'}
          disabled={!ready}
          autoComplete="off"
        />
      </label>
      <p className={styles.hint}>
        いま表示中の地図エリアを優先して候補を出します。候補をクリックして選択してください（Enterだけでは不可）。
      </p>
      {error ? <div className={styles.alert}>{error}</div> : null}
    </div>
  )
}
