import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Crosshair, Loader2, MapPin, MapPinOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { listCities, listProvinces, listBarangays } from '../../lib/services/psgc'
import SearchableSelect from './SearchableSelect'

// Leaflet + its CSS is ~55KB — don't pay for it until a Suspense boundary
// that actually needs the map is opened.
const LocationPickerMap = lazy(() => import('./LocationPickerMap'))

// Split address fill-up used everywhere in the system. Province, City,
// and Barangay are picked from the official PSGC list (cascading — the
// City list only shows cities in the chosen province, Barangay only
// shows barangays in the chosen city), so there's no way to end up with
// a barangay that doesn't actually belong to the selected city. Street
// and Postal Code stay free text (PSGC doesn't cover street level).
//
// There is no geocoding provider anywhere in this form — no
// autocomplete search box, no address-to-pin or pin-to-address lookup.
// The customer picks PSGC + types street, then places the map pin
// themselves. This is a deliberate choice (no external API, no key, no
// hosting) over an earlier LocationIQ/Nominatim-based design: every
// stored coordinate is one the customer placed directly, so there's
// nothing to distinguish "geocoded guess" from "confirmed pin" — there
// is only ever the latter.

export default function AddressFields({ value, onChange, required = false, withCoordinates = false }) {
  const [showMap, setShowMap] = useState(false)
  const [locating, setLocating] = useState(false)
  const valueRef = useRef(value)
  valueRef.current = value

  const [provinces, setProvinces] = useState([])
  const [cities, setCities] = useState([])
  const [barangays, setBarangays] = useState([])
  const [citiesLoading, setCitiesLoading] = useState(false)
  const [barangaysLoading, setBarangaysLoading] = useState(false)

  useEffect(() => {
    let active = true
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

  // A manual address edit invalidates the previous pin — an edited
  // street/barangay/city no longer necessarily matches where the pin was
  // placed, so the customer is prompted to re-confirm it on the map
  // rather than silently keeping a possibly-stale location.
  const addressEdit = (changes) => {
    onChange({ ...value, ...changes, ...(withCoordinates ? { latitude: null, longitude: null } : {}) })
  }
  const setStreet = (event) => addressEdit({ street: event.target.value })
  const setPostalCode = (event) => addressEdit({ postalCode: event.target.value })

  const selectProvince = (option) => addressEdit({ province: option.name, provinceCode: option.code, city: '', cityCode: null, barangay: '', barangayCode: null })
  const selectCity = (option) => addressEdit({ city: option.name, cityCode: option.code, barangay: '', barangayCode: null })
  const selectBarangay = (option) => addressEdit({ barangay: option.name, barangayCode: option.code })

  const pickMapLocation = (lat, lng) => onChange({ ...valueRef.current, latitude: lat, longitude: lng })
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
              {value.latitude != null && value.longitude != null ? (
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
              <Suspense fallback={<div className="flex h-[297px] items-center justify-center rounded-xl border border-black/10 bg-surface"><Loader2 size={20} className="animate-spin text-ink/30" /></div>}>
                <LocationPickerMap latitude={value.latitude} longitude={value.longitude} onPick={pickMapLocation} />
              </Suspense>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
