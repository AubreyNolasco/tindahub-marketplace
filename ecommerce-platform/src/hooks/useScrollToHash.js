import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

export default function useScrollToHash() {
  const location = useLocation()

  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.slice(1)

    // The target page can still be loading content asynchronously (e.g.
    // homepage sections fed by a Supabase fetch), which shifts layout after
    // mount. A single scroll shortly after mount can land on a position
    // that's correct at that instant but wrong once the page finishes
    // growing — so re-scroll for a short window until the position settles.
    let attempts = 0
    let timer
    const scrollToTarget = () => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      attempts += 1
      if (attempts < 8) timer = window.setTimeout(scrollToTarget, 150)
    }
    timer = window.setTimeout(scrollToTarget, 100)
    return () => window.clearTimeout(timer)
  }, [location.hash])
}
