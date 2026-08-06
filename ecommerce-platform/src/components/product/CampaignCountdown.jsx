import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'

// Phase 8 (TASK6.md): shared countdown used on the campaign banner
// (ProductDetail) and anywhere else a campaign's remaining time needs
// showing. Ticks every minute -- a campaign countdown doesn't need
// second-level precision, and this avoids re-rendering every product
// card once a second.
function timeLeft(endsAt) {
  const diff = new Date(endsAt).getTime() - Date.now()
  if (diff <= 0) return null
  const days = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  if (days > 0) return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h ${minutes}m left`
  return `${minutes}m left`
}

export default function CampaignCountdown({ endsAt, className = '' }) {
  const [label, setLabel] = useState(() => timeLeft(endsAt))

  useEffect(() => {
    setLabel(timeLeft(endsAt))
    const id = setInterval(() => setLabel(timeLeft(endsAt)), 60000)
    return () => clearInterval(id)
  }, [endsAt])

  if (!label) return null
  return <span className={`inline-flex items-center gap-1 font-semibold ${className}`}><Timer size={13} />{label}</span>
}
