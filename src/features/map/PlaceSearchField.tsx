import { useEffect, useRef, useState } from 'react'
import { useMapsLibrary } from '@vis.gl/react-google-maps'
import { cityFromAddressComponents } from '../../lib/city'
import type { PlaceCandidate } from '../../types/facility'
import styles from './MapPage.module.css'

type Props = {
  onSelect: (place: PlaceCandidate) => void
}

export function PlaceSearchField({ onSelect }: Props) {
  const placesLib = useMapsLibrary('places')
  const inputRef = useRef<HTMLInputElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!placesLib || !inputRef.current) return

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
    })

    setReady(true)

    const listener = autocomplete.addListener('place_changed', () => {
      setError(null)
      const place = autocomplete.getPlace()
      const location = place.geometry?.location

      if (!place.place_id || !location || !place.name) {
        setError('施設情報を取得できませんでした。別の候補を選ぶか、手動登録を使ってください。')
        return
      }

      const address = place.formatted_address ?? ''
      const city = cityFromAddressComponents(place.address_components) || '未設定'
      const phone =
        place.formatted_phone_number ?? place.international_phone_number ?? ''

      onSelect({
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
      // Google Autocomplete が付与するコンテナを残さない
      google.maps.event.clearInstanceListeners(autocomplete)
    }
  }, [placesLib, onSelect])

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
        文字を入力したあと、必ず下に出る候補をクリックして選択してください。Enterだけではピンは出ません。
      </p>
      {error ? <div className={styles.alert}>{error}</div> : null}
    </div>
  )
}
