import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Crosshair, Loader2, MapPin, MapPinOff, Search } from 'lucide-react'
import { isLocationIqConfigured, searchAddress } from '../../lib/locationiq'
import { isMapsEnabled } from '../../lib/services/maps'
import { listCities, listProvinces, listBarangays } from '../../lib/services/psgc'
import SearchableSelect from './SearchableSelect'

// Leaflet + its CSS is ~55KB — same "don't pay for it until it's actually
// opened" reasoning ShippingFeeModal.jsx already applies to RouteMap.
const LocationPickerMap = lazy(() => import('./LocationPickerMap'))

// Split address fill-up used everywhere in the system. Province, City,
// and Barangay are picked from the official PSGC list (cascading — the
// City list only shows cities in the chosen province, Barangay only
// shows barangays in the chosen city), so there's no way to end up with
// a barangay that doesn't actually belong to the selected city. Street
// and Postal Code stay free text (PSGC doesn't cover street level).
//
// The LocationIQ search box on top (when an admin has enabled
// maps.locationiq and VITE_LOCATIONIQ_API_KEY is deployed) only fills
// Street + coordinates — it deliberately never touches
// Barangay/City/Province, since a geocoder's free-text guess for those
// could disagree with the official PSGC name and desync the dropdowns
// from what's actually stored.

export default function AddressFields({ value, onChange, required = false, withCoordinates = false }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [locationIqAvailable, setLocationIqAvailable] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [locating, setLocating] = useState(false)
  const wrapperRef = useRef(null)
  const abortRef = useRef(null)

  const [provinces, setProvinces] = useState([])
  const [cities, setCities] = useState([])
  const [barangays, setBarangays] = useState([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [barangaysLoading, setBarangaysLoading] = useState(false)

  useEffect(() => {
    let active = true
    isMapsEnabled()
      .then((enabled) => { if (active) setLocationIqAvailable(enabled && isLocationIqConfigured()) })
      .catch(() => {})
    listProvinces().then((rows) => { if (active) setProvinces(rows) }).catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!value.provinceCode) { setCities([]); return }
    let active = true
    setCitiesLoading(true)
    listCities(value.provinceCode).then((rows) => { if (active) setCities(rows) }).catch(() => { if (active) setCities([]) }).finally(() => { if (active) setCitiesLoading(false) })
    return () => { active = false }
  }, [value.provinceCode])

  useEffect(() => {
    if (!value.cityCode) { setBarangays([]); return }
    let active = true
    setBarangaysLoading(true)
    listBarangays(value.cityCode).then((rows) => { if (active) setBarangays(rows) }).catch(() => { if (active) setBarangays([]) }).finally(() => { if (active) setBarangaysLoading(false) })
    return () => { active = false }
  }, [value.cityCode])

  useEffect(() => {
    if (!locationIqAvailable || searchQuery.trim().length < 3) { setSuggestions([]); return }
    const timer = setTimeout(() => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setSearching(true)
      searchAddress(searchQuery, controller.signal)
        .then((results) => { setSuggestions(results); setOpen(true) })
        .catch((error) => { if (error.name !== 'AbortError') setSuggestions([]) })
        .finally(() => setSearching(false))
    }, 350)
    return () => clearTimeout(timer)
  }, [searchQuery, locationIqAvailable])

  useEffect(() => {
    const onClickAway = (event) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [])

  const pickSearchResult = (result) => {
    onChange({ ...value, street: result.street, ...(withCoordinates ? { latitude: result.latitude, longitude: result.longitude } : {}) })
    setSearchQuery('')
    setSuggestions([])
    setOpen(false)
  }

  // Coordinates used to get silently wiped out any time the Street text
  // changed (even a one-character typo fix), on the theory that a pin
  // picked from a search result no longer matches once the text drifts
  // from it. In practice that just threw away a real, user-confirmed pin
  // — including one dropped directly on the map, which has nothing to do
  // with the Street text at all — so a merchant/reseller who fixed a
  // typo after pinning their location lost the pin with no warning and
  // no indication anything happened. The pin is kept as-is now; the user
  // clears or moves it explicitly via the map instead.
  const setStreet = (event) => onChange({ ...value, street: event.target.value })
  const setPostalCode = (event) => onChange({ ...value, postalCode: event.target.value })

  const selectProvince = (option) => onChange({ ...value, province: option.name, provinceCode: option.code, city: '', cityCode: null, barangay: '' })
  const selectCity = (option) => onChange({ ...value, city: option.name, cityCode: option.code, barangay: '' })
  const selectBarangay = (option) => onChange({ ...value, barangay: option.name })

  const pickMapLocation = (lat, lng) => onChange({ ...value, latitude: lat, longitude: lng })
  const clearMapLocation = () => onChange({ ...value, latitude: null, longitude: null })

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return
    setLocating(true)
    setShowMap(true)
    navigator.geolocation.getCurrentPosition(
      (position) => { pickMapLocation(position.coords.latitude, position.coords.longitude); setLocating(false) },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <div className="space-y-2">
      {locationIqAvailable && (
        <div ref={wrapperRef} className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Search to fill in street + location…"
            className="input-field pl-9"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
          />
          {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-ink/35" />}
          {open && suggestions.length > 0 && (
            <ul role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-black/10 bg-surface py-1 shadow-lg">
              {suggestions.map((result, i) => (
                <li key={i} role="option" aria-selected="false">
                  <button type="button" onClick={() => pickSearchResult(result)} className="block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-teal-50">
                    {result.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <input required={required} className="input-field w-full" placeholder="House/Unit No. & Street" value={value.street} onChange={setStreet} maxLength={200} />
      <div className="grid gap-2 sm:grid-cols-3">
        <SearchableSelect
          required={required}
          value={value.province}
          options={provinces}
          onSelect={selectProvince}
          placeholder="Province"
        />
        <SearchableSelect
          required={required}
          value={value.city}
          options={cities}
          onSelect={selectCity}
          placeholder={value.provinceCode ? 'City / Municipality' : 'Select province first'}
          disabled={!value.provinceCode}
          loading={citiesLoading}
        />
        <SearchableSelect
          required={required}
          value={value.barangay}
          options={barangays}
          onSelect={selectBarangay}
          placeholder={value.cityCode ? 'Barangay' : 'Select city first'}
          disabled={!value.cityCode}
          loading={barangaysLoading}
        />
      </div>
      <input className="input-field w-full sm:w-1/3" placeholder="Postal Code" value={value.postalCode} onChange={setPostalCode} maxLength={10} />
      {withCoordinates && (
        <div className="rounded-xl border border-black/[0.06] bg-black/[0.015] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink/55">
              {value.latitude != null ? (
                <span className="flex items-center gap-1 text-teal-700"><MapPin size={13} /> Pinned at {Number(value.latitude).toFixed(6)}, {Number(value.longitude).toFixed(6)}</span>
              ) : (
                <span className="flex items-center gap-1 text-ink/45"><MapPinOff size={13} /> No exact location pinned yet</span>
              )}
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={useCurrentLocation} disabled={locating} className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 hover:text-teal-800 disabled:opacity-50">
                {locating ? <Loader2 size={13} className="animate-spin" /> : <Crosshair size={13} />} Use my current location
              </button>
              <button type="button" onClick={() => setShowMap((v) => !v)} className="text-xs font-semibold text-teal-700 hover:text-teal-800">
                {showMap ? 'Hide map' : value.latitude != null ? 'Adjust on map' : 'Pin on map'}
              </button>
              {value.latitude != null && <button type="button" onClick={clearMapLocation} className="text-xs font-semibold text-ink/40 hover:text-ink/60">Clear</button>}
            </div>
          </div>
          {showMap && (
            <div className="mt-3">
              <Suspense fallback={<div className="flex h-[260px] items-center justify-center rounded-xl border border-black/10 bg-surface"><Loader2 size={20} className="animate-spin text-ink/30" /></div>}>
                <LocationPickerMap latitude={value.latitude} longitude={value.longitude} onPick={pickMapLocation} />
              </Suspense>
              <p className="mt-1.5 text-[11px] text-ink/40">Tap or drag the pin to your exact location.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
