import { useCallback, useEffect, useState } from 'react'
import { Megaphone, PackageCheck, PhilippinePeso, ShoppingBag, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { peso, today, firstDayOfMonth } from '../../../utils/format'
import { exportExcel } from '../../../utils/excel'
import { dateStart, nextDateStart, reportPeriodLabel } from '../../../utils/reportDates'
import EmptyState from '../../../components/ui/EmptyState'
import Spinner from '../../../components/ui/Spinner'
import ReportToolbar from '../../../components/reports/ReportToolbar'
import SummaryCards from '../../../components/reports/SummaryCards'
import DataTable from '../../../components/ui/DataTable'

// Phase 13 of TASK6.md. Exact attribution became possible once Phase 9
// wired place_order() to stamp order_items.campaign_id at the moment of
// sale -- see TASK6.md's "Note on campaign performance view" for why
// this couldn't have been built accurately before that (an order placed
// on a product that happened to also be in a second, unrelated campaign
// at the same time would have been misattributed by any date-range-only
// join). Estimated discount uses the product's *current* price as the
// "regular price" baseline, same simplification the rest of this app's
// reports already make (no historical price snapshot exists) -- so it's
// an estimate if a product's price has since changed, not exact to the
// peso for every historical order.
export default function CampaignPerformanceReport() {
  const [startDate, setStartDate] = useState(firstDayOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [appliedRange, setAppliedRange] = useState({ start: firstDayOfMonth(), end: today() })

  const load = useCallback(async (rangeStart = startDate, rangeEnd = endDate) => {
    if (rangeStart > rangeEnd) return toast.error('The start date must be before or the same as the end date.')
    setLoading(true)
    const { data, error } = await supabase
      .from('order_items')
      .select('id, quantity, unit_price, line_total, order_id, campaign_id, campaigns(name), products(price, merchant_id, merchant_profiles(business_name)), orders!inner(created_at, status)')
      .not('campaign_id', 'is', null)
      .gte('orders.created_at', dateStart(rangeStart))
      .lt('orders.created_at', nextDateStart(rangeEnd))
      .neq('orders.status', 'cancelled')
    if (error) toast.error(error.message)
    setRows(data || [])
    if (!error) setAppliedRange({ start: rangeStart, end: rangeEnd })
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startDate/endDate are only defaults for the initial mount call; onApply always passes explicit dates
  }, [])
  useEffect(() => { load() }, [load])

  const campaigns = Object.values(rows.reduce((map, item) => {
    const id = item.campaign_id
    const regularPrice = Number(item.products?.price || 0)
    const discount = Math.max(0, regularPrice - Number(item.unit_price)) * item.quantity
    if (!map[id]) map[id] = { id, name: item.campaigns?.name || 'Deleted campaign', orders: new Set(), units: 0, revenue: 0, discount: 0, merchants: new Set() }
    map[id].orders.add(item.order_id)
    map[id].units += item.quantity
    map[id].revenue += Number(item.line_total)
    map[id].discount += discount
    if (item.products?.merchant_profiles?.business_name) map[id].merchants.add(item.products.merchant_profiles.business_name)
    return map
  }, {}))
    .map((c) => ({ ...c, orders: c.orders.size, merchants: [...c.merchants].join(', ') }))
    .sort((a, b) => b.revenue - a.revenue)

  const totalRevenue = campaigns.reduce((sum, c) => sum + c.revenue, 0)
  const totalDiscount = campaigns.reduce((sum, c) => sum + c.discount, 0)
  const totalOrders = new Set(rows.map((r) => r.order_id)).size
  const totalUnits = campaigns.reduce((sum, c) => sum + c.units, 0)

  const cards = [
    { label: 'Campaign Revenue', value: peso(totalRevenue), icon: PhilippinePeso },
    { label: 'Estimated Discount Given', value: peso(totalDiscount), icon: Tag },
    { label: 'Orders With a Campaign Item', value: totalOrders, icon: ShoppingBag },
    { label: 'Units Sold on Campaign', value: totalUnits, icon: PackageCheck }
  ]

  const download = () => {
    const exportRows = campaigns.map((c) => [c.name, c.merchants, c.orders, c.units, peso(c.revenue), peso(c.discount)])
    exportExcel(`jom-hub-campaign-performance-${appliedRange.start}-to-${appliedRange.end}.xls`, 'Campaign Performance',
      ['Campaign', 'Merchant(s)', 'Orders', 'Units Sold', 'Revenue', 'Estimated Discount Given'], exportRows,
      { title: 'Campaign Performance Report', period: reportPeriodLabel(appliedRange.start, appliedRange.end) })
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <ReportToolbar
        title="Campaign Performance Report"
        subtitle="Revenue and discount attribution by campaign, using each order item's stamped campaign at the moment of sale."
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={() => load(startDate, endDate)}
        onDownload={download}
        downloadDisabled={!campaigns.length}
        appliedStartDate={appliedRange.start}
        appliedEndDate={appliedRange.end}
        recordCount={campaigns.length}
      />

      {loading ? <div className="flex justify-center py-24"><Spinner /></div> : <>
        <SummaryCards cards={cards} />
        {campaigns.length === 0 ? <EmptyState icon={Megaphone} title="No campaign sales in this date range" message="Orders placed while a campaign price was active will show up here." /> : (
          <DataTable
            columns={[
              { header: 'Campaign', accessor: 'name' },
              { header: 'Merchant(s)', accessor: 'merchants', sortable: false },
              { header: 'Orders', accessor: 'orders' },
              { header: 'Units Sold', accessor: 'units' },
              { header: 'Revenue', accessor: 'revenue', format: 'currency' },
              { header: 'Est. Discount Given', accessor: 'discount', format: 'currency' }
            ]}
            data={campaigns}
            searchable={false}
            pageSize={20}
            emptyTitle="No campaign sales"
            emptyMessage="No campaign sales in this date range."
          />
        )}
      </>}
    </div>
  )
}
