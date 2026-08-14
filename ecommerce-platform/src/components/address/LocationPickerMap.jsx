import { useEffect, useRef } from 'react'
import L from 'leaflet'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'

// Vite asset-URL fix for Leaflet's default marker icon.
const markerIcon = L.icon({ iconRetinaUrl, iconUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] })

// Center of the Philippines — used only when the user has no pin yet, so
// the first map they see isn't zoomed into the middle of the ocean at
// [0, 0].
const DEFAULT_CENTER = [12.8797, 121.774]
const DEFAULT_ZOOM = 6
const PIN_ZOOM = 17

// Click-or-drag pin picker for AddressFields' "Pin your exact location"
// mode — the only way latitude/longitude get set, since there's no
// geocoding provider to derive them from typed text.
export default function LocationPickerMap({ latitude, longitude, onPick, height = 260 }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  // Supabase returns `numeric` columns as strings to avoid float
  // precision loss in JSON, so lat/lng arriving from a saved profile can
  // be "14.599500" rather than a number — Leaflet needs real numbers.
  latitude = latitude != null ? Number(latitude) : null
  longitude = longitude != null ? Number(longitude) : null

  useEffect(() => {
    if (!containerRef.current) return
    const hasPin = latitude != null && longitude != null
    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      center: hasPin ? [latitude, longitude] : DEFAULT_CENTER,
      zoom: hasPin ? PIN_ZOOM : DEFAULT_ZOOM,
    })
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    const placeMarker = (lat, lng) => {
      if (markerRef.current) { markerRef.current.setLatLng([lat, lng]); return }
      const marker = L.marker([lat, lng], { icon: markerIcon, draggable: true }).addTo(map)
      marker.on('dragend', () => { const pos = marker.getLatLng(); onPickRef.current(pos.lat, pos.lng) })
      markerRef.current = marker
    }

    if (hasPin) placeMarker(latitude, longitude)

    map.on('click', (event) => {
      placeMarker(event.latlng.lat, event.latlng.lng)
      onPickRef.current(event.latlng.lat, event.latlng.lng)
    })

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // Intentionally mount once — re-centering on every keystroke-driven
    // coordinate change would fight the user while they're dragging the
    // pin. useCurrentLocation() below re-centers explicitly when needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (latitude == null || longitude == null) {
      if (markerRef.current) { markerRef.current.remove(); markerRef.current = null }
      return
    }
    if (markerRef.current) markerRef.current.setLatLng([latitude, longitude])
    else markerRef.current = L.marker([latitude, longitude], { icon: markerIcon, draggable: true }).addTo(map).on('dragend', function () { const pos = this.getLatLng(); onPickRef.current(pos.lat, pos.lng) })
    map.setView([latitude, longitude], Math.max(map.getZoom(), PIN_ZOOM))
  }, [latitude, longitude])

  return <div ref={containerRef} style={{ height }} className="w-full overflow-hidden rounded-xl border border-black/10" />
}
