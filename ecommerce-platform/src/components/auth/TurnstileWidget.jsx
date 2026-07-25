import { useEffect, useRef } from 'react'

const SCRIPT_ID = 'cloudflare-turnstile-script'

export default function TurnstileWidget({ siteKey, onToken }) {
  const container = useRef(null)

  useEffect(() => {
    if (!siteKey || !container.current) return undefined
    let widgetId
    let cancelled = false
    const render = () => {
      if (cancelled || !container.current || !window.turnstile) return
      widgetId = window.turnstile.render(container.current, {
        sitekey: siteKey,
        callback: (token) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
        theme: 'light'
      })
    }
    const existing = document.getElementById(SCRIPT_ID)
    if (window.turnstile) render()
    else if (existing) existing.addEventListener('load', render, { once: true })
    else {
      const script = document.createElement('script')
      script.id = SCRIPT_ID
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.addEventListener('load', render, { once: true })
      document.head.appendChild(script)
    }
    return () => {
      cancelled = true
      if (widgetId !== undefined && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [onToken, siteKey])

  if (!siteKey) return null
  return <div ref={container} className="flex min-h-[65px] justify-center" />
}
