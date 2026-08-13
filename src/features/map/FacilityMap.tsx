import { useEffect, useRef } from 'react'
import { Map, useMap } from '@vis.gl/react-google-maps'
import type { Facility, PlaceCandidate, Service } from '../../types/facility'
import { facilityTypeLabel } from '../../types/facility'
import type { MapBiasBounds } from './PlaceSearchField'
import styles from './MapPage.module.css'

type Props = {
  center: google.maps.LatLngLiteral
  zoom: number
  facilities: Facility[]
  services: Service[]
  selectedId: string | null
  previewPlace: PlaceCandidate | null
  previewLatLng: google.maps.LatLngLiteral | null
  currentLocation: google.maps.LatLngLiteral | null
  mapPickMode: boolean
  onSelect: (facilityId: string) => void
  onOpenDetail: (facilityId: string) => void
  onMapClick: (latLng: google.maps.LatLngLiteral) => void
  onLocate: () => void
  onBoundsChanged?: (bounds: MapBiasBounds) => void
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildInfoWindowContent(facility: Facility, services: Service[]): string {
  const serviceTags = facility.target_service_ids
    .map((id) => services.find((service) => service.id === id)?.name ?? id)
    .map(
      (name) =>
        `<span style="display:inline-block;font-size:11px;font-weight:700;color:#0f766e;background:#e6fbf5;padding:3px 8px;border-radius:999px;margin:2px 4px 0 0;">${escapeHtml(name)}</span>`,
    )
    .join('')

  const memo = facility.shared_memo?.trim()

  return `
    <div style="min-width:200px;max-width:240px;font-family:inherit;">
      <div style="font-size:14px;font-weight:700;color:#0f172a;margin-bottom:2px;">${escapeHtml(facility.name)}</div>
      <div style="font-size:11px;color:#64748b;margin-bottom:6px;">${escapeHtml(facilityTypeLabel(facility.facility_type))} ・ ${escapeHtml(facility.city)}</div>
      ${
        facility.phone
          ? `<div style="font-size:12px;color:#334155;margin-bottom:4px;">☎ ${escapeHtml(facility.phone)}</div>`
          : ''
      }
      ${serviceTags ? `<div style="margin-bottom:6px;">${serviceTags}</div>` : ''}
      ${
        memo
          ? `<div style="font-size:11px;color:#64748b;margin-bottom:8px;white-space:pre-wrap;">${escapeHtml(memo.length > 60 ? `${memo.slice(0, 60)}…` : memo)}</div>`
          : ''
      }
      <button
        type="button"
        data-open-detail="${escapeHtml(facility.id)}"
        style="width:100%;border:none;border-radius:8px;background:#0f766e;color:#fff;font-size:12px;font-weight:700;padding:7px 0;cursor:pointer;"
      >施設詳細を見る</button>
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
  services,
  selectedId,
  previewPlace,
  previewLatLng,
  currentLocation,
  onSelect,
  onOpenDetail,
}: Pick<
  Props,
  | 'facilities'
  | 'services'
  | 'selectedId'
  | 'previewPlace'
  | 'previewLatLng'
  | 'currentLocation'
  | 'onSelect'
  | 'onOpenDetail'
>) {
  const map = useMap()
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)

  useEffect(() => {
    if (!map || !window.google?.maps) return

    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow()
    }
    const infoWindow = infoWindowRef.current

    const domReadyListener = infoWindow.addListener('domready', () => {
      const container = document.querySelector('[data-open-detail]')
      const button = container as HTMLButtonElement | null
      const facilityId = button?.dataset.openDetail
      if (button && facilityId) {
        button.onclick = () => {
          infoWindow.close()
          onOpenDetail(facilityId)
        }
      }
    })

    const markers: google.maps.Marker[] = facilities.map((facility) => {
      const selected = facility.id === selectedId
      const marker = new google.maps.Marker({
        map,
        position: { lat: facility.lat, lng: facility.lng },
        title: facility.name,
        zIndex: selected ? 10 : 1,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: selected ? 12 : 10,
          fillColor: selected ? '#0f766e' : '#14b8a6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      })
      marker.addListener('click', () => {
        onSelect(facility.id)
        infoWindow.setContent(buildInfoWindowContent(facility, services))
        infoWindow.open({ map, anchor: marker })
      })
      return marker
    })

    let previewMarker: google.maps.Marker | null = null
    const previewPosition = previewPlace
      ? { lat: previewPlace.lat, lng: previewPlace.lng }
      : previewLatLng

    if (previewPosition) {
      previewMarker = new google.maps.Marker({
        map,
        position: previewPosition,
        title: previewPlace?.name ?? '選択中の位置（未保存）',
        zIndex: 30,
        animation: google.maps.Animation.DROP,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#ea580c',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      })
    }

    let currentMarker: google.maps.Marker | null = null
    if (currentLocation) {
      currentMarker = new google.maps.Marker({
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
      domReadyListener.remove()
      markers.forEach((marker) => marker.setMap(null))
      previewMarker?.setMap(null)
      currentMarker?.setMap(null)
    }
  }, [
    map,
    facilities,
    services,
    selectedId,
    previewPlace,
    previewLatLng,
    currentLocation,
    onSelect,
    onOpenDetail,
  ])

  return null
}

export function FacilityMap({
  center,
  zoom,
  facilities,
  services,
  selectedId,
  previewPlace,
  previewLatLng,
  currentLocation,
  mapPickMode,
  onSelect,
  onOpenDetail,
  onMapClick,
  onLocate,
  onBoundsChanged,
}: Props) {
  return (
    <div className={styles.mapPane}>
      <div className={styles.mapFill}>
        <Map
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
            services={services}
            selectedId={selectedId}
            previewPlace={previewPlace}
            previewLatLng={previewLatLng}
            currentLocation={currentLocation}
            onSelect={onSelect}
            onOpenDetail={onOpenDetail}
          />
        </Map>
      </div>
      {(previewPlace || previewLatLng) && (
        <div className={styles.mapBanner}>
          オレンジのピンは未保存です。左のフォームで保存すると青緑のピンとして残ります。
        </div>
      )}
      <button type="button" className={styles.locateBtn} onClick={onLocate}>
        現在地
      </button>
    </div>
  )
}
