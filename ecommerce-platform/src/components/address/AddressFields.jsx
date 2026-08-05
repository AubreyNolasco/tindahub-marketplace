import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { isLocationIqConfigured, searchAddress } from '../../lib/locationiq'
import { isMapsEnabled } from '../../lib/services/maps'
import { listCities, listProvinces, listBarangays } from '../../lib/services/psgc'
import SearchableSelect from './SearchableSelect'

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

  const setStreet = (event) => {
    const next = { ...value, street: event.target.value }
    if (withCoordinates && value.latitude != null) { next.latitude = null; next.longitude = null }
    onChange(next)
  }
  const setPostalCode = (event) => onChange({ ...value, postalCode: event.target.value })

  const selectProvince = (option) => onChange({ ...value, province: option.name, provinceCode: option.code, city: '', cityCode: null, barangay: '' })
  const selectCity = (option) => onChange({ ...value, city: option.name, cityCode: option.code, barangay: '' })
  const selectBarangay = (option) => onChange({ ...value, barangay: option.name })

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
      {withCoordinates && value.latitude != null && (
        <p className="flex items-center gap-1 text-[11px] font-medium text-teal-700"><MapPin size={11} /> Location pinned from search</p>
      )}
    </div>
  )
}
