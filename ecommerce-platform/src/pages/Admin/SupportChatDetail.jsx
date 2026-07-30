import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Phone, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import SupportChatThread from '../../components/support/SupportChatThread'
import Spinner from '../../components/ui/Spinner'

export default function SupportChatDetail() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('full_name, phone, role, merchant_profiles!merchant_profiles_id_fkey(business_name)')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error(error.message)
        setProfile(data)
        setLoading(false)
      })
  }, [userId])

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  const displayName = profile?.merchant_profiles?.business_name || profile?.full_name || 'Account'

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="card mb-4 p-4">
        <p className="font-display font-bold text-lg text-ink capitalize">{displayName} <span className="badge ml-1 bg-teal-100 text-teal-700 capitalize">{profile?.role}</span></p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink/65">
          <span className="flex items-center gap-1.5"><User size={14} className="text-ink/40" /> {profile?.full_name || '—'}</span>
          <span className="flex items-center gap-1.5"><Phone size={14} className="text-ink/40" /> {profile?.phone || '—'}</span>
        </div>
      </div>
      <SupportChatThread
        threadUserId={userId}
        title={displayName}
        subtitle={`${profile?.full_name || ''} · ${profile?.phone || 'No contact number'}`}
        onBack={() => navigate('/admin/support-chats')}
      />
    </div>
  )
}
