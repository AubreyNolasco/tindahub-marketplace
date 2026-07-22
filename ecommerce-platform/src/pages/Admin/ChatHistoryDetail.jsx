import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import ChatThread from '../../components/chat/ChatThread'
import Spinner from '../../components/ui/Spinner'

export default function ChatHistoryDetail() {
  const { merchantId, resellerId } = useParams()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('merchant_profiles').select('business_name').eq('id', merchantId).maybeSingle(),
      supabase.from('profiles').select('full_name').eq('id', resellerId).maybeSingle()
    ]).then(([m, r]) => {
      if (m.error) toast.error(m.error.message)
      if (r.error) toast.error(r.error.message)
      setTitle(`${m.data?.business_name || 'Merchant'} ↔ ${r.data?.full_name || 'Reseller'}`)
      setLoading(false)
    })
  }, [merchantId, resellerId])

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <ChatThread
        merchantId={merchantId}
        resellerId={resellerId}
        title={title}
        subtitle="Read-only — admin monitoring"
        onBack={() => navigate('/admin/chats')}
        readOnly
      />
    </div>
  )
}
