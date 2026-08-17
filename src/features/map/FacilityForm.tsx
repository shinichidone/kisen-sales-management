import { useEffect, useMemo, useState } from 'react'
import {
  FACILITY_TYPES,
  type FacilityDraft,
  type FacilityType,
  type PlaceCandidate,
} from '../../types/facility'
import { cityFromAddressText } from '../../lib/city'
import styles from './MapPage.module.css'

type Props = {
  mode: 'place' | 'manual'
  initialPlace: PlaceCandidate | null
  pickedLatLng: { lat: number; lng: number } | null
  onAddressGeocode: (address: string) => Promise<{ lat: number; lng: number; city: string } | null>
  onSubmit: (draft: FacilityDraft) => Promise<void>
  onCancel: () => void
}

export function FacilityForm({
  mode,
  initialPlace,
  pickedLatLng,
  onAddressGeocode,
  onSubmit,
  onCancel,
}: Props) {
  const [facilityType, setFacilityType] = useState<FacilityType>('home_care_support')
  const [sharedMemo, setSharedMemo] = useState('')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
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

  useEffect(() => {
    if (mode !== 'manual') return
    const query = address.trim()
    if (query.length < 8) return

    const timer = window.setTimeout(() => {
      void onAddressGeocode(query)
    }, 700)
    return () => window.clearTimeout(timer)
  }, [address, mode, onAddressGeocode])

  function resetLocal() {
    setSharedMemo('')
    setFacilityType('home_care_support')
    setName('')
    setAddress('')
    setPhone('')
    setLat('')
    setLng('')
    setError(null)
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
          target_service_ids: [],
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
          city: cityFromAddressText(address) || '未設定',
          phone,
          lat: latNum,
          lng: lngNum,
          shared_memo: sharedMemo,
          target_service_ids: [],
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
              onChange={(e) => setAddress(e.target.value)}
              required
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
          {pickedLatLng ? (
            <p className={styles.hint}>
              地図にオレンジのピンを表示しています。指でドラッグ、または地図をタップして位置を微調整できます。
              <br />
              {pickedLatLng.lat.toFixed(5)}, {pickedLatLng.lng.toFixed(5)}
            </p>
          ) : (
            <p className={styles.hint}>
              住所を入力すると地図にピンが表示されます。見つからない場合は地図をタップして位置を指定してください。
            </p>
          )}
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
