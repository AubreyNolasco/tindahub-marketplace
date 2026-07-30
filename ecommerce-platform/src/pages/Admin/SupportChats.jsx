import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LifeBuoy, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

export default function SupportChats() {
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('support_messages')
      .select('*, profiles!support_messages_user_id_fkey(full_name, phone, role, merchant_profiles!merchant_profiles_id_fkey(business_name))')
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)

    const grouped = {}
    for (const m of data || []) {
      const key = m.user_id
      if (!grouped[key]) {
        grouped[key] = {
          userId: m.user_id,
          fullName: m.profiles?.full_name || 'Account',
          phone: m.profiles?.phone || '—',
          role: m.profiles?.role,
          businessName: m.profiles?.merchant_profiles?.business_name || null,
          lastMessage: m.message,
          lastAt: m.created_at,
          count: 0,
          unread: 0
        }
      }
      grouped[key].count += 1
      if (!m.is_read && m.sender_role !== 'admin' && m.sender_role !== 'staff') grouped[key].unread += 1
    }
    setThreads(Object.values(grouped))
    setLoading(false)
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  const filtered = threads.filter((t) =>
    t.fullName.toLowerCase().includes(search.toLowerCase()) || (t.businessName || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-1">Support Chats</h1>
      <p className="text-sm text-ink/50 mb-6">Direct messages with Merchants and Resellers.</p>

      {threads.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" size={18} />
          <input
            className="input-field pl-10"
            placeholder="Search by name or business..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {threads.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No support messages yet" message="Merchant and Reseller messages to Admin will appear here." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No results found" message="Try another name." />
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <Link
              key={t.userId}
              to={`/admin/support/${t.userId}`}
              className="card p-4 flex items-center justify-between gap-3 flex-wrap hover:shadow-soft transition-shadow"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink truncate">
                  {t.businessName || t.fullName} <span className="badge ml-2 bg-teal-100 text-teal-700 capitalize">{t.role}</span>
                </p>
                <p className="text-xs text-ink/45 mt-0.5">{t.fullName} · {t.phone}</p>
                <p className="text-sm text-ink/60 truncate mt-1">{t.lastMessage}</p>
                <p className="text-xs text-ink/40 mt-0.5">{formatDate(t.lastAt)}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                {t.unread > 0 && <span className="badge bg-coral-100 text-coral-600">{t.unread} unread</span>}
                <span className="badge bg-teal-50 text-teal-700">{t.count} messages</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
