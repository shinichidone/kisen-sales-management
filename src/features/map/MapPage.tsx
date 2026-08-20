import { useCallback, useEffect, useMemo, useState } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { env } from '../../lib/env'
import {
  createFacility,
  fetchFacilities,
  fetchServices,
} from '../../lib/facilitiesApi'
import { geocodeAddress } from '../../lib/geocode'
import { fetchAllReferralCases } from '../../lib/referralsApi'
import { fetchAllSalesVisits } from '../../lib/salesVisitsApi'
import type {
  Facility,
  FacilityDraft,
  PlaceCandidate,
  Service,
} from '../../types/facility'
import { facilityTypeLabel } from '../../types/facility'
import { FacilityDetail, type FacilityDetailTab } from '../facilities/FacilityDetail'
import { FacilityForm } from './FacilityForm'
import { FacilityMap, type FacilityMonthlyStat } from './FacilityMap'
import { PlaceSearchField, type MapBiasBounds } from './PlaceSearchField'
import styles from './MapPage.module.css'

type RegisterMode = 'place' | 'manual'
type ListFilter =
  | 'all'
  | 'no_meet_this_month'
  | 'meet_many'
  | 'no_visit_this_month'
  | 'visit_many'
  | 'no_referral_this_month'
  | 'referral_many'

const LIST_FILTERS: { value: ListFilter; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'no_meet_this_month', label: '今月面会できていない' },
  { value: 'meet_many', label: '今月面会が多い' },
  { value: 'no_visit_this_month', label: '今月未訪問' },
  { value: 'visit_many', label: '今月訪問が多い' },
  { value: 'no_referral_this_month', label: '今月紹介なし' },
  { value: 'referral_many', label: '今月紹介が多い' },
]

function todayInJst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

function toJstDateString(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' })
}

export function MapPage() {
  const defaultCenter = useMemo(() => env.mapDefaultCenter(), [])
  const defaultZoom = useMemo(() => env.mapDefaultZoom(), [])

  const [services, setServices] = useState<Service[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [registerMode, setRegisterMode] = useState<RegisterMode>('place')
  const [showRegister, setShowRegister] = useState(false)
  const [query, setQuery] = useState('')
  const [listFilter, setListFilter] = useState<ListFilter>('all')
  const [selectedPlace, setSelectedPlace] = useState<PlaceCandidate | null>(null)
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null)
  const [pickedLatLng, setPickedLatLng] = useState<{ lat: number; lng: number } | null>(
    null,
  )
  const [currentLocation, setCurrentLocation] =
    useState<google.maps.LatLngLiteral | null>(null)
  const [mapCenter, setMapCenter] = useState(defaultCenter)
  const [mapBounds, setMapBounds] = useState<MapBiasBounds | null>(null)
  const [detailFacilityId, setDetailFacilityId] = useState<string | null>(null)
  const [detailInitialTab, setDetailInitialTab] = useState<FacilityDetailTab>('overview')

  const handleBoundsChanged = useCallback((bounds: MapBiasBounds) => {
    setMapBounds(bounds)
  }, [])

  const selectedFacility = useMemo(
    () => facilities.find((item) => item.id === selectedFacilityId) ?? null,
    [facilities, selectedFacilityId],
  )

  const [monthlyStats, setMonthlyStats] = useState<Record<string, FacilityMonthlyStat>>({})

  const filteredFacilities = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = facilities.filter((facility) => {
      if (
        q &&
        !facility.name.toLowerCase().includes(q) &&
        !facility.city.toLowerCase().includes(q) &&
        !facility.address.toLowerCase().includes(q)
      ) {
        return false
      }
      const stat = monthlyStats[facility.id]
      const visitCount = stat?.visitCount ?? 0
      const metCount = stat?.metCount ?? 0
      const referralCount = stat?.referralCount ?? 0
      if (listFilter === 'no_meet_this_month') return metCount === 0
      if (listFilter === 'no_visit_this_month') return visitCount === 0
      if (listFilter === 'no_referral_this_month') return referralCount === 0
      return true
    })

    const countOf = (facilityId: string) => {
      const stat = monthlyStats[facilityId]
      if (listFilter === 'meet_many') return stat?.metCount ?? 0
      if (listFilter === 'visit_many') return stat?.visitCount ?? 0
      if (listFilter === 'referral_many') return stat?.referralCount ?? 0
      return 0
    }

    if (listFilter === 'meet_many' || listFilter === 'visit_many' || listFilter === 'referral_many') {
      return [...matched].sort((a, b) => countOf(b.id) - countOf(a.id))
    }
    return matched
  }, [facilities, query, listFilter, monthlyStats])

  const reload = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [nextServices, nextFacilities, visits, referrals] = await Promise.all([
        fetchServices(),
        fetchFacilities(),
        fetchAllSalesVisits(),
        fetchAllReferralCases(),
      ])
      setServices(nextServices)
      setFacilities(nextFacilities)

      const today = todayInJst()
      const monthPrefix = today.slice(0, 7)
      const stats: Record<string, FacilityMonthlyStat> = {}
      for (const facility of nextFacilities) {
        const facilityVisits = visits.filter(
          (v) => v.facility_id === facility.id && toJstDateString(v.visited_at).startsWith(monthPrefix),
        )
        const facilityReferrals = referrals.filter(
          (r) => r.facility_id === facility.id && r.referred_on.startsWith(monthPrefix),
        )
        stats[facility.id] = {
          visitCount: facilityVisits.length,
          metCount: facilityVisits.filter((v) => v.result === 'met').length,
          referralCount: facilityReferrals.length,
          startedCount: facilityReferrals.filter((r) => r.status === 'started').length,
        }
      }
      setMonthlyStats(stats)
    } catch (err) {
      const detail =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: string }).message)
          : err instanceof Error
            ? err.message
            : ''
      setLoadError(
        detail
          ? `データの読み込みに失敗しました: ${detail}`
          : 'データの読み込みに失敗しました。Supabase設定を確認してください。',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const handlePlaceSelect = useCallback((place: PlaceCandidate) => {
    setSelectedPlace(place)
    setPickedLatLng(null)
    setRegisterMode('place')
    setShowRegister(true)
    setMapCenter({ lat: place.lat, lng: place.lng })
    setMessage(
      `「${place.name}」を選択しました。地図にオレンジのピンが出ます。種別・サービスを選んで保存してください。`,
    )
  }, [])

  const handleSave = useCallback(
    async (draft: FacilityDraft) => {
      const created = await createFacility(draft)
      setFacilities((prev) => [created, ...prev])
      setSelectedFacilityId(created.id)
      setSelectedPlace(null)
      setPickedLatLng(null)
      setMapCenter({ lat: created.lat, lng: created.lng })
      setShowRegister(false)
      setMessage(`「${created.name}」を保存しました。`)
    },
    [],
  )

  const handleSelectFacility = useCallback((id: string) => {
    setSelectedFacilityId(id)
  }, [])

  // 地図ピンからの遷移は「営業した後に記録を入力する」が最も多い使い方なので、
  // 営業履歴タブをすぐ入力できる状態で開く
  const handleOpenDetail = useCallback((id: string) => {
    setDetailFacilityId(id)
    setDetailInitialTab('visits')
  }, [])

  const handleOpenFacilityFromList = useCallback((id: string, lat: number, lng: number) => {
    setSelectedFacilityId(id)
    setMapCenter({ lat, lng })
    setDetailFacilityId(id)
    setDetailInitialTab('visits')
  }, [])

  const closeRegister = useCallback(() => {
    setShowRegister(false)
    setSelectedPlace(null)
    setPickedLatLng(null)
    setMessage(null)
  }, [])

  const handleAddressGeocode = useCallback(async (address: string) => {
    try {
      const result = await geocodeAddress(address)
      if (!result) {
        setMessage('住所から位置を特定できませんでした。地図をタップして位置を指定してください。')
        return null
      }
      setPickedLatLng({ lat: result.lat, lng: result.lng })
      setMapCenter({ lat: result.lat, lng: result.lng })
      setMessage('住所の位置にオレンジのピンを置きました。指でドラッグして微調整できます。')
      return result
    } catch (err) {
      console.error('住所の位置特定に失敗しました:', err)
      setMessage('住所から位置を特定できませんでした。地図をタップして位置を指定してください。')
      return null
    }
  }, [])

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) {
      setMessage('この端末では現在地を取得できません。')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }
        setCurrentLocation(next)
        setMapCenter(next)
        setMessage('現在地を表示しました。')
      },
      () => {
        setMessage('現在地の取得が許可されませんでした。')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  return (
    <APIProvider
      apiKey={env.googleMapsApiKey()}
      language="ja"
      region="JP"
      libraries={['places']}
    >
      <div className={styles.page}>
        <aside className={styles.panel}>
          <div>
            <h2 className={styles.sectionTitle}>登録済み事業所を探す</h2>
            <p className={styles.muted}>名前・市区町村・住所で検索できます。</p>
          </div>

          <input
            className={styles.input}
            placeholder="例：寿里苑、河内長野市"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="登録済み事業所を検索"
          />

          <div>
            <p className={styles.filterLabel}>一覧の絞り込み</p>
            <div className={styles.chips}>
              {LIST_FILTERS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={listFilter === item.value ? styles.chipActive : styles.chip}
                  onClick={() => setListFilter(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {message ? <div className={styles.alertOk}>{message}</div> : null}
          {loadError ? <div className={styles.alert}>{loadError}</div> : null}

          <div>
            <h2 className={styles.sectionTitle}>
              事業所一覧
              {!loading ? <span className={styles.count}>（{filteredFacilities.length}件）</span> : null}
            </h2>
            {loading ? <LoadingSpinner /> : null}
            {!loading && facilities.length === 0 ? (
              <p className={styles.empty}>まだ施設がありません。下のボタンから登録してください。</p>
            ) : null}
            {!loading && facilities.length > 0 && filteredFacilities.length === 0 ? (
              <p className={styles.empty}>条件に合う事業所が見つかりません。</p>
            ) : null}
            <div className={styles.list}>
              {filteredFacilities.map((facility) => {
                const stat = monthlyStats[facility.id]
                return (
                  <button
                    key={facility.id}
                    type="button"
                    className={
                      facility.id === selectedFacilityId ? styles.listItemActive : styles.listItem
                    }
                    onClick={() => {
                      handleOpenFacilityFromList(facility.id, facility.lat, facility.lng)
                    }}
                  >
                    <strong>{facility.name}</strong>
                    <span>
                      {facility.city} · {facilityTypeLabel(facility.facility_type)}
                    </span>
                    <span className={styles.listItemStats}>
                      今月 訪問{stat?.visitCount ?? 0} · 面会{stat?.metCount ?? 0} · 紹介
                      {stat?.referralCount ?? 0}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {showRegister ? (
            <div className={styles.registerBox}>
              <div className={styles.registerHeader}>
                <h2 className={styles.sectionTitle}>新たに施設を登録する</h2>
                <button type="button" className={styles.secondary} onClick={closeRegister}>
                  閉じる
                </button>
              </div>
              <p className={styles.muted}>
                検索して候補選択 → 種別を選んで保存。見つからない場合は手動登録。
              </p>

              <div className={styles.tabs}>
                <button
                  type="button"
                  className={registerMode === 'place' ? styles.tabActive : styles.tab}
                  onClick={() => {
                    setRegisterMode('place')
                  }}
                >
                  Maps検索
                </button>
                <button
                  type="button"
                  className={registerMode === 'manual' ? styles.tabActive : styles.tab}
                  onClick={() => setRegisterMode('manual')}
                >
                  手動登録
                </button>
              </div>

              {registerMode === 'place' ? (
                <PlaceSearchField
                  onSelect={handlePlaceSelect}
                  biasBounds={mapBounds}
                  biasCenter={mapCenter}
                />
              ) : null}

              <FacilityForm
                mode={registerMode}
                initialPlace={selectedPlace}
                pickedLatLng={pickedLatLng}
                onAddressGeocode={handleAddressGeocode}
                onSubmit={handleSave}
                onCancel={closeRegister}
              />
            </div>
          ) : (
            <button
              type="button"
              className={styles.registerBtn}
              onClick={() => {
                setShowRegister(true)
                setRegisterMode('place')
              }}
            >
              新たに施設を登録する
            </button>
          )}
        </aside>

        <FacilityMap
          center={mapCenter}
          zoom={defaultZoom}
          facilities={facilities}
          monthlyStats={monthlyStats}
          selectedId={selectedFacilityId}
          previewPlace={showRegister && registerMode === 'place' ? selectedPlace : null}
          previewLatLng={showRegister && registerMode === 'manual' ? pickedLatLng : null}
          currentLocation={currentLocation}
          mapPickMode={showRegister && registerMode === 'manual'}
          onSelect={handleSelectFacility}
          onOpenDetail={handleOpenDetail}
          onPreviewMove={(latLng) => {
            setPickedLatLng(latLng)
            setMessage('ピンの位置を更新しました。この位置で保存されます。')
          }}
          onMapClick={(latLng) => {
            if (!showRegister || registerMode !== 'manual') return
            setPickedLatLng(latLng)
            setMapCenter(latLng)
            setMessage('地図上の位置をセットしました。オレンジのピンをドラッグして微調整できます。')
          }}
          onLocate={handleLocate}
          onBoundsChanged={handleBoundsChanged}
        />

        <aside className={styles.panelRight}>
          <h2 className={styles.sectionTitle}>施設概要</h2>
          {selectedFacility ? (
            <div className={styles.card}>
              <h2>{selectedFacility.name}</h2>
              <p className={styles.muted}>
                {facilityTypeLabel(selectedFacility.facility_type)}
              </p>
              <dl className={styles.meta}>
                <dt>住所</dt>
                <dd>{selectedFacility.address}</dd>
                <dt>電話</dt>
                <dd>{selectedFacility.phone || '未登録'}</dd>
                <dt>位置</dt>
                <dd>
                  {selectedFacility.lat.toFixed(5)}, {selectedFacility.lng.toFixed(5)}
                </dd>
                <dt>共有メモ</dt>
                <dd>{selectedFacility.shared_memo || '（なし）'}</dd>
              </dl>
              <div className={styles.actions} style={{ marginTop: '0.85rem' }}>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={() => {
                    setDetailFacilityId(selectedFacility.id)
                    setDetailInitialTab('overview')
                  }}
                >
                  施設詳細を見る
                </button>
              </div>
              <p className={styles.hint}>
                詳細で担当者・共有メモを管理できます。営業履歴は STEP3 で追加します。
              </p>
            </div>
          ) : (
            <p className={styles.empty}>
              地図のピン、または左の一覧から施設を選択すると概要が表示されます。
            </p>
          )}
        </aside>
      </div>

      {detailFacilityId ? (
        <FacilityDetail
          facilityId={detailFacilityId}
          services={services}
          initialTab={detailInitialTab}
          onClose={() => setDetailFacilityId(null)}
          onFacilityUpdated={(updated) => {
            setFacilities((prev) =>
              prev.map((item) => (item.id === updated.id ? updated : item)),
            )
          }}
        />
      ) : null}
    </APIProvider>
  )
}
