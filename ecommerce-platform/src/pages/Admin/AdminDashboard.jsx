import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Banknote, Building2, CheckCircle2, CircleDollarSign,
  ClipboardCheck, Landmark, RefreshCw, ShieldAlert, ShoppingBag,
  TrendingUp, Users, Wallet, Zap, CalendarDays
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { peso } from '../../utils/format'

const initialStats = { merchants: 0, approvedMerchants: 0, pendingMerchants: 0, resellers: 0, orders: 0, gmv: 0, pendingTopups: 0, pendingWithdrawals: 0, pendingSubscriptions: 0, pendingRegistrations: 0, platformWallet: 0 }

export default function AdminDashboard() {
  const [stats, setStats] = useState(initialStats)
  const [loading, setLoading] = useState(true)
  const [recentRegistrations, setRecentRegistrations] = useState([])

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const results = await Promise.all([
      supabase.from('merchant_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('merchant_profiles').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('merchant_profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'reseller'),
      supabase.from('orders').select('total').neq('status', 'cancelled'),
      supabase.from('topup_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('withdrawal_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('subscription_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('platform_wallet').select('balance').eq('id', true).maybeSingle(),
      supabase.from('registration_appointments').select('*', { count: 'exact' }).eq('status', 'pending').order('created_at', { ascending: false }).limit(5)
    ])
    const firstError = results.find((result) => result.error)
    if (firstError) toast.error(firstError.error.message)
    const [merchants, approved, pending, resellers, orders, topups, withdrawals, subscriptions, wallet, registrations] = results
    setStats({
      merchants: merchants.count || 0, approvedMerchants: approved.count || 0,
      pendingMerchants: pending.count || 0, resellers: resellers.count || 0,
      orders: orders.data?.length || 0,
      gmv: orders.data?.reduce((sum, order) => sum + Number(order.total), 0) || 0,
      pendingTopups: topups.count || 0, pendingWithdrawals: withdrawals.count || 0,
      pendingSubscriptions: subscriptions.count || 0, pendingRegistrations: registrations.count || 0, platformWallet: wallet.data?.balance || 0
    })
    setRecentRegistrations(registrations.data || [])
    setLoading(false)
  }

  const actionCount = stats.pendingMerchants + stats.pendingTopups + stats.pendingWithdrawals + stats.pendingSubscriptions + stats.pendingRegistrations
  const metrics = [
    { label: 'Gross marketplace value', value: peso(stats.gmv), detail: `${stats.orders} non-cancelled orders`, icon: TrendingUp, tone: 'bg-teal-50 text-teal-700', link: '/admin/reports/sales' },
    { label: 'Platform wallet', value: peso(stats.platformWallet), detail: 'Recorded platform revenue', icon: Wallet, tone: 'bg-mango-100 text-mango-600', link: '/admin/wallet' },
    { label: 'Active merchants', value: stats.approvedMerchants, detail: `${stats.merchants} total merchant accounts`, icon: Building2, tone: 'bg-teal-50 text-teal-700', link: '/admin/merchants' },
    { label: 'Registered resellers', value: stats.resellers, detail: 'Marketplace buyer network', icon: Users, tone: 'bg-coral-100 text-coral-600', link: '/admin' }
  ]
  const queues = [
    { label: 'Merchant applications', value: stats.pendingMerchants, icon: ShieldAlert, link: '/admin/merchants', color: 'text-coral-600 bg-coral-100' },
    { label: 'Subscription payments', value: stats.pendingSubscriptions, icon: ClipboardCheck, link: '/admin/subscriptions', color: 'text-teal-700 bg-teal-50' },
    { label: 'Wallet top-ups', value: stats.pendingTopups, icon: Banknote, link: '/admin/topups', color: 'text-mango-600 bg-mango-100' },
    { label: 'Withdrawals', value: stats.pendingWithdrawals, icon: Landmark, link: '/admin/withdrawals', color: 'text-ink/70 bg-black/5' }
    ,{ label: 'Schedule registrations', value: stats.pendingRegistrations, icon: CalendarDays, link: '/admin/registrations', color: 'text-teal-700 bg-teal-50' }
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="relative mb-6 overflow-hidden rounded-[1.75rem] bg-teal-900 px-6 py-7 text-white shadow-xl shadow-teal-900/10 sm:px-8 sm:py-9">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-teal-500/25 blur-2xl" />
        <div className="absolute -bottom-24 right-36 h-52 w-52 rounded-full bg-mango-500/15 blur-2xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80"><Zap size={13} className="text-mango-300" /> Marketplace command center</div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Good day, Administrator</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">Monitor operations, review account requests, and keep JOM HUB running smoothly from one workspace.</p>
          </div>
          <button onClick={load} disabled={loading} className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-50"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh data</button>
        </div>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, detail, icon: Icon, tone, link }) => (
          <Link key={label} to={link} className="group rounded-2xl border border-black/[0.06] bg-white p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:border-teal-100 hover:shadow-soft">
            <div className="flex items-start justify-between"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}><Icon size={21} /></span><ArrowRight size={17} className="text-ink/20 transition group-hover:translate-x-0.5 group-hover:text-teal-600" /></div>
            <p className="mt-5 font-display text-2xl font-bold tracking-tight text-ink">{loading ? '—' : value}</p>
            <p className="mt-1 text-sm font-semibold text-ink/75">{label}</p>
            <p className="mt-1 text-xs text-ink/45">{detail}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-black/5 px-5 py-4 sm:px-6"><div><h2 className="font-display font-bold text-ink">Approval queue</h2><p className="mt-0.5 text-xs text-ink/45">Items that may require your attention</p></div><span className={`badge ${actionCount ? 'bg-coral-100 text-coral-600' : 'bg-teal-50 text-teal-700'}`}>{actionCount} pending</span></div>
          <div className="divide-y divide-black/5">{queues.map(({ label, value, icon: Icon, link, color }) => (
            <Link key={label} to={link} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-teal-50/60 sm:px-6">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}><Icon size={19} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{label}</p><p className="text-xs text-ink/45">Open review workspace</p></div>
              <span className="font-display text-xl font-bold text-ink">{loading ? '—' : value}</span><ArrowRight size={16} className="text-ink/25 transition group-hover:translate-x-1 group-hover:text-teal-600" />
            </Link>
          ))}</div>
        </section>

        <section className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-card sm:p-6">
          <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><CheckCircle2 size={20} /></span><div><h2 className="font-display font-bold text-ink">Marketplace status</h2><p className="text-xs text-ink/45">Live operational summary</p></div></div>
          <div className="mt-6 space-y-5">
            <div><div className="mb-2 flex justify-between text-xs"><span className="font-medium text-ink/60">Merchant approval rate</span><span className="font-bold text-ink">{stats.merchants ? Math.round(stats.approvedMerchants / stats.merchants * 100) : 0}%</span></div><div className="h-2 overflow-hidden rounded-full bg-black/5"><div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${stats.merchants ? stats.approvedMerchants / stats.merchants * 100 : 0}%` }} /></div></div>
            <div className="grid grid-cols-2 gap-3"><Link to="/admin/reports/ordered" className="rounded-xl bg-cream p-4 transition hover:bg-teal-50"><ShoppingBag size={18} className="text-teal-600" /><p className="mt-3 text-xl font-bold text-ink">{stats.orders}</p><p className="text-xs text-ink/50">Total orders</p></Link><Link to="/admin/reports/sales" className="rounded-xl bg-cream p-4 transition hover:bg-teal-50"><CircleDollarSign size={18} className="text-mango-600" /><p className="mt-3 text-xl font-bold text-ink">{stats.merchants + stats.resellers}</p><p className="text-xs text-ink/50">Marketplace users</p></Link></div>
          </div>
        </section>
      </div>
      <section className="mt-6 overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-card"><div className="flex items-center justify-between border-b border-black/5 px-5 py-4 sm:px-6"><div><h2 className="font-display font-bold text-ink">Recent schedule registrations</h2><p className="mt-0.5 text-xs text-ink/45">Visitors waiting for admin contact</p></div><Link to="/admin/registrations" className="text-sm font-semibold text-teal-700">View all</Link></div>{recentRegistrations.length === 0 ? <p className="px-6 py-8 text-center text-sm text-ink/45">No pending registrations.</p> : <div className="divide-y divide-black/5">{recentRegistrations.map((registration) => <Link key={registration.id} to="/admin/registrations" className="flex flex-col gap-2 px-5 py-4 transition hover:bg-teal-50/50 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><p className="font-semibold text-ink">{registration.full_name}</p><p className="text-xs text-ink/45">{registration.email} · {registration.phone}</p></div><p className="text-sm font-semibold text-teal-700">{new Date(`${registration.preferred_date}T${registration.preferred_time}`).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p></Link>)}</div>}</section>
    </div>
  )
}
