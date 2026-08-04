// Sets the .dark class before first paint so there's no flash of the wrong
// theme. Loaded as a plain external script (not inline) because the app's
// CSP has no 'unsafe-inline' for script-src.
(function () {
  try {
    var stored = localStorage.getItem('jomhub-theme')
    var dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', dark)
  } catch (_e) { /* localStorage may be unavailable, e.g. private browsing */ }
})()
