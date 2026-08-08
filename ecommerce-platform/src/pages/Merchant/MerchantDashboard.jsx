import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowRight, BarChart3, Boxes, ClipboardList, Package, Plus, RefreshCw, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso } from '../../utils/format'
import NextActionCard from '../../components/dashboard/NextActionCard'
import { isCompleteAddress } from '../../utils/address'
import SetupChecklist from '../../components/dashboard/SetupChecklist'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import AnalyticsPanel from '../../components/ui/AnalyticsPanel'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'

const STATUS_TONE = { pending_payment: 'warning', payment_review: 'warning', confirmed: 'info', processing: 'info' }

function buildDailyTrend(orders, days = 14) {
  const buckets = new Map()
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    buckets.set(d.toISOString().slice(0, 10), 0)
  }
  for (const order of orders) {
    if (!order.created_at || order.status === 'cancelled') continue
    const key = new Date(order.created_at).toISOString().slice(0, 10)
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + Number(order.total || 0))
  }
  return Array.from(buckets.entries()).map(([key, value]) => ({
    label: new Date(key).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
    value: Math.round(value)
  }))
}

// This 30-day-vs-previous-30-day comparison is display-only (the "+18%
// vs last month" chip StatCard already supports but nothing was passing
// it) — never used for anything money-moving. Returns null rather than
// a misleading +100%/-100% when there's no prior-period data yet to
// compare against.
function periodDelta(orders, days = 30) {
  const now = Date.now()
  const dayMs = 86400000
  let current = 0, previous = 0
  for (const order of orders) {
    if (!order.created_at || order.status === 'cancelled') continue
    const age = (now - new Date(order.created_at).getTime()) / dayMs
    if (age <= days) current += Number(order.total || 0)
    else if (age <= days * 2) previous += Number(order.total || 0)
  }
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export default function MerchantDashboard() {
  const { user, profile } = useAuth()
  const merchant = profile?.merchant_profiles
  const [stats, setStats] = useState({ products: 0, lowStock: 0, orders: 0, pending: 0, sales: 0, wallet: 0, salesDelta: null })
  const [salesTrend, setSalesTrend] = useState([])
  const [incomingOrders, setIncomingOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    const [products, orders, wallet, incoming] = await Promise.all([
      supabase.from('products').select('stock_quantity').eq('merchant_id', user.id),
      supabase.from('orders').select('total,status,created_at').eq('merchant_id', user.id),
      supabase.from('wallets').select('balance').eq('owner_id', user.id).maybeSingle(),
      supabase.from('orders').select('id,order_number,status,total,created_at').eq('merchant_id', user.id).in('status', ['pending_payment', 'payment_review', 'confirmed', 'processing']).order('created_at', { ascending: false }).limit(6)
    ])
    const error = [products, orders, wallet, incoming].find((result) => result.error)?.error
    if (error) toast.error(error.message)
    setStats({ products: products.data?.length || 0, lowStock: products.data?.filter((p) => p.stock_quantity <= 5).length || 0, orders: orders.data?.length || 0, pending: orders.data?.filter((o) => ['pending_payment', 'payment_review'].includes(o.status)).length || 0, sales: orders.data?.filter((o) => o.status !== 'cancelled').reduce((sum, order) => sum + Number(order.total), 0) || 0, wallet: wallet.data?.balance || 0, salesDelta: periodDelta(orders.data || []) })
    setSalesTrend(buildDailyTrend(orders.data || []))
    setIncomingOrders(incoming.data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])
  const cards = [
    { label: 'Gross sales', value: peso(stats.sales), detail: `${stats.orders} total orders`, icon: BarChart3, to: '/merchant/reports/sales', tone: 'teal', loading, delta: stats.salesDelta ?? undefined, trend: salesTrend.length > 1 ? salesTrend : undefined },
    { label: 'Wallet balance', value: peso(stats.wallet), detail: 'Available merchant funds', icon: Wallet, to: '/merchant/wallet', tone: 'mango', loading },
    { label: 'Products', value: stats.products, detail: `${stats.lowStock} low or out of stock`, icon: Package, to: '/merchant/products', tone: 'coral', loading },
    { label: 'Orders to review', value: stats.pending, detail: 'Payment and pending orders', icon: ClipboardList, to: '/merchant/orders', tone: 'teal', loading }
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

  return (
    <div className="mx-auto min-h-full max-w-7xl space-y-6 bg-bg px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title={merchant?.business_name || 'Your Store'}
        description="Manage products, orders, earnings, and store performance."
        actions={<>
          <Button variant="secondary" size="sm" icon={RefreshCw} loading={loading} onClick={load}>Refresh</Button>
          <Button variant="accent" size="sm" icon={Plus} as={Link} to="/merchant/products/new">Add product</Button>
        </>}
      />

      {(merchant?.status === 'pending' || merchant?.status === 'rejected') && (
        <div className={`flex items-center gap-3 rounded-2xl border p-4 ${merchant.status === 'rejected' ? 'border-coral-100 bg-coral-100/70 dark:border-coral-800 dark:bg-coral-500/10' : 'border-mango-300 bg-mango-100/70 dark:border-mango-700 dark:bg-mango-500/10'}`}>
          <AlertCircle size={20} className={merchant.status === 'rejected' ? 'text-coral-600' : 'text-mango-600'} />
          <p className="text-sm text-fg">{merchant.status === 'rejected' ? 'Your store application needs Admin attention.' : 'Your store is currently awaiting Admin approval.'}</p>
        </div>
      )}

      {!loading && <>
        <NextActionCard {...nextAction} />
        <SetupChecklist title="Merchant setup checklist" steps={setupSteps} />
      </>}

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {cards.map((card) => <StatCard key={card.label} {...card} />)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <AnalyticsPanel title="Sales trend" description="Last 14 days, non-cancelled orders" data={salesTrend} valueFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />

        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="font-display font-bold text-fg">Incoming orders</h2>
              <p className="mt-0.5 text-xs text-fg-muted">Awaiting your action</p>
            </div>
            <Link to="/merchant/orders" className="text-sm font-semibold text-teal-700 dark:text-teal-300">View all</Link>
          </div>
          {incomingOrders.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-fg-muted">No orders waiting right now.</p>
          ) : (
            <div className="divide-y divide-line">
              {incomingOrders.map((order) => (
                <Link key={order.id} to="/merchant/orders" className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-teal-50/60 dark:hover:bg-teal-500/5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fg">#{order.order_number}</p>
                    <p className="text-xs text-fg-muted">{new Date(order.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-sm font-bold tabular-nums text-fg">{peso(order.total)}</span>
                    <Badge tone={STATUS_TONE[order.status] || 'neutral'}>{order.status.replace(/_/g, ' ')}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display font-bold text-fg">Quick actions</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link to="/merchant/orders" className="rounded-xl bg-surface-inset p-4 transition hover:bg-teal-50 dark:hover:bg-teal-500/10"><ClipboardList className="text-teal-600" size={20} /><p className="mt-3 text-sm font-semibold text-fg">Manage orders</p></Link>
            <Link to="/merchant/reports/inventory" className="rounded-xl bg-surface-inset p-4 transition hover:bg-teal-50 dark:hover:bg-teal-500/10"><Boxes className="text-teal-600" size={20} /><p className="mt-3 text-sm font-semibold text-fg">Check inventory</p></Link>
          </div>
        </Card>
        <Card>
          <h2 className="font-display font-bold text-fg">Inventory overview</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-inset p-4"><p className="font-mono text-2xl font-bold tabular-nums text-fg">{stats.products}</p><p className="mt-1 text-xs text-fg-muted">Active products</p></div>
            <div className={`rounded-xl p-4 ${stats.lowStock > 0 ? 'bg-coral-100 dark:bg-coral-500/10' : 'bg-surface-inset'}`}><p className={`font-mono text-2xl font-bold tabular-nums ${stats.lowStock > 0 ? 'text-coral-600' : 'text-fg'}`}>{stats.lowStock}</p><p className="mt-1 text-xs text-fg-muted">Low or out of stock</p></div>
          </div>
          <Link to="/merchant/products" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">Manage products <ArrowRight size={15} /></Link>
        </Card>
      </div>
    </div>
  )
}
