import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock3, Laptop, RefreshCw, Search, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

function deviceLabel(agent = '') {
  const browser = /Edg\//.test(agent) ? 'Edge' : /Chrome\//.test(agent) ? 'Chrome' : /Firefox\//.test(agent) ? 'Firefox' : /Safari\//.test(agent) ? 'Safari' : 'Browser'
  const device = /Android/.test(agent) ? 'Android' : /iPhone|iPad/.test(agent) ? 'iOS' : /Windows/.test(agent) ? 'Windows' : /Mac OS/.test(agent) ? 'macOS' : /Linux/.test(agent) ? 'Linux' : 'Unknown device'
  return `${browser} on ${device}`
}

function formatLoginDate(value) {
  return new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function LoginHistory() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('all')
  const [date, setDate] = useState('')

  useEffect(() => { load() }, [])
  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('login_history').select('*, profiles(full_name, role, merchant_profiles!merchant_profiles_id_fkey(business_name))').order('logged_in_at', { ascending: false }).limit(500)
    if (error) toast.error(error.message)
    setEvents(data || [])
    setLoading(false)
  }

  const filtered = useMemo(() => events.filter((event) => {
    const profile = event.profiles
    const name = profile?.merchant_profiles?.business_name || profile?.full_name || ''
    const matchesSearch = !search || `${name} ${event.ip_address || ''}`.toLowerCase().includes(search.toLowerCase())
    const matchesRole = role === 'all' || profile?.role === role
    const matchesDate = !date || new Date(event.logged_in_at).toLocaleDateString('en-CA') === date
    return matchesSearch && matchesRole && matchesDate
  }), [events, search, role, date])

  const todayCount = events.filter((event) => new Date(event.logged_in_at).toDateString() === new Date().toDateString()).length
  const uniqueToday = new Set(events.filter((event) => new Date(event.logged_in_at).toDateString() === new Date().toDateString()).map((event) => event.user_id)).size

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>
  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><span className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">Security monitoring</span><h1 className="mt-1 font-display text-2xl font-bold text-ink sm:text-3xl">Login History</h1><p className="mt-1 text-sm text-ink/55">Monitor successful account sign-ins and device information.</p></div><button onClick={load} className="btn-secondary flex w-fit items-center gap-2 text-sm"><RefreshCw size={16} /> Refresh</button></div>

    <div className="mt-6 grid gap-4 sm:grid-cols-3"><div className="card p-5"><Clock3 size={20} className="text-teal-600" /><p className="mt-3 text-2xl font-bold text-ink">{todayCount}</p><p className="text-sm text-ink/50">Logins today</p></div><div className="card p-5"><ShieldCheck size={20} className="text-teal-600" /><p className="mt-3 text-2xl font-bold text-ink">{uniqueToday}</p><p className="text-sm text-ink/50">Unique users today</p></div><div className="card p-5"><CalendarDays size={20} className="text-teal-600" /><p className="mt-3 text-2xl font-bold text-ink">{events.length}</p><p className="text-sm text-ink/50">Recent login records</p></div></div>

    <div className="mt-6 grid gap-3 rounded-2xl border border-black/[0.06] bg-surface p-4 shadow-card sm:grid-cols-[1fr_170px_180px]"><label className="relative"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" placeholder="Search name or IP address" /></label><select value={role} onChange={(e) => setRole(e.target.value)} className="input-field"><option value="all">All roles</option><option value="admin">Admin</option><option value="merchant">Merchant</option><option value="reseller">Reseller</option></select><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" /></div>

    <div className="mt-4 overflow-hidden rounded-2xl border border-black/[0.06] bg-surface shadow-card">{filtered.length === 0 ? <EmptyState icon={Clock3} title="No login records found" message="Try changing the search or date filters." /> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="border-b border-black/5 bg-teal-50/70 text-xs uppercase tracking-wide text-ink/45"><tr><th className="px-5 py-3.5 font-semibold">Account</th><th className="px-5 py-3.5 font-semibold">Role</th><th className="px-5 py-3.5 font-semibold">Date and time</th><th className="px-5 py-3.5 font-semibold">IP address</th><th className="px-5 py-3.5 font-semibold">Browser / device</th></tr></thead><tbody className="divide-y divide-black/5">{filtered.map((event) => { const profile = event.profiles; const name = profile?.merchant_profiles?.business_name || profile?.full_name || 'Unknown account'; return <tr key={event.id} className="transition hover:bg-teal-50/40"><td className="px-5 py-4"><p className="font-semibold text-ink">{name}</p>{profile?.merchant_profiles?.business_name && <p className="text-xs text-ink/45">{profile.full_name}</p>}</td><td className="px-5 py-4"><span className="badge capitalize bg-teal-50 text-teal-700">{profile?.role || 'unknown'}</span></td><td className="px-5 py-4 whitespace-nowrap text-ink/65">{formatLoginDate(event.logged_in_at)}</td><td className="px-5 py-4 font-mono text-xs text-ink/55">{event.ip_address || 'Not available'}</td><td className="px-5 py-4"><span className="flex items-center gap-2 text-ink/60"><Laptop size={16} className="text-teal-600" /> {deviceLabel(event.user_agent)}</span></td></tr> })}</tbody></table></div>}</div>
    <p className="mt-3 text-xs text-ink/40">Showing up to the 500 most recent successful login records. Dates use your device timezone.</p>
  </div>
}
