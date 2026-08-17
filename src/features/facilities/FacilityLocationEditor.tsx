import { useEffect, useRef } from 'react'
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps'
import { env } from '../../lib/env'
import styles from './FacilityDetail.module.css'

type Props = {
  lat: number
  lng: number
  onMove: (position: { lat: number; lng: number }) => void
}

function DraggablePin({ lat, lng, onMove }: Props) {
  const map = useMap()
  const markerRef = useRef<google.maps.Marker | null>(null)
  const onMoveRef = useRef(onMove)
  onMoveRef.current = onMove

  useEffect(() => {
    if (!map || !window.google?.maps) return

    if (!markerRef.current) {
      const marker = new google.maps.Marker({
        map,
        position: { lat, lng },
        draggable: true,
        title: 'ドラッグして位置を修正',
        zIndex: 20,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 11,
          fillColor: '#0f766e',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
      })
      marker.addListener('dragend', () => {
        const position = marker.getPosition()
        if (!position) return
        onMoveRef.current({ lat: position.lat(), lng: position.lng() })
      })
      markerRef.current = marker
    } else {
      markerRef.current.setPosition({ lat, lng })
    }
  }, [map, lat, lng])

  useEffect(() => {
    if (!map) return
    map.panTo({ lat, lng })
  }, [map, lat, lng])

  useEffect(() => {
    return () => {
      markerRef.current?.setMap(null)
      markerRef.current = null
    }
  }, [])

  return null
}

export function FacilityLocationEditor({ lat, lng, onMove }: Props) {
  return (
    <div className={styles.locationMap}>
      <APIProvider apiKey={env.googleMapsApiKey()} language="ja" region="JP">
        <Map
          defaultCenter={{ lat, lng }}
          defaultZoom={16}
          gestureHandling="greedy"
          disableDefaultUI={false}
          clickableIcons={false}
          style={{ width: '100%', height: '100%' }}
          onClick={(event) => {
            const nextLat = event.detail.latLng?.lat
            const nextLng = event.detail.latLng?.lng
            if (typeof nextLat !== 'number' || typeof nextLng !== 'number') return
            onMove({ lat: nextLat, lng: nextLng })
          }}
        >
          <DraggablePin lat={lat} lng={lng} onMove={onMove} />
        </Map>
      </APIProvider>
    </div>
  )
}
