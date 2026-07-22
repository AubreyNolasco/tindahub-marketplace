import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ChatThread from '../../components/chat/ChatThread'
import Spinner from '../../components/ui/Spinner'

export default function ChatDetail() {
  const { merchantId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [merchant, setMerchant] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('merchant_profiles')
      .select('business_name')
      .eq('id', merchantId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error(error.message)
        setMerchant(data)
        setLoading(false)
      })
  }, [merchantId])

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <ChatThread
        merchantId={merchantId}
        resellerId={user.id}
        title={merchant?.business_name || 'Merchant'}
        onBack={() => navigate('/reseller/chats')}
      />
    </div>
  )
}
