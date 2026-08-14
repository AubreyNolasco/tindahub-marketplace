import { useEffect, useRef } from 'react'
import L from 'leaflet'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'

// Vite asset-URL fix for Leaflet's default marker icon, same as
// LocationPickerMap.jsx -- used for the delivery pin. The pickup pin is
// a plain L.circleMarker instead (colored via path options, no second
// icon asset to ship), so the two are visually distinct at a glance.
const deliveryIcon = L.icon({ iconRetinaUrl, iconUrl, shadowUrl, iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41] })

// Read-only two-pin map for an order's detail view -- Merchant pickup pin
// + delivery pin, joined by a straight dashed line (this app's distance
// is haversine, not a real road route, so the line is drawn as an
// estimate, not a path to follow -- see AddressFields.jsx's own note on
// why there's no routing provider here). Adapted from
// LocationPickerMap.jsx's map-mount plumbing, with the click/drag pin
// logic removed since nothing here is editable.
export default function OrderRouteMap({ pickup, delivery, distanceKm, height = 260 }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  const pickupLat = pickup?.latitude != null ? Number(pickup.latitude) : null
  const pickupLng = pickup?.longitude != null ? Number(pickup.longitude) : null
  const deliveryLat = delivery?.latitude != null ? Number(delivery.latitude) : null
  const deliveryLng = delivery?.longitude != null ? Number(delivery.longitude) : null
  const hasBoth = pickupLat != null && pickupLng != null && deliveryLat != null && deliveryLng != null

  useEffect(() => {
    if (!containerRef.current || !hasBoth) return
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true })
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    L.circleMarker([pickupLat, pickupLng], { radius: 9, color: '#0B4D30', weight: 2, fillColor: '#16794B', fillOpacity: 1 }).addTo(map).bindPopup('Pickup — Merchant')
    L.marker([deliveryLat, deliveryLng], { icon: deliveryIcon }).addTo(map).bindPopup('Delivery address')
    L.polyline([[pickupLat, pickupLng], [deliveryLat, deliveryLng]], { color: '#16794B', weight: 3, dashArray: '6 8', opacity: 0.75 }).addTo(map)
    map.fitBounds([[pickupLat, pickupLng], [deliveryLat, deliveryLng]], { padding: [32, 32] })

    return () => { map.remove(); mapRef.current = null }
  }, [hasBoth, pickupLat, pickupLng, deliveryLat, deliveryLng])

  if (!hasBoth) {
    return (
      <div style={{ height }} className="flex w-full items-center justify-center rounded-xl border border-black/10 bg-surface-inset text-center text-xs text-ink/45">
        Route map unavailable — pickup and delivery pins are both needed.
      </div>
    )
  }

  return (
    <div>
      <div ref={containerRef} style={{ height }} className="w-full overflow-hidden rounded-xl border border-black/10" />
      <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink/40">
        <span className="inline-block h-2 w-2 rounded-full bg-teal-600" /> Pickup
        <span className="ml-2 inline-block h-2 w-2 rounded-full bg-[#3388ff]" /> Delivery
        {distanceKm != null && <span className="ml-auto">Straight-line distance: {Number(distanceKm).toFixed(1)} km</span>}
      </p>
    </div>
  )
}
