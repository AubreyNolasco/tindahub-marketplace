import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

export default function ChatHistory() {
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*, merchant_profiles(business_name), profiles!chat_messages_reseller_id_fkey(full_name)')
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)

    const grouped = {}
    for (const m of data || []) {
      const key = `${m.merchant_id}:${m.reseller_id}`
      if (!grouped[key]) {
        grouped[key] = {
          merchantId: m.merchant_id,
          resellerId: m.reseller_id,
          businessName: m.merchant_profiles?.business_name || 'Merchant',
          fullName: m.profiles?.full_name || 'Reseller',
          lastMessage: m.message,
          lastAt: m.created_at,
          count: 0
        }
      }
      grouped[key].count += 1
    }
    setThreads(Object.values(grouped))
    setLoading(false)
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  const filtered = threads.filter((t) => t.businessName.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-6">Chat History</h1>

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
        <EmptyState icon={MessageCircle} title="No chats yet" message="All merchant and reseller conversations will appear here." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No results found" message="Try another store name." />
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <Link
              key={`${t.merchantId}:${t.resellerId}`}
              to={`/admin/chats/${t.merchantId}/${t.resellerId}`}
              className="card p-4 flex items-center justify-between gap-3 flex-wrap hover:shadow-soft transition-shadow"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink truncate">
                  {t.businessName} <span className="text-ink/40 font-normal">↔</span> {t.fullName}
                </p>
                <p className="text-sm text-ink/60 truncate">{t.lastMessage}</p>
                <p className="text-xs text-ink/40 mt-0.5">{formatDate(t.lastAt)}</p>
              </div>
              <span className="badge bg-teal-100 text-teal-700 flex-shrink-0">{t.count} mensahe</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
