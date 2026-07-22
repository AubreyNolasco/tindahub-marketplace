import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import ChatThread from '../../components/chat/ChatThread'
import Spinner from '../../components/ui/Spinner'

export default function ChatDetail() {
  const { resellerId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [reseller, setReseller] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', resellerId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error(error.message)
        setReseller(data)
        setLoading(false)
      })
  }, [resellerId])

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <ChatThread
        merchantId={user.id}
        resellerId={resellerId}
        title={reseller?.full_name || 'Reseller'}
        onBack={() => navigate('/merchant/chats')}
      />
    </div>
  )
}
