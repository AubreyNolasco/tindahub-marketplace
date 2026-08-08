import { useEffect, useRef } from 'react'
import L from 'leaflet'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'

// Vite serves node_modules assets by hashed URL, which breaks Leaflet's
// default icon (it assumes a relative same-folder path) unless every
// marker explicitly points at the bundled URLs instead.
const markerIcon = L.icon({ iconRetinaUrl, iconUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] })

// Free OpenStreetMap tiles + the route geometry route-estimate/index.ts
// already returns (OSRM) — same "free, no paid API" posture as the edge
// function feeding it. VERIFY before real volume: the public
// tile.openstreetmap.org server's own usage policy discourages heavy
// production traffic without a fallback/CDN, same caveat as OSRM's public
// demo routing server — fine for the estimate this map illustrates, not
// a commitment to production-scale map tile serving. See TASK8.md.
export default function RouteMap({ pickup, dropoff, geometry, height = 220 }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !pickup || !dropoff) return
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true })
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    const pickupMarker = L.marker([pickup.lat, pickup.lng], { icon: markerIcon }).addTo(map).bindPopup('Pickup (Merchant)')
    const dropoffMarker = L.marker([dropoff.lat, dropoff.lng], { icon: markerIcon }).addTo(map).bindPopup('Delivery (Customer)')

    const points = geometry?.length ? geometry : [[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng]]
    const line = geometry?.length ? L.polyline(points, { color: '#0F9D78', weight: 4, opacity: 0.85 }).addTo(map) : null

    const bounds = L.latLngBounds([[pickup.lat, pickup.lng], [dropoff.lat, dropoff.lng], ...points])
    map.fitBounds(bounds, { padding: [24, 24] })

    return () => {
      pickupMarker.remove()
      dropoffMarker.remove()
      line?.remove()
      map.remove()
      mapRef.current = null
    }
  }, [pickup, dropoff, geometry])

  if (!pickup || !dropoff) return null
  return <div ref={containerRef} style={{ height }} className="mt-3 w-full overflow-hidden rounded-xl border border-black/10" />
}
