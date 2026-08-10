import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'jomhub-theme'
const THEME_EVENT = 'jomhub:theme-change'

function getInitialTheme() {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try { localStorage.setItem(STORAGE_KEY, theme) } catch { /* restricted storage */ }
    window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: theme }))
  }, [theme])

  useEffect(() => {
    const syncTheme = (event) => {
      const nextTheme = event.detail
      if ((nextTheme === 'light' || nextTheme === 'dark') && nextTheme !== theme) setTheme(nextTheme)
    }
    const syncStoredTheme = (event) => {
      if (event.key !== STORAGE_KEY) return
      if (event.newValue === 'light' || event.newValue === 'dark') setTheme(event.newValue)
    }
    window.addEventListener(THEME_EVENT, syncTheme)
    window.addEventListener('storage', syncStoredTheme)
    return () => {
      window.removeEventListener(THEME_EVENT, syncTheme)
      window.removeEventListener('storage', syncStoredTheme)
    }
  }, [theme])

  const toggleTheme = useCallback(() => setTheme((current) => current === 'dark' ? 'light' : 'dark'), [])

  return { theme, toggleTheme }
}
