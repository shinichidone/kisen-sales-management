import { useEffect } from 'react'
import { Map, useMap } from '@vis.gl/react-google-maps'
import type { Facility, PlaceCandidate } from '../../types/facility'
import styles from './MapPage.module.css'

type Props = {
  center: google.maps.LatLngLiteral
  zoom: number
  facilities: Facility[]
  selectedId: string | null
  previewPlace: PlaceCandidate | null
  previewLatLng: google.maps.LatLngLiteral | null
  currentLocation: google.maps.LatLngLiteral | null
  mapPickMode: boolean
  onSelect: (facilityId: string) => void
  onMapClick: (latLng: google.maps.LatLngLiteral) => void
  onLocate: () => void
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
  selectedId,
  previewPlace,
  previewLatLng,
  currentLocation,
  onSelect,
}: Pick<
  Props,
  | 'facilities'
  | 'selectedId'
  | 'previewPlace'
  | 'previewLatLng'
  | 'currentLocation'
  | 'onSelect'
>) {
  const map = useMap()

  useEffect(() => {
    if (!map || !window.google?.maps) return

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
      marker.addListener('click', () => onSelect(facility.id))
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
      markers.forEach((marker) => marker.setMap(null))
      previewMarker?.setMap(null)
      currentMarker?.setMap(null)
    }
  }, [
    map,
    facilities,
    selectedId,
    previewPlace,
    previewLatLng,
    currentLocation,
    onSelect,
  ])

  return null
}

export function FacilityMap({
  center,
  zoom,
  facilities,
  selectedId,
  previewPlace,
  previewLatLng,
  currentLocation,
  mapPickMode,
  onSelect,
  onMapClick,
  onLocate,
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
          <Markers
            facilities={facilities}
            selectedId={selectedId}
            previewPlace={previewPlace}
            previewLatLng={previewLatLng}
            currentLocation={currentLocation}
            onSelect={onSelect}
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
