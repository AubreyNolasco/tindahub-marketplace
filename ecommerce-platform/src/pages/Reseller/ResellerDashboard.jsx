import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, CheckCircle2, ClipboardList, RefreshCw, ShoppingBag, Store, Truck, Users, Wallet, XCircle } from 'lucide-react'
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

// Same display-only 30-day-vs-previous-30-day comparison as
// MerchantDashboard.jsx's periodDelta — feeds the "+18% vs last month"
// chip StatCard already supports. Returns null (not a misleading
// +100%/-100%) when there's no prior-period data yet.
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

function buildTopMerchants(orders, limit = 5) {
  const byMerchant = new Map()
  for (const order of orders) {
    if (order.status === 'cancelled' || !order.merchant_id) continue
    const key = order.merchant_id
    const existing = byMerchant.get(key) || { name: order.merchant_profiles?.business_name || 'Merchant', orders: 0, spent: 0 }
    existing.orders += 1
    existing.spent += Number(order.total || 0)
    byMerchant.set(key, existing)
  }
  return Array.from(byMerchant.values()).sort((a, b) => b.spent - a.spent).slice(0, limit)
}

export default function ResellerDashboard() {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({ orders: 0, active: 0, spent: 0, customers: 0, wallet: 0, spentDelta: null })
  const [orders, setOrders] = useState([])
  const [lalamove, setLalamove] = useState(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    const [ordersRes, customers, wallet, lalamoveRes] = await Promise.all([
      // admin_seed_sample_catalog() plants real orders (notes=
      // 'SAMPLE_CATALOG_SEED') under the demo account acting as its own
      // reseller too -- excluded so purchases/spend reflect real orders
      // only.
      supabase.from('orders').select('id,order_number,total,status,created_at,merchant_id,delivery_provider,tracking_number,merchant_profiles(business_name)').eq('reseller_id', user.id).or('notes.is.null,notes.neq.SAMPLE_CATALOG_SEED').order('created_at', { ascending: false }),
      supabase.from('customers').select('*', { count: 'exact', head: true }).eq('reseller_id', user.id),
      supabase.from('wallets').select('balance').eq('owner_id', user.id).maybeSingle(),
      supabase.rpc('get_lalamove_settings')
    ])
    const error = [ordersRes, customers, wallet].find((result) => result.error)?.error
    if (error) toast.error(error.message)
    const orderRows = ordersRes.data || []
    setStats({ orders: orderRows.length, active: orderRows.filter((o) => !['completed', 'cancelled'].includes(o.status)).length, spent: orderRows.filter((o) => o.status !== 'cancelled').reduce((sum, order) => sum + Number(order.total), 0), customers: customers.count || 0, wallet: wallet.data?.balance || 0, spentDelta: periodDelta(orderRows) })
    setOrders(orderRows)
    if (!lalamoveRes.error) setLalamove(lalamoveRes.data)
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])
  const activityTrend = useMemo(() => buildDailyTrend(orders), [orders])
  const topMerchants = useMemo(() => buildTopMerchants(orders), [orders])
  const recentOrders = orders.slice(0, 6)

  const cards = [
    { label: 'Wallet balance', value: peso(stats.wallet), detail: 'Available purchasing funds', icon: Wallet, to: '/reseller/wallet', tone: 'mango', loading },
    { label: 'Total purchases', value: peso(stats.spent), detail: `${stats.orders} lifetime orders`, icon: BarChart3, to: '/reseller/reports/sales', tone: 'teal', loading, delta: stats.spentDelta ?? undefined, trend: activityTrend.length > 1 ? activityTrend : undefined },
    { label: 'Active orders', value: stats.active, detail: 'Currently being fulfilled', icon: ClipboardList, to: '/reseller/orders', tone: 'coral', loading },
    { label: 'Customers', value: stats.customers, detail: 'Saved customer records', icon: Users, to: '/reseller/customers', tone: 'teal', loading }
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
  const setupSteps=[{label:'Account approved',done:profile?.account_status==='approved',to:'/pending-approval'},{label:'Address completed',done:isCompleteAddress(profile?.address),to:'/reseller/address'},{label:'Wallet funded',done:stats.wallet>0,to:'/reseller/wallet'},{label:'Customer added',done:stats.customers>0,to:'/reseller/customers'},{label:'First order placed',done:stats.orders>0,to:'/reseller/orders'}]

  return (
    <div className="mx-auto min-h-full max-w-7xl space-y-6 bg-bg px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title={`Welcome, ${profile?.full_name?.split(' ')[0] || 'Reseller'}`}
        description="Track purchases, wallet funds, customers, and order activity."
        actions={<>
          <Button variant="secondary" size="sm" icon={RefreshCw} loading={loading} onClick={load}>Refresh</Button>
          <Button variant="accent" size="sm" icon={Store} as={Link} to="/catalog">Browse products</Button>
        </>}
      />

      {!loading && <>
        <NextActionCard {...nextAction} />
        <SetupChecklist title="Reseller setup checklist" steps={setupSteps} />
      </>}

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {cards.map((card) => <StatCard key={card.label} {...card} />)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <AnalyticsPanel title="Order activity" description="Last 14 days, non-cancelled orders" data={activityTrend} valueFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />

        <Card>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300"><Truck size={20} /></span>
            <div>
              <h2 className="font-display font-bold text-fg">Lalamove connection</h2>
              <p className="text-xs text-fg-muted">Your delivery integration</p>
            </div>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-xl bg-surface-inset p-4">
            {lalamove?.has_credentials && lalamove?.is_enabled ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 dark:text-teal-300"><CheckCircle2 size={16} /> Connected & active</span>
            ) : lalamove?.has_credentials ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-mango-600"><Truck size={16} /> Connected, not enabled</span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-fg-muted"><XCircle size={16} /> Not connected</span>
            )}
          </div>
          <Link to="/reseller/delivery" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 dark:text-teal-300">Manage delivery settings <ArrowRight size={15} /></Link>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-display font-bold text-fg">Top merchants</h2>
            <Link to="/catalog" className="text-sm font-semibold text-teal-700 dark:text-teal-300">Browse</Link>
          </div>
          {topMerchants.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-fg-muted">Place your first order to see merchant activity here.</p>
          ) : (
            <div className="divide-y divide-line">
              {topMerchants.map((merchant, i) => (
                <div key={i} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-fg">{merchant.name}</p><p className="text-xs text-fg-muted">{merchant.orders} order{merchant.orders === 1 ? '' : 's'}</p></div>
                  <span className="font-mono text-sm font-bold tabular-nums text-fg">{peso(merchant.spent)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-display font-bold text-fg">Recent order activity</h2>
            <Link to="/reseller/orders" className="text-sm font-semibold text-teal-700 dark:text-teal-300">View all</Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-fg-muted">No orders yet.</p>
          ) : (
            <div className="divide-y divide-line">
              {recentOrders.map((order) => (
                <Link key={order.id} to="/reseller/orders" className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-teal-50/60 dark:hover:bg-teal-500/5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-fg">#{order.order_number}</p>
                    <p className="text-xs text-fg-muted">{order.merchant_profiles?.business_name || 'Merchant'} · {order.tracking_number ? `Tracking ${order.tracking_number}` : new Date(order.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-sm font-bold tabular-nums text-fg">{peso(order.total)}</span>
                    <Badge tone={order.status === 'completed' ? 'success' : order.status === 'cancelled' ? 'danger' : 'info'}>{order.status.replace(/_/g, ' ')}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <div><h2 className="font-display font-bold text-fg">Grow your reseller business</h2><p className="mt-1 text-sm text-fg-muted">Source products from verified JOM HUB merchants.</p></div>
          <ShoppingBag className="text-teal-600" />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link to="/catalog" className="btn-secondary text-sm">Explore the catalog</Link>
          <Link to="/reseller/wallet" className="btn-secondary text-sm">Top up wallet</Link>
          <Link to="/reseller/customers" className="btn-secondary text-sm">Manage customers</Link>
        </div>
      </Card>
    </div>
  )
}
