import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { Loader2, Search } from 'lucide-react'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import { searchPhilippineAddress } from '../../lib/services/nominatim'

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
  const searchWrapperRef = useRef(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (query.trim().length < 3) { setResults([]); setSearching(false); return }
    let stale = false
    setSearching(true)
    const timer = setTimeout(() => {
      searchPhilippineAddress(query)
        .then((found) => { if (!stale) { setResults(found); setSearching(false) } })
        .catch(() => { if (!stale) setSearching(false) })
    }, 600)
    return () => { stale = true; clearTimeout(timer) }
  }, [query])

  // Click-outside to dismiss, rather than the input's own onBlur: a
  // blur-driven hide races with the debounced fetch above and can hide
  // the dropdown moments before results arrive, when the field briefly
  // loses focus for any reason (a tap on a scrollbar, a touch-device
  // quirk) during the 600ms wait.
  useEffect(() => {
    const onClickAway = (event) => { if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) setDismissed(true) }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [])

  const selectResult = (result) => {
    onPickRef.current(result.latitude, result.longitude)
    setQuery(result.label)
    setResults([])
  }
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

  return (
    <div>
      <div className="relative mb-2" ref={searchWrapperRef}>
        <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
        <input
          type="text"
          value={query}
          onChange={(event) => { setQuery(event.target.value); setDismissed(false) }}
          placeholder="Search your address to jump the pin there…"
          className="input-field w-full pl-8 text-sm"
        />
        {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink/35" />}
        {!dismissed && results.length > 0 && (
          <ul className="absolute z-[1000] mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-black/10 bg-surface shadow-lg">
            {results.map((result) => (
              <li key={result.id}>
                <button type="button" onClick={() => selectResult(result)} className="block w-full px-3 py-2 text-left text-xs text-ink/70 hover:bg-teal-50">
                  {result.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div ref={containerRef} style={{ height }} className="w-full overflow-hidden rounded-xl border border-black/10" />
      <p className="mt-1.5 text-[11px] text-ink/40">Tap or drag the pin to your exact location. Search results come from OpenStreetMap and may not exactly match Google Maps.</p>
    </div>
  )
}
