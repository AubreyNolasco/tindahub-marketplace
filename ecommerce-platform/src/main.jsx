import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/system/ErrorBoundary'
import './index.css'

// A lazy-loaded route chunk fails to fetch when a tab has an older build
// in memory and a newer deployment has since replaced that file (a new
// content hash) -- Vite fires this event instead of letting the raw
// fetch error surface as a confusing ErrorBoundary crash. Reload once to
// pick up the current build; the sessionStorage guard stops a reload
// loop if the failure turns out to be something else (e.g. a real
// network outage), and clears after a normal load so a *later* stale
// build in this same tab can still auto-recover once more.
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem('jomhub-chunk-reload')) return
  sessionStorage.setItem('jomhub-chunk-reload', '1')
  window.location.reload()
})
window.setTimeout(() => sessionStorage.removeItem('jomhub-chunk-reload'), 10000)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><ErrorBoundary><App /></ErrorBoundary></React.StrictMode>
)
