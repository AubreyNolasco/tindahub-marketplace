import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { loadGoogleMaps, isGoogleMapsConfigured } from '../../lib/googleMaps'
import { isMapsEnabled } from '../../lib/services/maps'

// Split address fill-up used everywhere in the system (reseller/merchant
// profile address, saved customers, checkout shipping address, clinic
// referrals). Works standalone (5 plain inputs) with or without Google
// Maps — the search box on top only appears once an admin has enabled
// maps.google in Settings -> Integrations AND VITE_GOOGLE_MAPS_API_KEY is
// deployed; picking a place there fills every field below (plus
// latitude/longitude, when the caller wants them) in one step. Nothing
// about the manual fields changes if Maps never loads.

function parsePlace(place) {
  const comps = place.address_components || []
  const part = (type) => comps.find((c) => c.types.includes(type))?.long_name || ''
  const street = [part('street_number'), part('route')].filter(Boolean).join(' ')
  const lat = place.geometry?.location?.lat?.()
  const lng = place.geometry?.location?.lng?.()
  return {
    street: street || place.name || '',
    barangay: part('sublocality_level_1') || part('sublocality') || part('neighborhood'),
    city: part('locality') || part('administrative_area_level_3'),
    province: part('administrative_area_level_2') || part('administrative_area_level_1'),
    postalCode: part('postal_code'),
    latitude: typeof lat === 'number' ? lat : null,
    longitude: typeof lng === 'number' ? lng : null,
  }
}

export default function AddressFields({ value, onChange, required = false, withCoordinates = false }) {
  const searchRef = useRef(null)
  const autocompleteRef = useRef(null)
  const latestRef = useRef({ value, onChange })
  const [mapsReady, setMapsReady] = useState(false)
  const [mapsLoading, setMapsLoading] = useState(false)

  useEffect(() => { latestRef.current = { value, onChange } }, [value, onChange])

  useEffect(() => {
    let active = true
    isMapsEnabled()
      .then((enabled) => {
        if (!active || !enabled || !isGoogleMapsConfigured()) return
        setMapsLoading(true)
        return loadGoogleMaps()
          .then(() => { if (active) setMapsReady(true) })
          .finally(() => { if (active) setMapsLoading(false) })
      })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!mapsReady || !searchRef.current || autocompleteRef.current) return
    const autocomplete = new window.google.maps.places.Autocomplete(searchRef.current, {
      componentRestrictions: { country: 'ph' },
      fields: ['address_components', 'geometry', 'name'],
    })
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place?.address_components) return
      const { value: currentValue, onChange: currentOnChange } = latestRef.current
      const filled = parsePlace(place)
      currentOnChange({ ...currentValue, ...filled, ...(withCoordinates ? {} : { latitude: currentValue.latitude, longitude: currentValue.longitude }) })
      if (searchRef.current) searchRef.current.value = ''
    })
    autocompleteRef.current = autocomplete
  }, [mapsReady, withCoordinates])

  const setField = (field) => (event) => {
    const next = { ...value, [field]: event.target.value }
    // A manual edit after an autocomplete pick means the pinned
    // coordinates may no longer match what's actually typed — clear
    // rather than keep a stale pin silently attached to a changed address.
    if (withCoordinates && value.latitude != null) { next.latitude = null; next.longitude = null }
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {mapsReady && (
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
          <input ref={searchRef} type="text" placeholder="Search your address on Google Maps…" className="input-field pl-9" />
        </div>
      )}
      {!mapsReady && mapsLoading && (
        <p className="flex items-center gap-1.5 text-xs text-ink/40"><Loader2 size={12} className="animate-spin" /> Loading Google Maps…</p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <input required={required} className="input-field sm:col-span-2" placeholder="House/Unit No. & Street" value={value.street} onChange={setField('street')} maxLength={200} />
        <input required={required} className="input-field" placeholder="Barangay" value={value.barangay} onChange={setField('barangay')} maxLength={120} />
        <input required={required} className="input-field" placeholder="City / Municipality" value={value.city} onChange={setField('city')} maxLength={120} />
        <input required={required} className="input-field" placeholder="Province" value={value.province} onChange={setField('province')} maxLength={120} />
        <input className="input-field" placeholder="Postal Code" value={value.postalCode} onChange={setField('postalCode')} maxLength={10} />
      </div>
      {withCoordinates && value.latitude != null && (
        <p className="flex items-center gap-1 text-[11px] font-medium text-teal-700"><MapPin size={11} /> Location pinned from Google Maps</p>
      )}
    </div>
  )
}
