import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Banknote, Building2, CircleDollarSign,
  ClipboardCheck, Landmark, RefreshCw, ShieldAlert, ShoppingBag,
  TrendingUp, Users, Wallet, CalendarDays, CheckCircle2, Activity,
  Package, Store, UserRound, CalendarRange
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { peso } from '../../utils/format'
import { getTopProduct, getTopReseller, getTopMerchant } from '../../lib/services/dashboardStats'
import { REPORT_PERIODS, reportPeriodRange } from '../../utils/reportDates'
import NextActionCard from '../../components/dashboard/NextActionCard'
import LeaderboardCard from '../../components/dashboard/LeaderboardCard'
import PageHeader from '../../components/ui/PageHeader'
import StatCard from '../../components/ui/StatCard'
import AnalyticsPanel from '../../components/ui/AnalyticsPanel'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'

const initialStats = { merchants: 0, approvedMerchants: 0, pendingMerchants: 0, resellers: 0, orders: 0, gmv: 0, gmvDelta: null, pendingTopups: 0, pendingWithdrawals: 0, pendingSubscriptions: 0, pendingRegistrations: 0, platformWallet: 0 }

// Buckets real order totals into a 14-day trend for the revenue chart —
// derived from the same non-cancelled-orders query the GMV stat already
// uses, not synthetic data.
function buildDailyTrend(orders, days = 14) {
  const buckets = new Map()
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    buckets.set(d.toISOString().slice(0, 10), 0)
  }
  for (const order of orders) {
    if (!order.created_at) continue
    const key = new Date(order.created_at).toISOString().slice(0, 10)
    if (buckets.has(key)) buckets.set(key, buckets.get(key) + Number(order.total || 0))
  }
  return Array.from(buckets.entries()).map(([key, value]) => ({
    label: new Date(key).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
    value: Math.round(value)
  }))
}

// Same display-only 30-day-vs-previous-30-day comparison as the
// Merchant/Reseller dashboards' periodDelta — feeds the "+18% vs last
// month" chip StatCard already supports but this page wasn't passing.
// Returns null (chip stays hidden) rather than a misleading
// +100%/-100% when there's no prior-period data yet.
function periodDelta(orders, days = 30) {
  const now = Date.now()
  const dayMs = 86400000
  let current = 0, previous = 0
  for (const order of orders) {
    if (!order.created_at) continue
    const age = (now - new Date(order.created_at).getTime()) / dayMs
    if (age <= days) current += Number(order.total || 0)
    else if (age <= days * 2) previous += Number(order.total || 0)
  }
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(initialStats)
  const [loading, setLoading] = useState(true)
  const [recentRegistrations, setRecentRegistrations] = useState([])
  const [revenueTrend, setRevenueTrend] = useState([])
  const [topProduct, setTopProduct] = useState(null)
  const [topReseller, setTopReseller] = useState(null)
  const [topMerchant, setTopMerchant] = useState(null)
  const [leaderboardErrors, setLeaderboardErrors] = useState({ product: null, reseller: null, merchant: null })
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [leaderboardStart, setLeaderboardStart] = useState(() => reportPeriodRange('last30').start)
  const [leaderboardEnd, setLeaderboardEnd] = useState(() => reportPeriodRange('last30').end)
  const [leaderboardPeriod, setLeaderboardPeriod] = useState('last30')

  useEffect(() => {
    load()
    loadLeaderboards(leaderboardStart, leaderboardEnd)
    // Mount-only: leaderboardStart/leaderboardEnd changes are fetched
    // explicitly by their own handlers (dropdown, Apply, Refresh).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = async () => {
    setLoading(true)
    const results = await Promise.all([
      supabase.from('merchant_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('merchant_profiles').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('merchant_profiles').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'reseller'),
      // admin_seed_sample_catalog() plants real 'completed' rows in orders
      // (notes='SAMPLE_CATALOG_SEED') so the demo catalog shows a sold
      // count -- excluded here so GMV reflects real transactions only. A
      // plain .neq('notes', ...) would also silently drop every order
      // with no notes at all (SQL's `null <> x` is null, not true), so
      // this has to explicitly keep the null-notes rows too.
      supabase.from('orders').select('total, created_at').neq('status', 'cancelled').or('notes.is.null,notes.neq.SAMPLE_CATALOG_SEED'),
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
      gmvDelta: periodDelta(orders.data || []),
      pendingTopups: topups.count || 0, pendingWithdrawals: withdrawals.count || 0,
      pendingSubscriptions: subscriptions.count || 0, pendingRegistrations: registrations.count || 0, platformWallet: wallet.data?.balance || 0
    })
    setRevenueTrend(buildDailyTrend(orders.data || []))
    setRecentRegistrations(registrations.data || [])
    setLoading(false)
  }

  // Takes the date range as arguments (rather than reading leaderboardStart/
  // leaderboardEnd from closure) so callers can trigger a fetch with a range
  // that was just computed, before the corresponding setState has committed.
  const loadLeaderboards = async (startDate, endDate) => {
    setLeaderboardLoading(true)
    const [product, reseller, merchant] = await Promise.all([
      getTopProduct(startDate, endDate).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error })),
      getTopReseller(startDate, endDate).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error })),
      getTopMerchant(startDate, endDate).then((data) => ({ data, error: null })).catch((error) => ({ data: null, error }))
    ])
    const firstError = [product, reseller, merchant].find((result) => result.error)
    if (firstError) toast.error(firstError.error.message)
    setTopProduct(product.data)
    setTopReseller(reseller.data)
    setTopMerchant(merchant.data)
    setLeaderboardErrors({
      product: product.error,
      reseller: reseller.error,
      merchant: merchant.error
    })
    setLeaderboardLoading(false)
  }

  const actionCount = stats.pendingMerchants + stats.pendingTopups + stats.pendingWithdrawals + stats.pendingSubscriptions + stats.pendingRegistrations
  const metrics = [
    { label: 'Gross marketplace value', value: peso(stats.gmv), detail: `${stats.orders} non-cancelled orders`, icon: TrendingUp, tone: 'teal', to: '/admin/reports/sales', loading, delta: stats.gmvDelta ?? undefined, trend: revenueTrend.length > 1 ? revenueTrend : undefined },
    { label: 'Platform wallet', value: peso(stats.platformWallet), detail: 'Recorded platform revenue', icon: Wallet, tone: 'mango', to: '/admin/wallet', loading },
    { label: 'Active merchants', value: stats.approvedMerchants, detail: `${stats.merchants} total merchant accounts`, icon: Building2, tone: 'teal', to: '/admin/merchants', loading },
    { label: 'Registered resellers', value: stats.resellers, detail: 'Marketplace buyer network', icon: Users, tone: 'coral', to: '/admin', loading }
  ]
  const queues = [
    { label: 'Merchant applications', value: stats.pendingMerchants, icon: ShieldAlert, link: '/admin/merchants', color: 'text-coral-600 bg-coral-100 dark:bg-coral-500/15 dark:text-coral-300' },
    { label: 'Subscription payments', value: stats.pendingSubscriptions, icon: ClipboardCheck, link: '/admin/subscriptions', color: 'text-teal-700 bg-teal-50 dark:bg-teal-500/15 dark:text-teal-300' },
    { label: 'Wallet top-ups', value: stats.pendingTopups, icon: Banknote, link: '/admin/topups', color: 'text-mango-600 bg-mango-100 dark:bg-mango-500/15 dark:text-mango-300' },
    { label: 'Withdrawals', value: stats.pendingWithdrawals, icon: Landmark, link: '/admin/withdrawals', color: 'text-fg-muted bg-surface-inset' },
    { label: 'Schedule registrations', value: stats.pendingRegistrations, icon: CalendarDays, link: '/admin/registrations', color: 'text-teal-700 bg-teal-50 dark:bg-teal-500/15 dark:text-teal-300' }
  ]
  const nextAction = stats.pendingMerchants > 0 ? {title:'Review Merchant applications',description:`${stats.pendingMerchants} Merchant application${stats.pendingMerchants===1?'':'s'} require verification.`,to:'/admin/approval-center',action:'Open approvals'}
    : stats.pendingSubscriptions > 0 ? {title:'Verify subscription payments',description:`${stats.pendingSubscriptions} subscription payment${stats.pendingSubscriptions===1?'':'s'} are waiting for review.`,to:'/admin/subscriptions',action:'Review payments'}
    : stats.pendingTopups > 0 ? {title:'Verify wallet top-ups',description:`${stats.pendingTopups} top-up request${stats.pendingTopups===1?'':'s'} require payment matching.`,to:'/admin/topups',action:'Review top-ups'}
    : stats.pendingWithdrawals > 0 ? {title:'Schedule withdrawal payouts',description:`${stats.pendingWithdrawals} withdrawal request${stats.pendingWithdrawals===1?'':'s'} require review or scheduling.`,to:'/admin/withdrawals',action:'Open withdrawals'}
    : stats.pendingRegistrations > 0 ? {title:'Confirm registration schedules',description:`${stats.pendingRegistrations} appointment request${stats.pendingRegistrations===1?'':'s'} need confirmation.`,to:'/admin/registrations',action:'Open calendar'}
    : {title:'Review platform activity',description:'All approval queues are clear. Review the latest protected system changes.',to:'/admin/activity-log',action:'Open audit log',complete:true}

  return (
    <div className="mx-auto min-h-full max-w-7xl space-y-6 bg-bg px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Marketplace overview"
        description="Monitor operations, review account requests, and keep JOM HUB running smoothly."
        actions={<Button variant="secondary" size="sm" icon={RefreshCw} loading={loading} onClick={() => { load(); loadLeaderboards(leaderboardStart, leaderboardEnd) }}>Refresh</Button>}
      />

      {!loading && <NextActionCard {...nextAction} />}

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        {metrics.map((metric) => <StatCard key={metric.label} {...metric} />)}
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-fg">Top performers</h2>
            <p className="text-xs text-fg-muted">Ranked by total sales across the marketplace</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CalendarRange size={16} className="text-fg-muted" />
            <select
              value={leaderboardPeriod}
              onChange={(e) => {
                const period = e.target.value
                setLeaderboardPeriod(period)
                const range = period !== 'all' ? reportPeriodRange(period) : { start: null, end: null }
                setLeaderboardStart(range.start)
                setLeaderboardEnd(range.end)
                loadLeaderboards(range.start, range.end)
              }}
              className="input-field w-auto min-h-9 text-sm"
            >
              <option value="all">All time</option>
              {REPORT_PERIODS.filter((p) => p.value !== 'custom').map((period) => (
                <option key={period.value} value={period.value}>{period.label}</option>
              ))}
            </select>
            <input
              type="date"
              value={leaderboardStart || ''}
              onChange={(e) => setLeaderboardStart(e.target.value)}
              className="input-field w-auto min-h-9 text-sm"
            />
            <span className="text-xs text-fg-muted">to</span>
            <input
              type="date"
              value={leaderboardEnd || ''}
              onChange={(e) => setLeaderboardEnd(e.target.value)}
              className="input-field w-auto min-h-9 text-sm"
            />
            <Button variant="secondary" size="sm" icon={RefreshCw} loading={leaderboardLoading} onClick={() => loadLeaderboards(leaderboardStart, leaderboardEnd)}>Apply</Button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <LeaderboardCard
            title="Top Product"
            subtitle="Most units sold"
            icon={Package}
            loading={leaderboardLoading}
            error={leaderboardErrors.product}
            data={topProduct}
            onRetry={() => loadLeaderboards(leaderboardStart, leaderboardEnd)}
            image={topProduct?.image_url}
            name={topProduct?.product_name}
            emptyMessage="No product sales recorded yet."
            stats={[
              { label: 'Total sold', value: topProduct ? Number(topProduct.total_sold).toLocaleString('en-PH') : '—' },
              { label: 'Total revenue', value: topProduct ? peso(topProduct.total_revenue) : '—' }
            ]}
          />
          <LeaderboardCard
            title="Top Reseller"
            subtitle="Highest total sales"
            icon={UserRound}
            loading={leaderboardLoading}
            error={leaderboardErrors.reseller}
            data={topReseller}
            onRetry={() => loadLeaderboards(leaderboardStart, leaderboardEnd)}
            image={topReseller?.avatar_url}
            name={topReseller?.reseller_name}
            emptyMessage="No reseller sales recorded yet."
            stats={[
              { label: 'Total sales', value: topReseller ? peso(topReseller.total_sales) : '—' },
              { label: 'Total orders', value: topReseller ? Number(topReseller.total_orders).toLocaleString('en-PH') : '—' }
            ]}
          />
          <LeaderboardCard
            title="Top Merchant"
            subtitle="Highest total sales"
            icon={Store}
            loading={leaderboardLoading}
            error={leaderboardErrors.merchant}
            data={topMerchant}
            onRetry={() => loadLeaderboards(leaderboardStart, leaderboardEnd)}
            image={topMerchant?.logo_url}
            name={topMerchant?.merchant_name}
            emptyMessage="No merchant sales recorded yet."
            stats={[
              { label: 'Total sales', value: topMerchant ? peso(topMerchant.total_sales) : '—' },
              { label: 'Total orders', value: topMerchant ? Number(topMerchant.total_orders).toLocaleString('en-PH') : '—' }
            ]}
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <AnalyticsPanel
          title="Gross marketplace value"
          description="Last 14 days, non-cancelled orders"
          data={revenueTrend}
          valueFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
        />

        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-display font-bold text-fg">Approval queue</h2>
              <p className="mt-0.5 text-xs text-fg-muted">Items that may need your attention</p>
            </div>
            <Badge tone={actionCount ? 'danger' : 'success'}>{actionCount} pending</Badge>
          </div>
          <div className="divide-y divide-line">
            {queues.map(({ label, value, icon: Icon, link, color }) => (
              <Link key={label} to={link} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-teal-50/60 dark:hover:bg-teal-500/5 sm:px-6">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${color}`}><Icon size={19} /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-fg">{label}</p><p className="text-xs text-fg-muted">Open review workspace</p></div>
                <span className="font-mono text-xl font-bold tabular-nums text-fg">{loading ? '—' : value}</span>
                <ArrowRight size={16} className="text-fg-muted/60 transition group-hover:translate-x-1 group-hover:text-teal-600" />
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300"><CheckCircle2 size={20} /></span>
            <div><h2 className="font-display font-bold text-fg">Marketplace status</h2><p className="text-xs text-fg-muted">Live operational summary</p></div>
          </div>
          <div className="mt-6 space-y-5">
            <div>
              <div className="mb-2 flex justify-between text-xs"><span className="font-medium text-fg-muted">Merchant approval rate</span><span className="font-bold text-fg">{stats.merchants ? Math.round(stats.approvedMerchants / stats.merchants * 100) : 0}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-inset"><div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${stats.merchants ? stats.approvedMerchants / stats.merchants * 100 : 0}%` }} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link to="/admin/reports/ordered" className="rounded-xl bg-surface-inset p-4 transition hover:bg-teal-50 dark:hover:bg-teal-500/10"><ShoppingBag size={18} className="text-teal-600" /><p className="mt-3 text-xl font-bold text-fg">{stats.orders}</p><p className="text-xs text-fg-muted">Total orders</p></Link>
              <Link to="/admin/reports/sales" className="rounded-xl bg-surface-inset p-4 transition hover:bg-teal-50 dark:hover:bg-teal-500/10"><CircleDollarSign size={18} className="text-mango-600" /><p className="mt-3 text-xl font-bold text-fg">{stats.merchants + stats.resellers}</p><p className="text-xs text-fg-muted">Marketplace users</p></Link>
            </div>
          </div>
        </Card>

        <Card padded={false}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300"><Activity size={19} /></span>
              <div><h2 className="font-display font-bold text-fg">Recent schedule registrations</h2><p className="mt-0.5 text-xs text-fg-muted">Visitors waiting for admin contact</p></div>
            </div>
            <Link to="/admin/registrations" className="shrink-0 text-sm font-semibold text-teal-700 dark:text-teal-300">View all</Link>
          </div>
          {recentRegistrations.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-fg-muted">No pending registrations.</p>
          ) : (
            <div className="divide-y divide-line">
              {recentRegistrations.map((registration) => (
                <Link key={registration.id} to="/admin/registrations" className="flex flex-col gap-2 px-5 py-4 transition hover:bg-teal-50/50 dark:hover:bg-teal-500/5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div><p className="font-semibold text-fg">{registration.full_name}</p><p className="text-xs text-fg-muted">{registration.email} · {registration.phone}</p></div>
                  <p className="text-sm font-semibold text-teal-700 dark:text-teal-300">{new Date(`${registration.preferred_date}T${registration.preferred_time}`).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
