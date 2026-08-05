import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'

// A <select> with a search box, for lists too long to scan (barangays,
// cities). Options are already loaded in memory (province/city/barangay
// lists top out at a few hundred rows even for the biggest cities), so
// filtering is instant, client-side, no per-keystroke request.

export default function SearchableSelect({ value, options, onSelect, placeholder, disabled = false, loading = false, required = false }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    const onClickAway = (event) => { if (wrapperRef.current && !wrapperRef.current.contains(event.target)) { setOpen(false); setQuery('') } }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options
    return matches.slice(0, 200)
  }, [options, query])

  const selected = options.find((o) => o.name === value)

  return (
    <div ref={wrapperRef} className="relative">
      <input
        type="text"
        required={required && !value}
        disabled={disabled}
        value={open ? query : (value || '')}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => { if (!disabled) { setQuery(''); setOpen(true) } }}
        placeholder={disabled ? placeholder : (loading ? 'Loading…' : `Search ${placeholder?.toLowerCase() || ''}`)}
        className="input-field pr-8 disabled:cursor-not-allowed disabled:bg-black/[.03] disabled:text-ink/35"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {loading ? (
        <Loader2 size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-ink/35" />
      ) : (
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/35" />
      )}
      {open && !disabled && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-black/10 bg-surface py-1 shadow-lg">
          {filtered.length === 0 && <li className="px-3 py-2 text-sm text-ink/40">No matches.</li>}
          {filtered.map((option) => (
            <li key={option.code} role="option" aria-selected={option.name === value}>
              <button
                type="button"
                onClick={() => { onSelect(option); setOpen(false); setQuery('') }}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-teal-50 ${option.name === selected?.name ? 'bg-teal-50 font-semibold text-teal-800' : 'text-ink/80'}`}
              >
                {option.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
