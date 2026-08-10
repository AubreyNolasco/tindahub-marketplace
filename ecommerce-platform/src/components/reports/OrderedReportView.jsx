import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Boxes, PhilippinePeso, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso, formatDate, today, firstDayOfMonth, ORDER_STATUS_STYLES, ORDER_STATUS_LABELS } from '../../utils/format'
import { exportExcel } from '../../utils/excel'
import EmptyState from '../ui/EmptyState'
import Spinner from '../ui/Spinner'
import ReportToolbar from './ReportToolbar'
import SummaryCards from './SummaryCards'
import { dateStart, nextDateStart, reportPeriodLabel } from '../../utils/reportDates'

const MERCHANT_SELECT = '*, order_items(*), profiles!orders_reseller_id_fkey(full_name)'
const RESELLER_SELECT = '*, order_items(*), merchant_profiles(business_name)'
const ADMIN_SELECT = '*, order_items(*), merchant_profiles(business_name), profiles!orders_reseller_id_fkey(full_name)'

function flattenLines(role, orders) {
  return orders.flatMap((order) => (order.order_items || []).map((item) => ({
    order,
    item,
    counterpart: role === 'merchant' ? (order.profiles?.full_name || 'Reseller') : role === 'admin' ? `${order.merchant_profiles?.business_name || 'Merchant'} / ${order.profiles?.full_name || 'Reseller'}` : (order.merchant_profiles?.business_name || 'Merchant')
  })))
}

function downloadExcel(role, lines, startDate, endDate) {
  const headers = ['Order No.', 'Order Date', 'Status', role === 'admin' ? 'Merchant / Reseller' : role === 'merchant' ? 'Reseller' : 'Merchant', 'Product', 'Unit Price', 'Quantity', 'Line Total']
  const rows = lines.map(({ order, item, counterpart }) => [
    order.order_number, formatDate(order.created_at), order.status, counterpart, item.product_name, item.unit_price, item.quantity, item.line_total
  ])
  exportExcel(`jom-hub-${role}-ordered-${startDate}-to-${endDate}.xls`, 'Ordered Report', headers, rows, { title: 'Ordered Report', period: reportPeriodLabel(startDate, endDate), scope: role })
}

export default function OrderedReportView({ role }) {
  const { user } = useAuth()
  const [startDate, setStartDate] = useState(firstDayOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [appliedRange, setAppliedRange] = useState({ start: firstDayOfMonth(), end: today() })

  const load = useCallback(async (rangeStart = startDate, rangeEnd = endDate) => {
    if (rangeStart > rangeEnd) return toast.error('The start date must be before or the same as the end date.')
    setLoading(true)
    let query = supabase
      .from('orders')
      .select(role === 'merchant' ? MERCHANT_SELECT : role === 'admin' ? ADMIN_SELECT : RESELLER_SELECT)
      .gte('created_at', dateStart(rangeStart))
      .lt('created_at', nextDateStart(rangeEnd))
      .order('created_at', { ascending: false })
    if (role !== 'admin') query = query.eq(role === 'merchant' ? 'merchant_id' : 'reseller_id', user.id)
    const { data, error } = await query
    if (error) toast.error(error.message)
    // admin_seed_sample_catalog() plants real 'completed' orders (notes=
    // 'SAMPLE_CATALOG_SEED') so the demo catalog shows a sold count --
    // excluded here so this report's totals reflect real transactions
    // only (same fix as Admin/Sales.jsx, AdminDashboard.jsx, etc).
    setOrders((data || []).filter((order) => order.notes !== 'SAMPLE_CATALOG_SEED'))
    if (!error) setAppliedRange({ start: rangeStart, end: rangeEnd })
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startDate/endDate are only defaults for the initial mount call; onApply always passes explicit dates
  }, [role, user])

  useEffect(() => { load() }, [load])

  const lines = flattenLines(role, orders)
  const totalUnits = lines.reduce((sum, l) => sum + Number(l.item.quantity), 0)
  const totalAmount = lines.reduce((sum, l) => sum + Number(l.item.line_total), 0)
  const distinctProducts = new Set(lines.map((l) => l.item.product_name)).size

  const cards = [
    { label: 'Total Line Items', value: lines.length, icon: ClipboardList },
    { label: 'Total Units Ordered', value: totalUnits, icon: Boxes },
    { label: 'Total Line Amount', value: peso(totalAmount), icon: PhilippinePeso },
    { label: 'Distinct Products', value: distinctProducts, icon: Layers }
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <ReportToolbar
        title="Ordered Report"
        subtitle="Product-level breakdown of every order line in this date range."
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={() => load(startDate, endDate)}
        onDownload={() => downloadExcel(role, lines, appliedRange.start, appliedRange.end)}
        downloadDisabled={!lines.length}
        appliedStartDate={appliedRange.start}
        appliedEndDate={appliedRange.end}
        recordCount={lines.length}
      />

      {loading ? <div className="flex justify-center py-24"><Spinner /></div> : <>
        <SummaryCards cards={cards} />
        <h2 className="font-semibold text-ink mb-3">Order Lines</h2>
        {lines.length === 0 ? <EmptyState icon={ClipboardList} title="No order lines in this date range" /> : (
          <div className="card overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-teal-50 text-ink/60 text-left dark:bg-teal-500/10">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Order No.</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">{role === 'admin' ? 'Merchant / Reseller' : role === 'merchant' ? 'Reseller' : 'Merchant'}</th>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium text-right">Qty</th>
                  <th className="px-4 py-2.5 font-medium text-right">Unit Price</th>
                  <th className="px-4 py-2.5 font-medium text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {lines.map(({ order, item, counterpart }) => (
                  <tr key={item.id} className="border-t border-black/5">
                    <td className="px-4 py-2.5 font-mono text-xs text-ink/70">{order.order_number}</td>
                    <td className="px-4 py-2.5 text-ink/70">{formatDate(order.created_at)}</td>
                    <td className="px-4 py-2.5"><span className={`badge ${ORDER_STATUS_STYLES[order.status]}`}>{ORDER_STATUS_LABELS[order.status]}</span></td>
                    <td className="px-4 py-2.5 text-ink/70">{counterpart}</td>
                    <td className="px-4 py-2.5 text-ink font-medium">{item.product_name}</td>
                    <td className="px-4 py-2.5 text-right text-ink/70">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right text-ink/70">{peso(item.unit_price)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-ink">{peso(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>}
    </div>
  )
}
