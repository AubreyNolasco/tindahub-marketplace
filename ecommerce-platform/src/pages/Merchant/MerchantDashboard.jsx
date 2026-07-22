import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, BarChart3, Boxes, ClipboardList, Package, Plus, RefreshCw, ShoppingBag, Store, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso, formatDate } from '../../utils/format'
import NextActionCard from '../../components/dashboard/NextActionCard'
import { isCompleteAddress } from '../../utils/address'
import SetupChecklist from '../../components/dashboard/SetupChecklist'

export default function MerchantDashboard() {
  const { user, profile } = useAuth()
  const merchant = profile?.merchant_profiles
  const [stats, setStats] = useState({ products: 0, lowStock: 0, orders: 0, pending: 0, sales: 0, wallet: 0 })
  const [loading, setLoading] = useState(true)
  useEffect(() => { load() }, [])
  const load = async () => {
    setLoading(true)
    const [products, orders, wallet] = await Promise.all([
      supabase.from('products').select('stock_quantity').eq('merchant_id', user.id),
      supabase.from('orders').select('total,status').eq('merchant_id', user.id),
      supabase.from('wallets').select('balance').eq('owner_id', user.id).maybeSingle()
    ])
    const error = [products, orders, wallet].find((result) => result.error)?.error
    if (error) toast.error(error.message)
    setStats({ products: products.data?.length || 0, lowStock: products.data?.filter((p) => p.stock_quantity <= 5).length || 0, orders: orders.data?.length || 0, pending: orders.data?.filter((o) => ['pending_payment', 'payment_review'].includes(o.status)).length || 0, sales: orders.data?.filter((o) => o.status !== 'cancelled').reduce((sum, order) => sum + Number(order.total), 0) || 0, wallet: wallet.data?.balance || 0 })
    setLoading(false)
  }
  const cards = [
    { label: 'Gross sales', value: peso(stats.sales), detail: `${stats.orders} total orders`, icon: BarChart3, link: '/merchant/reports/sales', tone: 'bg-teal-50 text-teal-700' },
    { label: 'Wallet balance', value: peso(stats.wallet), detail: 'Available merchant funds', icon: Wallet, link: '/merchant/wallet', tone: 'bg-mango-100 text-mango-600' },
    { label: 'Products', value: stats.products, detail: `${stats.lowStock} low or out of stock`, icon: Package, link: '/merchant/products', tone: 'bg-coral-100 text-coral-600' },
    { label: 'Orders to review', value: stats.pending, detail: 'Payment and pending orders', icon: ClipboardList, link: '/merchant/orders', tone: 'bg-teal-50 text-teal-700' }
  ]
  const nextAction = merchant?.status !== 'approved'
    ? { title:'Complete Merchant approval', description:'Finish the permit and subscription payment review before publishing products.', to:'/pending-approval', action:'View approval' }
    : !isCompleteAddress(merchant?.business_address)
      ? { title:'Complete your pickup address', description:'Accurate pickup information is required for product fulfillment and delivery.', to:'/merchant/address', action:'Update address' }
      : !merchant?.subscription_active
        ? { title:'Activate your subscription', description:'Choose a plan and submit payment proof to keep protected store actions available.', to:'/choose-subscription', action:'Choose plan' }
        : stats.products === 0
          ? { title:'Publish your first product', description:'Add truthful product details, a real image, pricing, stock, and packed shipping data.', to:'/merchant/products/new', action:'Add product' }
          : stats.pending > 0
            ? { title:'Review incoming orders', description:`You have ${stats.pending} order${stats.pending===1?'':'s'} waiting for review.`, to:'/merchant/orders', action:'Review orders' }
            : stats.lowStock > 0
              ? { title:'Restock low inventory', description:`${stats.lowStock} product${stats.lowStock===1?' is':'s are'} low or out of stock.`, to:'/merchant/products', action:'Manage products' }
              : { title:'Review store performance', description:'Your operational queues are clear. Review sales, fees, and inventory trends.', to:'/merchant/reports/sales', action:'Open report', complete:true }
  const setupSteps=[{label:'Store approved',done:merchant?.status==='approved',to:'/pending-approval'},{label:'Pickup address',done:isCompleteAddress(merchant?.business_address),to:'/merchant/address'},{label:'Subscription active',done:Boolean(merchant?.subscription_active),to:'/choose-subscription'},{label:'Product published',done:stats.products>0,to:'/merchant/products'},{label:'First order received',done:stats.orders>0,to:'/merchant/orders'}]
  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <section className="relative mb-6 overflow-hidden rounded-[1.75rem] bg-teal-900 px-6 py-8 text-white shadow-xl shadow-teal-900/10 sm:px-8"><div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-teal-500/25 blur-2xl" /><div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/75"><Store size={13} /> Merchant workspace</span><h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">{merchant?.business_name || 'Your Store'}</h1><p className="mt-2 text-sm text-white/60">Manage products, orders, earnings, and store performance.</p></div><div className="flex gap-2"><button onClick={load} className="rounded-xl border border-white/15 bg-white/10 p-2.5 hover:bg-white/15"><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button><Link to="/merchant/products/new" className="inline-flex items-center gap-2 rounded-xl bg-mango-500 px-4 py-2.5 text-sm font-bold text-ink hover:bg-mango-600"><Plus size={17} /> Add product</Link></div></div></section>
    {(merchant?.status === 'pending' || merchant?.status === 'rejected') && <div className={`mb-6 flex items-center gap-3 rounded-2xl border p-4 ${merchant.status === 'rejected' ? 'border-coral-100 bg-coral-100/70' : 'border-mango-300 bg-mango-100/70'}`}><AlertCircle size={20} className={merchant.status === 'rejected' ? 'text-coral-600' : 'text-mango-600'} /><p className="text-sm text-ink/75">{merchant.status === 'rejected' ? 'Your store application needs Admin attention.' : 'Your store is currently awaiting Admin approval.'}</p></div>}
    {!loading&&<><NextActionCard {...nextAction}/><SetupChecklist title="Merchant setup checklist" steps={setupSteps}/></>}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, detail, icon: Icon, link, tone }) => <Link key={label} to={link} className="group rounded-2xl border border-black/[0.06] bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:shadow-soft"><div className="flex justify-between"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tone}`}><Icon size={21} /></span><ArrowRight size={17} className="text-ink/20 group-hover:text-teal-600" /></div><p className="mt-5 font-display text-2xl font-bold text-ink">{loading ? '—' : value}</p><p className="mt-1 text-sm font-semibold text-ink/75">{label}</p><p className="mt-1 text-xs text-ink/45">{detail}</p></Link>)}</div>
    <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-card"><h2 className="font-display font-bold text-ink">Quick actions</h2><div className="mt-4 grid grid-cols-2 gap-3"><Link to="/merchant/orders" className="rounded-xl bg-cream p-4 hover:bg-teal-50"><ClipboardList className="text-teal-600" size={20} /><p className="mt-3 text-sm font-semibold">Manage orders</p></Link><Link to="/merchant/reports/inventory" className="rounded-xl bg-cream p-4 hover:bg-teal-50"><Boxes className="text-teal-600" size={20} /><p className="mt-3 text-sm font-semibold">Check inventory</p></Link></div></section><section className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-card"><h2 className="font-display font-bold text-ink">Subscription status</h2><p className="mt-4 text-sm text-ink/60">{merchant?.subscription_active ? `Active until ${formatDate(merchant.subscription_expires_at)}` : 'Subscription is not currently active.'}</p><Link to="/merchant/reports/sales" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">Open performance report <ArrowRight size={15} /></Link></section></div>
  </div>
}
