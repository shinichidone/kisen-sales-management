import { useEffect, useRef } from 'react'
import { Map as GoogleMap, useMap } from '@vis.gl/react-google-maps'
import type { Facility, PlaceCandidate } from '../../types/facility'
import { facilityTypeLabel } from '../../types/facility'
import type { MapBiasBounds } from './PlaceSearchField'
import styles from './MapPage.module.css'

export type FacilityMonthlyStat = {
  visitCount: number
  metCount: number
  referralCount: number
  startedCount: number
}

type Props = {
  center: google.maps.LatLngLiteral
  zoom: number
  facilities: Facility[]
  monthlyStats: Record<string, FacilityMonthlyStat>
  selectedId: string | null
  previewPlace: PlaceCandidate | null
  previewLatLng: google.maps.LatLngLiteral | null
  currentLocation: google.maps.LatLngLiteral | null
  mapPickMode: boolean
  onSelect: (facilityId: string) => void
  onOpenDetail: (facilityId: string) => void
  onPreviewMove?: (latLng: google.maps.LatLngLiteral) => void
  onMapClick: (latLng: google.maps.LatLngLiteral) => void
  onLocate: () => void
  onBoundsChanged?: (bounds: MapBiasBounds) => void
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function truncateLabel(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}…`
}

/** 施設名と今月の訪問数を書き込んだラベル付きピンをSVGで生成する */
function buildMarkerIcon(
  facility: Facility,
  stat: FacilityMonthlyStat | undefined,
  selected: boolean,
): google.maps.Icon {
  const visitCount = stat?.visitCount ?? 0
  const label = truncateLabel(facility.name, 9)
  const countText = `今月 ${visitCount}件`
  const dotColor = selected ? '#0f766e' : '#14b8a6'
  const countColor = visitCount > 0 ? '#0f766e' : '#94a3b8'
  const borderColor = selected ? '#0f766e' : '#cbd5e1'

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="54">
      <rect x="2" y="2" width="116" height="32" rx="8" fill="#ffffff" stroke="${borderColor}" stroke-width="1.5" />
      <text x="60" y="15" text-anchor="middle" font-family="sans-serif" font-size="10" font-weight="700" fill="#0f172a">${escapeXml(label)}</text>
      <text x="60" y="28" text-anchor="middle" font-family="sans-serif" font-size="10.5" font-weight="800" fill="${countColor}">${escapeXml(countText)}</text>
      <line x1="60" y1="34" x2="60" y2="42" stroke="${borderColor}" stroke-width="2" />
      <circle cx="60" cy="46" r="${selected ? 6 : 5}" fill="${dotColor}" stroke="#ffffff" stroke-width="2" />
    </svg>`

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(120, 54),
    anchor: new google.maps.Point(60, 46),
  }
}

function buildInfoWindowContent(
  facility: Facility,
  stat: FacilityMonthlyStat | undefined,
): string {
  const visitCount = stat?.visitCount ?? 0
  const metCount = stat?.metCount ?? 0
  const referralCount = stat?.referralCount ?? 0
  const startedCount = stat?.startedCount ?? 0
  const meetRateText =
    visitCount > 0 ? `${Math.round((metCount / visitCount) * 100)}%` : '－'

  return `
    <div style="width:220px;font-family:inherit;padding:2px 0 4px;">
      <div style="font-size:13px;font-weight:700;color:#0f172a;line-height:1.3;margin-bottom:2px;">${escapeXml(facility.name)}</div>
      <div style="font-size:11px;color:#64748b;margin-bottom:8px;">${escapeXml(facilityTypeLabel(facility.facility_type))} ・ ${escapeXml(facility.city)}</div>
      <div style="font-size:11px;font-weight:700;color:#115e59;margin-bottom:6px;">今月の営業実績</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
        <div style="background:#f5f8f7;border-radius:8px;padding:6px 8px;">
          <div style="font-size:10px;color:#64748b;">訪問</div>
          <div style="font-size:16px;font-weight:800;color:#115e59;">${visitCount}</div>
        </div>
        <div style="background:#f5f8f7;border-radius:8px;padding:6px 8px;">
          <div style="font-size:10px;color:#64748b;">面会</div>
          <div style="font-size:16px;font-weight:800;color:#115e59;">${metCount}<span style="font-size:10px;font-weight:700;margin-left:2px;">(${meetRateText})</span></div>
        </div>
        <div style="background:#f5f8f7;border-radius:8px;padding:6px 8px;">
          <div style="font-size:10px;color:#64748b;">紹介</div>
          <div style="font-size:16px;font-weight:800;color:#115e59;">${referralCount}</div>
        </div>
        <div style="background:#f5f8f7;border-radius:8px;padding:6px 8px;">
          <div style="font-size:10px;color:#64748b;">利用開始</div>
          <div style="font-size:16px;font-weight:800;color:#115e59;">${startedCount}</div>
        </div>
      </div>
      <button
        type="button"
        data-open-detail="${escapeXml(facility.id)}"
        style="display:block;width:100%;box-sizing:border-box;border:none;border-radius:8px;background:#0f766e;color:#fff;font-size:13px;font-weight:700;padding:10px 0;cursor:pointer;"
      >営業記録を入力する</button>
    </div>
  `
}

function BoundsReporter({
  onBoundsChanged,
}: {
  onBoundsChanged?: (bounds: MapBiasBounds) => void
}) {
  const map = useMap()

  useEffect(() => {
    if (!map || !onBoundsChanged) return

    const emit = () => {
      const bounds = map.getBounds()
      if (!bounds) return
      const ne = bounds.getNorthEast()
      const sw = bounds.getSouthWest()
      onBoundsChanged({
        north: ne.lat(),
        east: ne.lng(),
        south: sw.lat(),
        west: sw.lng(),
      })
    }

    emit()
    const idleListener = map.addListener('idle', emit)
    return () => {
      idleListener.remove()
    }
  }, [map, onBoundsChanged])

  return null
}

function MapCamera({
  center,
  zoom,
}: {
  center: google.maps.LatLngLiteral
  zoom: number
}) {
  const map = useMap()

  useEffect(() => {
    if (!map) return
    map.panTo(center)
    if (typeof map.getZoom === 'function' && (map.getZoom() ?? zoom) < 14) {
      map.setZoom(Math.max(zoom, 15))
    }
  }, [map, center, zoom])

  return null
}

function Markers({
  facilities,
  monthlyStats,
  selectedId,
  previewPlace,
  previewLatLng,
  currentLocation,
  onSelect,
  onOpenDetail,
  onPreviewMove,
}: Pick<
  Props,
  | 'facilities'
  | 'monthlyStats'
  | 'selectedId'
  | 'previewPlace'
  | 'previewLatLng'
  | 'currentLocation'
  | 'onSelect'
  | 'onOpenDetail'
  | 'onPreviewMove'
>) {
  const map = useMap()
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map())
  const previewMarkerRef = useRef<google.maps.Marker | null>(null)
  const currentMarkerRef = useRef<google.maps.Marker | null>(null)
  const openedAtRef = useRef(0)

  // 施設・実績データはタップ時点の最新値を参照するため ref に保持する
  // （マーカーは作り直さず再利用するので、クロージャの値が古くならないようにする）
  const facilitiesRef = useRef(facilities)
  facilitiesRef.current = facilities
  const monthlyStatsRef = useRef(monthlyStats)
  monthlyStatsRef.current = monthlyStats
  const onOpenDetailRef = useRef(onOpenDetail)
  onOpenDetailRef.current = onOpenDetail
  const onPreviewMoveRef = useRef(onPreviewMove)
  onPreviewMoveRef.current = onPreviewMove

  // InfoWindowと「詳細を見る」ボタンのクリック中継は一度だけ設定する
  useEffect(() => {
    if (!map || !window.google?.maps) return
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow({
        maxWidth: 260,
        headerDisabled: true,
      })
    }
    const infoWindow = infoWindowRef.current

    const domReadyListener = infoWindow.addListener('domready', () => {
      const button = document.querySelector('[data-open-detail]') as HTMLButtonElement | null
      const facilityId = button?.dataset.openDetail
      if (button && facilityId) {
        button.onclick = () => {
          infoWindow.close()
          onOpenDetailRef.current(facilityId)
        }
      }
    })

    const mapClickListener = map.addListener('click', () => {
      if (Date.now() - openedAtRef.current < 400) return
      infoWindow.close()
    })

    return () => {
      domReadyListener.remove()
      mapClickListener.remove()
    }
  }, [map])

  // 施設ピンは既存のマーカーを再利用し、位置・アイコンだけ更新する
  // （タップ直後にマーカーを作り直すと、開いた直後にInfoWindowが閉じてしまう不具合になるため）
  useEffect(() => {
    if (!map || !window.google?.maps) return

    const currentIds = new Set(facilities.map((facility) => facility.id))
    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) {
        marker.setMap(null)
        markersRef.current.delete(id)
      }
    }

    facilities.forEach((facility) => {
      const selected = facility.id === selectedId
      const stat = monthlyStats[facility.id]
      let marker = markersRef.current.get(facility.id)

      if (!marker) {
        marker = new google.maps.Marker({
          map,
          position: { lat: facility.lat, lng: facility.lng },
          title: facility.name,
        })
        marker.addListener('click', () => {
          const latestFacility =
            facilitiesRef.current.find((item) => item.id === facility.id) ?? facility
          const latestStat = monthlyStatsRef.current[facility.id]
          onSelect(facility.id)
          const infoWindow = infoWindowRef.current
          if (!infoWindow) return
          openedAtRef.current = Date.now()
          infoWindow.setContent(buildInfoWindowContent(latestFacility, latestStat))
          infoWindow.open({ map, anchor: marker })
        })
        markersRef.current.set(facility.id, marker)
      } else {
        marker.setPosition({ lat: facility.lat, lng: facility.lng })
        marker.setTitle(facility.name)
      }

      marker.setIcon(buildMarkerIcon(facility, stat, selected))
      marker.setZIndex(selected ? 10 : 1)
    })
  }, [map, facilities, monthlyStats, selectedId, onSelect])

  // 未保存位置プレビュー用ピン（手動登録時はドラッグで微調整できる）
  useEffect(() => {
    if (!map || !window.google?.maps) return

    const previewPosition = previewPlace
      ? { lat: previewPlace.lat, lng: previewPlace.lng }
      : previewLatLng

    if (!previewPosition) {
      previewMarkerRef.current?.setMap(null)
      previewMarkerRef.current = null
      return
    }

    const draggable = !previewPlace && Boolean(previewLatLng)
    let marker = previewMarkerRef.current
    if (!marker) {
      marker = new google.maps.Marker({
        map,
        position: previewPosition,
        zIndex: 30,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#ea580c',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      })
      marker.addListener('dragend', () => {
        const position = marker?.getPosition()
        if (!position) return
        onPreviewMoveRef.current?.({ lat: position.lat(), lng: position.lng() })
      })
      previewMarkerRef.current = marker
    } else {
      marker.setPosition(previewPosition)
    }

    marker.setTitle(
      previewPlace?.name ?? (draggable ? 'ドラッグして位置を微調整' : '選択中の位置（未保存）'),
    )
    marker.setDraggable(draggable)
  }, [map, previewPlace, previewLatLng])

  // 現在地ピン
  useEffect(() => {
    if (!map || !window.google?.maps) return

    currentMarkerRef.current?.setMap(null)
    currentMarkerRef.current = null

    if (currentLocation) {
      currentMarkerRef.current = new google.maps.Marker({
        map,
        position: currentLocation,
        title: '現在地',
        zIndex: 20,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#0284c7',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      })
    }

    return () => {
      currentMarkerRef.current?.setMap(null)
      currentMarkerRef.current = null
    }
  }, [map, currentLocation])

  // アンマウント時に施設ピンを全て片付ける
  useEffect(() => {
    return () => {
      for (const marker of markersRef.current.values()) {
        marker.setMap(null)
      }
      markersRef.current.clear()
      previewMarkerRef.current?.setMap(null)
      previewMarkerRef.current = null
    }
  }, [])

  return null
}

export function FacilityMap({
  center,
  zoom,
  facilities,
  monthlyStats,
  selectedId,
  previewPlace,
  previewLatLng,
  currentLocation,
  mapPickMode,
  onSelect,
  onOpenDetail,
  onPreviewMove,
  onMapClick,
  onLocate,
  onBoundsChanged,
}: Props) {
  return (
    <div className={styles.mapPane}>
      <div className={styles.mapFill}>
        <GoogleMap
          defaultCenter={center}
          defaultZoom={zoom}
          gestureHandling="greedy"
          disableDefaultUI={false}
          clickableIcons={false}
          style={{
            width: '100%',
            height: '100%',
            cursor: mapPickMode ? 'crosshair' : undefined,
          }}
          onClick={(event) => {
            const lat = event.detail.latLng?.lat
            const lng = event.detail.latLng?.lng
            if (typeof lat !== 'number' || typeof lng !== 'number') return
            onMapClick({ lat, lng })
          }}
        >
          <MapCamera center={center} zoom={zoom} />
          <BoundsReporter onBoundsChanged={onBoundsChanged} />
          <Markers
            facilities={facilities}
            monthlyStats={monthlyStats}
            selectedId={selectedId}
            previewPlace={previewPlace}
            previewLatLng={previewLatLng}
            currentLocation={currentLocation}
            onSelect={onSelect}
            onOpenDetail={onOpenDetail}
            onPreviewMove={onPreviewMove}
          />
        </GoogleMap>
      </div>
      {(previewPlace || previewLatLng) && (
        <div className={styles.mapBanner}>
          オレンジのピンは未保存です。指でドラッグして位置を微調整し、フォームで保存してください。
        </div>
      )}
      <button type="button" className={styles.locateBtn} onClick={onLocate}>
        現在地
      </button>
    </div>
  )
}
