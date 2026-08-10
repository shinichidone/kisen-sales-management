import { useEffect } from 'react'
import { Map, useMap } from '@vis.gl/react-google-maps'
import type { Facility } from '../../types/facility'
import styles from './MapPage.module.css'

type Props = {
  center: google.maps.LatLngLiteral
  zoom: number
  facilities: Facility[]
  selectedId: string | null
  currentLocation: google.maps.LatLngLiteral | null
  mapPickMode: boolean
  onSelect: (facilityId: string) => void
  onMapClick: (latLng: google.maps.LatLngLiteral) => void
  onLocate: () => void
}

function MapCamera({ center }: { center: google.maps.LatLngLiteral }) {
  const map = useMap()

  useEffect(() => {
    if (!map) return
    map.panTo(center)
  }, [map, center])

  return null
}

function Markers({
  facilities,
  selectedId,
  currentLocation,
  onSelect,
}: Pick<Props, 'facilities' | 'selectedId' | 'currentLocation' | 'onSelect'>) {
  const map = useMap()

  useEffect(() => {
    if (!map) return

    const markers: google.maps.Marker[] = facilities.map((facility) => {
      const selected = facility.id === selectedId
      const marker = new google.maps.Marker({
        map,
        position: { lat: facility.lat, lng: facility.lng },
        title: facility.name,
        zIndex: selected ? 10 : 1,
        icon: selected
          ? {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 11,
              fillColor: '#0f766e',
              fillOpacity: 1,
              strokeColor: '#115e59',
              strokeWeight: 2,
            }
          : {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 9,
              fillColor: '#14b8a6',
              fillOpacity: 1,
              strokeColor: '#115e59',
              strokeWeight: 1.5,
            },
      })
      marker.addListener('click', () => onSelect(facility.id))
      return marker
    })

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
      currentMarker?.setMap(null)
    }
  }, [map, facilities, selectedId, currentLocation, onSelect])

  return null
}

export function FacilityMap({
  center,
  zoom,
  facilities,
  selectedId,
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
          <MapCamera center={center} />
          <Markers
            facilities={facilities}
            selectedId={selectedId}
            currentLocation={currentLocation}
            onSelect={onSelect}
          />
        </Map>
      </div>
      <button type="button" className={styles.locateBtn} onClick={onLocate}>
        現在地
      </button>
    </div>
  )
}
