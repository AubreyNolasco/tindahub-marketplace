import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'

export default function DemoModeBanner() {
  const { profile, refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()

  if (!profile?.previous_role) return null

  const backToAdmin = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('switch_back_to_admin')
    setBusy(false)
    if (error) return toast.error(error.message)
    await refreshProfile()
    toast.success('Back to Admin.')
    navigate('/admin', { replace: true })
  }

  return (
    <div className="sticky top-16 z-40 flex items-center justify-center gap-3 bg-mango-500 px-4 py-2 text-sm font-semibold text-white shadow-md">
      <ShieldAlert size={16} />
      You're in {profile.role} Mode (Admin demo)
      <button
        onClick={backToAdmin}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-1 text-xs font-bold hover:bg-white/30 disabled:opacity-50"
      >
        {busy && <Loader2 size={12} className="animate-spin" />}
        Back to Admin
      </button>
    </div>
  )
}
