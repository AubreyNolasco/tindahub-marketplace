import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Crosshair, Loader2, MapPin, MapPinOff, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { isLocationIqConfigured, searchAddress } from '../../lib/locationiq'
import { geocodeOpenStreetMap, reverseOpenStreetMap } from '../../lib/openstreetmap'
import { isMapsEnabled } from '../../lib/services/maps'
import { listCities, listProvinces, listBarangays, resolveGeocodedPsgc } from '../../lib/services/psgc'
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
  const searchAbortRef = useRef(null)
  const geocodeAbortRef = useRef(null)
  const reverseAbortRef = useRef(null)
  const automaticGeocodeRef = useRef(null)
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  valueRef.current = value
  onChangeRef.current = onChange
  const [geocoding, setGeocoding] = useState(false)

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
      searchAbortRef.current?.abort()
      const controller = new AbortController()
      searchAbortRef.current = controller
      setSearching(true)
      searchAddress(searchQuery, controller.signal)
        .then((results) => { setSuggestions(results); setOpen(true) })
        .catch((error) => { if (error.name !== 'AbortError') setSuggestions([]) })
        .finally(() => { if (searchAbortRef.current === controller) setSearching(false) })
    }, 350)
    return () => clearTimeout(timer)
  }, [searchQuery, locationIqAvailable])

  useEffect(() => {
    if (!withCoordinates) return
    const query = [value.street, value.barangay, value.city, value.province, value.postalCode].filter(Boolean).join(', ')
    if (!value.street?.trim() || !value.city?.trim() || !value.province?.trim()) return
    if (automaticGeocodeRef.current === query) return
    // Pages like ProfileAddress.jsx mount this with empty fields and fill
    // in the real saved address (pin included) once the profile loads
    // asynchronously — so the very first time this effect ever sees a
    // non-empty address, it may already have a real, user-confirmed pin
    // that has nothing to do with a fresh edit. Adopt that pin as already
    // pinned instead of re-geocoding and silently overwriting it; only
    // genuine edits after this point (which change the composed query)
    // should trigger a new auto-geocode.
    if (automaticGeocodeRef.current === null && value.latitude != null) {
      automaticGeocodeRef.current = query
      return
    }
    const timer = setTimeout(() => {
      const controller = new AbortController()
      geocodeAbortRef.current?.abort()
      geocodeAbortRef.current = controller
      setGeocoding(true)
      geocodeOpenStreetMap(query, controller.signal).then((result) => {
        if (!result || result.latitude == null || result.longitude == null) return
        automaticGeocodeRef.current = query
        onChangeRef.current({ ...valueRef.current, latitude: result.latitude, longitude: result.longitude })
      }).catch((error) => { if (error.name !== 'AbortError') console.error('Address geocoding failed:', error) })
        .finally(() => { if (geocodeAbortRef.current === controller) setGeocoding(false) })
    }, 1200)
    return () => clearTimeout(timer)
    // value.latitude is read (the already-pinned bail-out above) but
    // deliberately included as a dependency rather than closed over stale:
    // when latitude changes on its own (map drag/pick, no text edit), this
    // re-runs, recomputes the same query, and the automaticGeocodeRef
    // match immediately short-circuits it -- pickMapLocation always seeds
    // the ref before its own onChange, so this can't loop or re-fetch.
  }, [value.street, value.barangay, value.city, value.province, value.postalCode, value.latitude, withCoordinates])

  useEffect(() => () => {
    searchAbortRef.current?.abort()
    geocodeAbortRef.current?.abort()
    reverseAbortRef.current?.abort()
  }, [])

  useEffect(() => {
    const onClickAway = (event) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [])

  const pickSearchResult = (result) => {
    const next = { ...value, street: result.street, ...(withCoordinates ? { latitude: result.latitude, longitude: result.longitude } : {}) }
    if (withCoordinates) automaticGeocodeRef.current = [next.street, next.barangay, next.city, next.province, next.postalCode].filter(Boolean).join(', ')
    onChange(next)
    setSearchQuery('')
    setSuggestions([])
    setOpen(false)
  }

  // A manual address edit invalidates the previous coordinates first.
  // The debounced effect above then resolves a fresh pin. This prevents
  // a newly saved Cebu address, for example, from retaining coordinates
  // from the user's previous Manila address while geocoding is pending.
  const addressEdit = (changes) => {
    geocodeAbortRef.current?.abort()
    automaticGeocodeRef.current = null
    onChange({ ...value, ...changes, ...(withCoordinates ? { latitude: null, longitude: null } : {}) })
  }
  const setStreet = (event) => addressEdit({ street: event.target.value })
  const setPostalCode = (event) => addressEdit({ postalCode: event.target.value })

  const selectProvince = (option) => addressEdit({ province: option.name, provinceCode: option.code, city: '', cityCode: null, barangay: '' })
  const selectCity = (option) => addressEdit({ city: option.name, cityCode: option.code, barangay: '' })
  const selectBarangay = (option) => addressEdit({ barangay: option.name })

  const pickMapLocation = async (lat, lng) => {
    geocodeAbortRef.current?.abort()
    automaticGeocodeRef.current = [valueRef.current.street, valueRef.current.barangay, valueRef.current.city, valueRef.current.province, valueRef.current.postalCode].filter(Boolean).join(', ')
    onChange({ ...valueRef.current, latitude: lat, longitude: lng })
    const controller = new AbortController()
    reverseAbortRef.current?.abort()
    reverseAbortRef.current = controller
    try {
      const result = await reverseOpenStreetMap(lat, lng, controller.signal)
      if (!result) return
      const psgc = await resolveGeocodedPsgc(result)
      const next = { ...valueRef.current, street: result.street || valueRef.current.street, postalCode: result.postalCode || valueRef.current.postalCode, ...psgc, latitude: lat, longitude: lng }
      automaticGeocodeRef.current = [next.street, next.barangay, next.city, next.province, next.postalCode].filter(Boolean).join(', ')
      onChange(next)
    } catch (error) {
      if (error.name !== 'AbortError') toast.error('The pin was saved, but its address could not be filled automatically.')
    }
  }
  const clearMapLocation = () => onChange({ ...value, latitude: null, longitude: null })

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return toast.error('Your browser does not support location access.')
    setLocating(true)
    setShowMap(true)
    navigator.geolocation.getCurrentPosition(
      (position) => { pickMapLocation(position.coords.latitude, position.coords.longitude); setLocating(false) },
      (error) => {
        setLocating(false)
        toast.error(error.code === error.PERMISSION_DENIED
          ? 'Location access was denied. Allow it in your browser settings, or drag the pin manually.'
          : 'Could not get your current location. You can still drag the pin manually.')
      },
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
              {geocoding ? (
                <span className="flex items-center gap-1 text-teal-700"><Loader2 size={13} className="animate-spin" /> Updating pin from address…</span>
              ) : value.latitude != null && value.longitude != null ? (
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
