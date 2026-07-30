import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LifeBuoy, Phone, Search, User, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../utils/format'
import SupportChatThread from '../../components/support/SupportChatThread'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

export default function SupportChats() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: profiles, error: profileError }, { data: threadRows, error: threadError }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, phone, role, merchant_profiles!merchant_profiles_id_fkey(business_name)')
        .in('role', ['merchant', 'reseller'])
        .order('full_name'),
      supabase.from('support_messages').select('user_id, message, created_at, is_read, sender_role').order('created_at', { ascending: false })
    ])
    if (profileError) toast.error(profileError.message)
    if (threadError) toast.error(threadError.message)

    const threads = {}
    for (const m of threadRows || []) {
      if (!threads[m.user_id]) threads[m.user_id] = { lastMessage: m.message, lastAt: m.created_at, unread: 0 }
      if (!m.is_read && m.sender_role !== 'admin' && m.sender_role !== 'staff') threads[m.user_id].unread += 1
    }

    const merged = (profiles || []).map((p) => ({
      userId: p.id,
      fullName: p.full_name || 'Account',
      phone: p.phone || '—',
      role: p.role,
      businessName: p.merchant_profiles?.business_name || null,
      lastMessage: threads[p.id]?.lastMessage || null,
      lastAt: threads[p.id]?.lastAt || null,
      unread: threads[p.id]?.unread || 0
    })).sort((a, b) => {
      if (a.unread !== b.unread) return b.unread - a.unread
      if (a.lastAt && b.lastAt) return new Date(b.lastAt) - new Date(a.lastAt)
      if (a.lastAt) return -1
      if (b.lastAt) return 1
      return a.fullName.localeCompare(b.fullName)
    })

    setPeople(merged)
    setLoading(false)
  }

  const openChat = (person) => navigate(`/admin/support/${person.userId}`)
  const closeChat = () => navigate('/admin/support-chats')

  const selected = people.find((p) => p.userId === userId)

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  const filtered = people.filter((p) =>
    p.fullName.toLowerCase().includes(search.toLowerCase()) || (p.businessName || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-1">Support Chats</h1>
      <p className="text-sm text-ink/50 mb-6">Message any Merchant or Reseller directly.</p>

      {people.length > 0 && (
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

      {people.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No Merchants or Resellers yet" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="No results found" message="Try another name." />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <button
              key={p.userId}
              type="button"
              onClick={() => openChat(p)}
              className="card w-full p-4 flex items-center justify-between gap-3 flex-wrap text-left hover:shadow-soft transition-shadow"
            >
              <div className="min-w-0">
                <p className="font-semibold text-ink truncate">
                  {p.businessName || p.fullName} <span className="badge ml-2 bg-teal-100 text-teal-700 capitalize">{p.role}</span>
                </p>
                <p className="text-xs text-ink/45 mt-0.5">{p.fullName} · {p.phone}</p>
                <p className="text-sm text-ink/60 truncate mt-1">{p.lastMessage || 'No messages yet — start the conversation.'}</p>
                {p.lastAt && <p className="text-xs text-ink/40 mt-0.5">{formatDate(p.lastAt)}</p>}
              </div>
              {p.unread > 0 && <span className="badge bg-coral-100 text-coral-600 flex-shrink-0">{p.unread} unread</span>}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-scrim/60 p-4">
          <div className="w-full max-w-lg">
            <div className="card mb-3 flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-display font-bold text-lg text-ink truncate">
                  {selected.businessName || selected.fullName} <span className="badge ml-1 bg-teal-100 text-teal-700 capitalize">{selected.role}</span>
                </p>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/65">
                  <span className="flex items-center gap-1.5"><User size={14} className="text-ink/40" /> {selected.fullName}</span>
                  <span className="flex items-center gap-1.5"><Phone size={14} className="text-ink/40" /> {selected.phone}</span>
                </div>
              </div>
              <button onClick={closeChat} className="rounded-full p-1.5 text-ink/50 hover:bg-teal-50 flex-shrink-0" aria-label="Close chat"><X size={18} /></button>
            </div>
            <SupportChatThread threadUserId={selected.userId} title={selected.businessName || selected.fullName} subtitle="Support conversation" onBack={closeChat} />
          </div>
        </div>
      )}
    </div>
  )
}
