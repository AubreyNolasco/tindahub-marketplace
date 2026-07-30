import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function useScrollToHash() {
  const location = useLocation()

  useEffect(() => {
    if (!location.hash) return
    const timer = window.setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    return () => window.clearTimeout(timer)
  }, [location.hash])
}
