import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'jomhub-theme'

// public/theme-init.js already set the .dark class on <html> before first
// paint (avoiding a flash) — read that as the initial state instead of
// recomputing the system-preference check here.
function getInitialTheme() {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* private mode etc — non-fatal */ }
  }, [theme])

  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])

  return { theme, toggleTheme }
}
