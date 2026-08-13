import { useCallback, useEffect, useMemo, useState } from 'react'
import { APIProvider } from '@vis.gl/react-google-maps'
import { LoadingSpinner } from '../../components/LoadingSpinner'
import { env } from '../../lib/env'
import {
  createFacility,
  fetchFacilities,
  fetchServices,
} from '../../lib/facilitiesApi'
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
  const [selectedPlace, setSelectedPlace] = useState<PlaceCandidate | null>(null)
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null)
  const [mapPickMode, setMapPickMode] = useState(false)
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

  const serviceName = useCallback(
    (id: string) => services.find((service) => service.id === id)?.name ?? id,
    [services],
  )

  const [monthlyStats, setMonthlyStats] = useState<Record<string, FacilityMonthlyStat>>({})

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
      setMapPickMode(false)
      setMapCenter({ lat: created.lat, lng: created.lng })
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
            <h2 className={styles.sectionTitle}>施設を登録</h2>
            <p className={styles.muted}>
              検索して候補選択 → 種別・サービスを選んで保存。見つからない場合は手動登録。
            </p>
          </div>

          <div className={styles.tabs}>
            <button
              type="button"
              className={registerMode === 'place' ? styles.tabActive : styles.tab}
              onClick={() => {
                setRegisterMode('place')
                setMapPickMode(false)
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
            services={services}
            initialPlace={selectedPlace}
            pickedLatLng={pickedLatLng}
            mapPickMode={mapPickMode}
            onToggleMapPick={() => {
              setRegisterMode('manual')
              setMapPickMode((prev) => !prev)
            }}
            onSubmit={handleSave}
            onCancel={() => {
              setSelectedPlace(null)
              setPickedLatLng(null)
              setMapPickMode(false)
              setMessage(null)
            }}
          />

          {message ? <div className={styles.alertOk}>{message}</div> : null}
          {loadError ? <div className={styles.alert}>{loadError}</div> : null}

          <div>
            <h2 className={styles.sectionTitle}>登録済み施設</h2>
            {loading ? <LoadingSpinner /> : null}
            {!loading && facilities.length === 0 ? (
              <p className={styles.empty}>まだ施設がありません。左上から登録してください。</p>
            ) : null}
            <div className={styles.list}>
              {facilities.map((facility) => (
                <button
                  key={facility.id}
                  type="button"
                  className={
                    facility.id === selectedFacilityId
                      ? styles.listItemActive
                      : styles.listItem
                  }
                  onClick={() => {
                    setSelectedFacilityId(facility.id)
                    setMapCenter({ lat: facility.lat, lng: facility.lng })
                  }}
                >
                  <strong>{facility.name}</strong>
                  <span>
                    {facility.city} · {facilityTypeLabel(facility.facility_type)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <FacilityMap
          center={mapCenter}
          zoom={defaultZoom}
          facilities={facilities}
          monthlyStats={monthlyStats}
          selectedId={selectedFacilityId}
          previewPlace={registerMode === 'place' ? selectedPlace : null}
          previewLatLng={registerMode === 'manual' ? pickedLatLng : null}
          currentLocation={currentLocation}
          mapPickMode={mapPickMode}
          onSelect={handleSelectFacility}
          onOpenDetail={handleOpenDetail}
          onMapClick={(latLng) => {
            if (!mapPickMode) return
            setPickedLatLng(latLng)
            setMapCenter(latLng)
            setMapPickMode(false)
            setMessage('地図上の位置をセットしました。オレンジのピンが未保存位置です。')
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
                <dt>市区町村</dt>
                <dd>{selectedFacility.city}</dd>
                <dt>電話</dt>
                <dd>{selectedFacility.phone || '未登録'}</dd>
                <dt>位置</dt>
                <dd>
                  {selectedFacility.lat.toFixed(5)}, {selectedFacility.lng.toFixed(5)}
                </dd>
                <dt>共有メモ</dt>
                <dd>{selectedFacility.shared_memo || '（なし）'}</dd>
              </dl>
              <div className={styles.tags}>
                {selectedFacility.target_service_ids.map((id) => (
                  <span key={id} className={styles.tag}>
                    {serviceName(id)}
                  </span>
                ))}
              </div>
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
