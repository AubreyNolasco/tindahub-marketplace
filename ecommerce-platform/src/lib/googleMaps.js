// Lazy-loads the Google Maps JS API (Places library only) once, and only
// when a form actually needs the autocomplete search box — never on
// pages that don't render an AddressFields component. VITE_GOOGLE_MAPS_API_KEY
// is a public build-time key by design (Google restricts it by HTTP
// referrer in Cloud Console, not by secrecy), so there is nothing to
// fetch from Vault the way PayMongo/Vision/Semaphore's server-side keys are.

let loadPromise = null

export function isGoogleMapsConfigured() {
  return Boolean(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)
}

export function loadGoogleMaps() {
  if (loadPromise) return loadPromise
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (!apiKey) return Promise.reject(new Error('VITE_GOOGLE_MAPS_API_KEY is not set'))

  if (window.google?.maps?.places) return (loadPromise = Promise.resolve(window.google.maps))

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('google-maps-script')
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google.maps))
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps script')))
      return
    }
    const script = document.createElement('script')
    script.id = 'google-maps-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google.maps)
    script.onerror = () => reject(new Error('Failed to load Google Maps script'))
    document.head.appendChild(script)
  })
  return loadPromise
}
