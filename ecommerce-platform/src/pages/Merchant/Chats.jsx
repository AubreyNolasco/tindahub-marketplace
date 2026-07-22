import { useEffect, useState } from 'react'
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

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*, profiles!chat_messages_reseller_id_fkey(full_name)')
      .eq('merchant_id', user.id)
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)

    const grouped = {}
    for (const m of data || []) {
      if (!grouped[m.reseller_id]) {
        grouped[m.reseller_id] = {
          resellerId: m.reseller_id,
          fullName: m.profiles?.full_name || 'Reseller',
          lastMessage: m.message,
          unread: 0
        }
      }
      if (m.sender_id !== user.id && !m.is_read) {
        grouped[m.reseller_id].unread += 1
      }
    }
    setThreads(Object.values(grouped))
    setLoading(false)
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  const filtered = threads.filter((t) => t.fullName.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-6">Mga Usapan</h1>

      {threads.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" size={18} />
          <input
            className="input-field pl-10"
            placeholder="Maghanap by reseller name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {threads.length === 0 ? (
        <EmptyState icon={MessageCircle} title="Wala pang usapan" message="Lalabas dito ang mga reseller na nag-message sa iyo." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Walang nahanap" message="Subukan ang ibang pangalan." />
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <Link
              key={t.resellerId}
              to={`/merchant/chats/${t.resellerId}`}
              className="card p-4 flex items-center justify-between gap-3 hover:shadow-soft transition-shadow"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink truncate">{t.fullName}</p>
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
