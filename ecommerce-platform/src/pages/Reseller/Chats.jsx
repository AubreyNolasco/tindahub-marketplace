import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

export default function Chats() {
  const { user } = useAuth()
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*, merchant_profiles(business_name)')
      .eq('reseller_id', user.id)
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)

    const grouped = {}
    for (const m of data || []) {
      if (!grouped[m.merchant_id]) {
        grouped[m.merchant_id] = {
          merchantId: m.merchant_id,
          businessName: m.merchant_profiles?.business_name || 'Merchant',
          lastMessage: m.message,
          unread: 0
        }
      }
      if (m.sender_id !== user.id && !m.is_read) {
        grouped[m.merchant_id].unread += 1
      }
    }
    setThreads(Object.values(grouped))
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  const filtered = threads.filter((t) => t.businessName.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-6">Chats</h1>

      {threads.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" size={18} />
          <input
            className="input-field pl-10"
            placeholder="Maghanap by store name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {threads.length === 0 ? (
        <EmptyState icon={MessageCircle} title="No chats yet" message="Message a merchant from their store page." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No results found" message="Try another store name." />
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <Link
              key={t.merchantId}
              to={`/reseller/chats/${t.merchantId}`}
              className="card p-4 flex items-center justify-between gap-3 hover:shadow-soft transition-shadow"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink truncate">{t.businessName}</p>
                <p className="text-sm text-ink/60 truncate">{t.lastMessage}</p>
              </div>
              {t.unread > 0 && (
                <span className="bg-coral-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                  {t.unread}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
