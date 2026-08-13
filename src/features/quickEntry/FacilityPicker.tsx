import { useEffect, useMemo, useState } from 'react'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { getErrorMessage } from '../../lib/errors'
import { fetchFacilities } from '../../lib/facilitiesApi'
import { facilityTypeLabel, type Facility } from '../../types/facility'
import styles from './FacilityPicker.module.css'

type Mode = 'browse' | 'visit' | 'referral'

type Props = {
  mode: Mode
  onSelect: (facilityId: string) => void
  onCancel: () => void
}

const TITLES: Record<Mode, string> = {
  browse: '近くの営業先を探す',
  visit: '営業記録を登録する施設を選択',
  referral: '紹介案件を登録する施設を選択',
}

function distanceKm(a: google.maps.LatLngLiteral, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function FacilityPicker({ mode, onSelect, onCancel }: Props) {
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [currentLocation, setCurrentLocation] = useState<google.maps.LatLngLiteral | null>(null)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    fetchFacilities()
      .then(setFacilities)
      .catch((err) => {
        console.error('施設一覧の取得に失敗しました:', err)
        setError(getErrorMessage(err, '施設一覧の取得に失敗しました。'))
      })
      .finally(() => setLoading(false))
  }, [])

  function handleLocate() {
    if (!navigator.geolocation) {
      setError('この端末では現在地を取得できません。')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => {
        setError('現在地の取得が許可されませんでした。')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = q
      ? facilities.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.city.toLowerCase().includes(q) ||
            f.address.toLowerCase().includes(q),
        )
      : facilities

    if (!currentLocation) return base

    return [...base].sort(
      (a, b) => distanceKm(currentLocation, a) - distanceKm(currentLocation, b),
    )
  }, [facilities, query, currentLocation])

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.panel}>
        <header className={styles.header}>
          <h2>{TITLES[mode]}</h2>
          <button type="button" className={styles.closeBtn} onClick={onCancel}>
            閉じる
          </button>
        </header>

        <div className={styles.body}>
          <div className={styles.searchRow}>
            <input
              className={styles.input}
              placeholder="施設名・市区町村・住所で検索"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="button" className={styles.secondary} onClick={handleLocate} disabled={locating}>
              {locating ? '取得中…' : currentLocation ? '現在地で再取得' : '近い順に並べる'}
            </button>
          </div>

          {error ? <div className={styles.alert}>{error}</div> : null}
          {loading ? <LoadingSpinner /> : null}

          {!loading && filtered.length === 0 ? (
            <p className={styles.empty}>該当する施設が見つかりません。</p>
          ) : null}

          <div className={styles.list}>
            {filtered.map((facility) => (
              <button
                key={facility.id}
                type="button"
                className={styles.listItem}
                onClick={() => onSelect(facility.id)}
              >
                <strong>{facility.name}</strong>
                <span>
                  {facilityTypeLabel(facility.facility_type)} · {facility.city}
                  {currentLocation
                    ? ` · ${distanceKm(currentLocation, facility).toFixed(1)}km`
                    : ''}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
