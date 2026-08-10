// Sets the .dark class before first paint so there's no flash of the wrong
// theme. Loaded as a plain external script (not inline) because the app's
// CSP has no 'unsafe-inline' for script-src.
(function () {
  try {
    var stored = localStorage.getItem('jomhub-theme')
    // JOM HUB's marketplace identity is dark emerald by default. A stored
    // preference always wins, so light mode remains a first-class option.
    var dark = stored ? stored === 'dark' : true
    document.documentElement.classList.toggle('dark', dark)
  } catch (_e) { /* localStorage may be unavailable, e.g. private browsing */ }
})()
