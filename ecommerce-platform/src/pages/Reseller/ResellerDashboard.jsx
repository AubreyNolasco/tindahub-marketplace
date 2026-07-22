import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, ClipboardList, RefreshCw, ShoppingBag, Store, Users, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso } from '../../utils/format'
import NextActionCard from '../../components/dashboard/NextActionCard'
import { isCompleteAddress } from '../../utils/address'

export default function ResellerDashboard() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ orders: 0, active: 0, spent: 0, customers: 0, wallet: 0 })
  const [loading, setLoading] = useState(true)
  useEffect(() => { load() }, [])
  const load = async () => { setLoading(true); const [orders, customers, wallet] = await Promise.all([supabase.from('orders').select('total,status').eq('reseller_id', user.id), supabase.from('customers').select('*', { count: 'exact', head: true }).eq('reseller_id', user.id), supabase.from('wallets').select('balance').eq('owner_id', user.id).maybeSingle()]); const error = [orders, customers, wallet].find((result) => result.error)?.error; if (error) toast.error(error.message); setStats({ orders: orders.data?.length || 0, active: orders.data?.filter((o) => !['completed', 'cancelled'].includes(o.status)).length || 0, spent: orders.data?.filter((o) => o.status !== 'cancelled').reduce((sum, order) => sum + Number(order.total), 0) || 0, customers: customers.count || 0, wallet: wallet.data?.balance || 0 }); setLoading(false) }
  const cards = [
    { label: 'Wallet balance', value: peso(stats.wallet), detail: 'Available purchasing funds', icon: Wallet, link: '/reseller/wallet', tone: 'bg-mango-100 text-mango-600' },
    { label: 'Total purchases', value: peso(stats.spent), detail: `${stats.orders} lifetime orders`, icon: BarChart3, link: '/reseller/reports/sales', tone: 'bg-teal-50 text-teal-700' },
    { label: 'Active orders', value: stats.active, detail: 'Currently being fulfilled', icon: ClipboardList, link: '/reseller/orders', tone: 'bg-coral-100 text-coral-600' },
    { label: 'Customers', value: stats.customers, detail: 'Saved customer records', icon: Users, link: '/reseller/customers', tone: 'bg-teal-50 text-teal-700' }
  ]
  const nextAction = profile?.account_status !== 'approved'
    ? { title:'Complete account approval', description:'Finish the required profile and payment verification before placing protected orders.', to:'/pending-approval', action:'View approval' }
    : !isCompleteAddress(profile?.address)
      ? { title:'Complete your delivery address', description:'A complete address is required before customer and order workflows are unlocked.', to:'/reseller/address', action:'Update address' }
      : stats.customers === 0
        ? { title:'Add your first customer', description:'Save an authorized customer and verify their delivery details before preparing an order.', to:'/reseller/customers', action:'Add customer' }
        : stats.active > 0
          ? { title:'Track your active orders', description:`You have ${stats.active} order${stats.active===1?'':'s'} that may need delivery or case follow-up.`, to:'/reseller/orders', action:'Open orders' }
          : stats.wallet <= 0
            ? { title:'Fund your wallet', description:'Submit a unique top-up reference and payment proof for Admin verification.', to:'/reseller/wallet', action:'Top up wallet' }
            : { title:'Find your next product', description:'Your account is ready. Compare approved products, quantity prices, and projected margin.', to:'/catalog', action:'Browse catalog', complete:true }
  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><section className="relative mb-6 overflow-hidden rounded-[1.75rem] bg-teal-900 px-6 py-8 text-white shadow-xl shadow-teal-900/10 sm:px-8"><div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-teal-500/25 blur-2xl" /><div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/75"><ShoppingBag size={13} /> Reseller workspace</span><h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">Welcome, {profile?.full_name?.split(' ')[0] || 'Reseller'}</h1><p className="mt-2 text-sm text-white/60">Track purchases, wallet funds, customers, and order activity.</p></div><div className="flex gap-2"><button onClick={load} className="rounded-xl border border-white/15 bg-white/10 p-2.5 hover:bg-white/15"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button><Link to="/catalog" className="inline-flex items-center gap-2 rounded-xl bg-mango-500 px-4 py-2.5 text-sm font-bold text-ink hover:bg-mango-600"><Store size={17} /> Browse products</Link></div></div></section>
    {!loading&&<NextActionCard {...nextAction}/>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, detail, icon: Icon, link, tone }) => <Link key={label} to={link} className="group rounded-2xl border border-black/[0.06] bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft"><div className="flex justify-between"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}><Icon size={21} /></span><ArrowRight size={17} className="text-ink/20 group-hover:text-teal-600" /></div><p className="mt-5 font-display text-2xl font-bold text-ink">{loading ? '—' : value}</p><p className="mt-1 text-sm font-semibold text-ink/75">{label}</p><p className="mt-1 text-xs text-ink/45">{detail}</p></Link>)}</div>
    <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr]"><section className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-card"><div className="flex items-center justify-between"><div><h2 className="font-display font-bold text-ink">Grow your reseller business</h2><p className="mt-1 text-sm text-ink/55">Source products from verified JOM HUB merchants.</p></div><Store className="text-teal-600" /></div><Link to="/catalog" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">Explore the catalog <ArrowRight size={15} /></Link></section><section className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-card"><h2 className="font-display font-bold text-ink">Quick actions</h2><div className="mt-4 flex flex-wrap gap-2"><Link to="/reseller/wallet" className="btn-secondary text-sm">Top up wallet</Link><Link to="/reseller/customers" className="btn-secondary text-sm">Manage customers</Link></div></section></div>
  </div>
}
