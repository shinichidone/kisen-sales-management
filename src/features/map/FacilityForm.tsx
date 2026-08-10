import { useEffect, useMemo, useState } from 'react'
import {
  FACILITY_TYPES,
  type FacilityDraft,
  type FacilityType,
  type PlaceCandidate,
  type Service,
} from '../../types/facility'
import { cityFromAddressText } from '../../lib/city'
import styles from './MapPage.module.css'

type Props = {
  mode: 'place' | 'manual'
  services: Service[]
  initialPlace: PlaceCandidate | null
  pickedLatLng: { lat: number; lng: number } | null
  mapPickMode: boolean
  onToggleMapPick: () => void
  onSubmit: (draft: FacilityDraft) => Promise<void>
  onCancel: () => void
}

export function FacilityForm({
  mode,
  services,
  initialPlace,
  pickedLatLng,
  mapPickMode,
  onToggleMapPick,
  onSubmit,
  onCancel,
}: Props) {
  const [facilityType, setFacilityType] = useState<FacilityType>('home_care_support')
  const [targetServiceIds, setTargetServiceIds] = useState<string[]>([])
  const [sharedMemo, setSharedMemo] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const placeSummary = useMemo(() => initialPlace, [initialPlace])

  useEffect(() => {
    if (!pickedLatLng) return
    setLat(String(pickedLatLng.lat))
    setLng(String(pickedLatLng.lng))
  }, [pickedLatLng])

  function resetLocal() {
    setSharedMemo('')
    setTargetServiceIds([])
    setFacilityType('home_care_support')
    setName('')
    setAddress('')
    setCity('')
    setPhone('')
    setLat('')
    setLng('')
    setError(null)
  }

  function toggleService(id: string) {
    setTargetServiceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    )
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)

    try {
      let draft: FacilityDraft

      if (mode === 'place') {
        if (!placeSummary) {
          throw new Error('先に施設検索で候補を選択してください。')
        }
        draft = {
          google_place_id: placeSummary.google_place_id,
          name: placeSummary.name,
          facility_type: facilityType,
          address: placeSummary.address,
          city: placeSummary.city || cityFromAddressText(placeSummary.address) || '未設定',
          phone: placeSummary.phone,
          lat: placeSummary.lat,
          lng: placeSummary.lng,
          shared_memo: sharedMemo,
          target_service_ids: targetServiceIds,
        }
      } else {
        const latNum = Number(lat)
        const lngNum = Number(lng)
        if (!name.trim() || !address.trim()) {
          throw new Error('施設名と住所は必須です。')
        }
        if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
          throw new Error('緯度・経度を入力するか、地図上で位置を指定してください。')
        }
        draft = {
          google_place_id: null,
          name,
          facility_type: facilityType,
          address,
          city: city.trim() || cityFromAddressText(address) || '未設定',
          phone,
          lat: latNum,
          lng: lngNum,
          shared_memo: sharedMemo,
          target_service_ids: targetServiceIds,
        }
      }

      await onSubmit(draft)
      resetLocal()
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました。')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {mode === 'place' ? (
        placeSummary ? (
          <div className={styles.card}>
            <h2>{placeSummary.name}</h2>
            <p className={styles.muted}>{placeSummary.address}</p>
            <p className={styles.hint}>
              Place ID: {placeSummary.google_place_id}
              <br />
              {placeSummary.lat.toFixed(5)}, {placeSummary.lng.toFixed(5)}
            </p>
          </div>
        ) : (
          <div className={styles.alertWarn}>検索候補を選択するとここに表示されます。</div>
        )
      ) : (
        <>
          <label className={styles.label}>
            施設名
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className={styles.label}>
            住所
            <input
              className={styles.input}
              value={address}
              onChange={(e) => {
                const next = e.target.value
                setAddress(next)
                if (!city) setCity(cityFromAddressText(next))
              }}
              required
            />
          </label>
          <label className={styles.label}>
            市区町村
            <input
              className={styles.input}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="住所から自動推定（修正可）"
            />
          </label>
          <label className={styles.label}>
            電話番号
            <input
              className={styles.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={onToggleMapPick}>
              {mapPickMode ? '地図クリック待機中…' : '地図上で位置を指定'}
            </button>
          </div>
          <div className={styles.actions}>
            <label className={styles.label} style={{ flex: 1 }}>
              緯度
              <input
                className={styles.input}
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                inputMode="decimal"
              />
            </label>
            <label className={styles.label} style={{ flex: 1 }}>
              経度
              <input
                className={styles.input}
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                inputMode="decimal"
              />
            </label>
          </div>
          <p className={styles.hint}>
            Maps検索で見つからない場合はこちら。地図をクリックして位置をセットできます。
          </p>
        </>
      )}

      <label className={styles.label}>
        施設種別
        <select
          className={styles.select}
          value={facilityType}
          onChange={(e) => setFacilityType(e.target.value as FacilityType)}
        >
          {FACILITY_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className={styles.sectionTitle}>営業対象サービス（複数可）</p>
        <div className={styles.checkGroup}>
          {services.map((service) => (
            <label key={service.id} className={styles.checkItem}>
              <input
                type="checkbox"
                checked={targetServiceIds.includes(service.id)}
                onChange={() => toggleService(service.id)}
              />
              <span>{service.name}</span>
            </label>
          ))}
        </div>
      </div>

      <label className={styles.label}>
        施設共有メモ（任意）
        <textarea
          className={styles.textarea}
          value={sharedMemo}
          onChange={(e) => setSharedMemo(e.target.value)}
          placeholder="訪問しやすい曜日、駐車場など"
        />
      </label>

      {error ? <div className={styles.alert}>{error}</div> : null}

      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={saving}>
          {saving ? '保存中…' : '施設を保存'}
        </button>
        <button
          className={styles.secondary}
          type="button"
          onClick={() => {
            resetLocal()
            onCancel()
          }}
        >
          クリア
        </button>
      </div>
    </form>
  )
}
