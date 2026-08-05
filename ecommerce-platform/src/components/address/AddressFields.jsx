import { useEffect, useRef, useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { isLocationIqConfigured, searchAddress } from '../../lib/locationiq'
import { isMapsEnabled } from '../../lib/services/maps'

// Split address fill-up used everywhere in the system (reseller/merchant
// profile address, saved customers, checkout shipping address). Works
// standalone (5 plain inputs) with or without LocationIQ — the search
// box on top only appears once an admin has enabled maps.locationiq in
// Settings -> Integrations AND VITE_LOCATIONIQ_API_KEY is deployed;
// picking a suggestion there fills every field below (plus
// latitude/longitude, when the caller wants them) in one step. Nothing
// about the manual fields changes if the search box never loads.

export default function AddressFields({ value, onChange, required = false, withCoordinates = false }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const [available, setAvailable] = useState(false)
  const wrapperRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    let active = true
    isMapsEnabled()
      .then((enabled) => { if (active) setAvailable(enabled && isLocationIqConfigured()) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!available || searchQuery.trim().length < 3) { setSuggestions([]); return }
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
  }, [searchQuery, available])

  useEffect(() => {
    const onClickAway = (event) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [])

  const pick = (result) => {
    const { street, barangay, city, province, postalCode, latitude, longitude } = result
    const parts = { street, barangay, city, province, postalCode, ...(withCoordinates ? { latitude, longitude } : {}) }
    onChange({ ...value, ...parts })
    setSearchQuery('')
    setSuggestions([])
    setOpen(false)
  }

  const setField = (field) => (event) => {
    const next = { ...value, [field]: event.target.value }
    // A manual edit after picking a suggestion means the pinned
    // coordinates may no longer match what's actually typed — clear
    // rather than keep a stale pin silently attached to a changed address.
    if (withCoordinates && value.latitude != null) { next.latitude = null; next.longitude = null }
    onChange(next)
  }

  return (
    <div className="space-y-2">
      {available && (
        <div ref={wrapperRef} className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Search your address…"
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
                  <button type="button" onClick={() => pick(result)} className="block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-teal-50">
                    {result.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <input required={required} className="input-field sm:col-span-2" placeholder="House/Unit No. & Street" value={value.street} onChange={setField('street')} maxLength={200} />
        <input required={required} className="input-field" placeholder="Barangay" value={value.barangay} onChange={setField('barangay')} maxLength={120} />
        <input required={required} className="input-field" placeholder="City / Municipality" value={value.city} onChange={setField('city')} maxLength={120} />
        <input required={required} className="input-field" placeholder="Province" value={value.province} onChange={setField('province')} maxLength={120} />
        <input className="input-field" placeholder="Postal Code" value={value.postalCode} onChange={setField('postalCode')} maxLength={10} />
      </div>
      {withCoordinates && value.latitude != null && (
        <p className="flex items-center gap-1 text-[11px] font-medium text-teal-700"><MapPin size={11} /> Location pinned from search</p>
      )}
    </div>
  )
}
