import { useCallback, useEffect, useState } from 'react'
import { PackageCheck, PhilippinePeso, ShoppingBag, Store, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { formatDate, peso, today, firstDayOfMonth } from '../../utils/format'
import { exportExcel } from '../../utils/excel'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import ReportToolbar from '../../components/reports/ReportToolbar'
import SummaryCards from '../../components/reports/SummaryCards'
import { dateStart, nextDateStart, reportPeriodLabel } from '../../utils/reportDates'

function downloadExcel(orders, startDate, endDate) {
  const rows = orders.flatMap((order) => (order.order_items || []).map((item) => [
    order.order_number, formatDate(order.created_at), order.status, order.merchant_profiles?.business_name || '',
    order.profiles?.full_name || '', order.profiles?.phone || '', order.customers?.name || '', order.customers?.phone || '',
    order.customers?.address || '', order.payments?.[0]?.method || '', order.payments?.[0]?.reference_number || '', order.payments?.[0]?.status || '', item.product_name, item.unit_price,
    item.quantity, item.line_total, order.subtotal, order.reseller_operation_fee, order.platform_fee,
    order.total, order.shipping_address || '', order.notes || ''
  ]))
  const headers = ['Order No.', 'Order Date', 'Status', 'Merchant', 'Reseller', 'Reseller Phone', 'Customer', 'Customer Phone', 'Customer Address', 'Payment Method', 'Payment Ref.', 'Payment Status', 'Product', 'Unit Price', 'Quantity', 'Line Total', 'Subtotal', 'Reseller 1% Fee', 'Merchant 3% Fee', 'Order Total', 'Shipping Address', 'Notes']
  exportExcel(`jom-hub-admin-sales-dashboard-${startDate}-to-${endDate}.xls`, 'Sales Report', headers, rows, { title: 'Admin Sales Dashboard', period: reportPeriodLabel(startDate, endDate), scope: 'admin' })
}

export default function Sales() {
  const [startDate, setStartDate] = useState(firstDayOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [appliedRange, setAppliedRange] = useState({ start: firstDayOfMonth(), end: today() })

  const load = useCallback(async (rangeStart = startDate, rangeEnd = endDate) => {
    if (rangeStart > rangeEnd) return toast.error('The start date must be earlier than or equal to the end date.')
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), merchant_profiles(business_name), profiles!orders_reseller_id_fkey(full_name, phone), customers(name, phone, address), payments(method, reference_number, status)')
      .gte('created_at', dateStart(rangeStart))
      .lt('created_at', nextDateStart(rangeEnd))
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    // admin_seed_sample_catalog() plants real 'completed' orders (notes=
    // 'SAMPLE_CATALOG_SEED') so the demo catalog shows a sold count --
    // excluded here so this dashboard's GMV/fee totals reflect real
    // transactions only.
    setOrders((data || []).filter((order) => order.notes !== 'SAMPLE_CATALOG_SEED'))
    if (!error) setAppliedRange({ start: rangeStart, end: rangeEnd })
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startDate/endDate are only defaults for the initial mount call; onApply always passes explicit dates
  }, [])

  useEffect(() => { load() }, [load])

  const activeOrders = orders.filter((order) => order.status !== 'cancelled')
  const completedOrders = orders.filter((order) => order.status === 'completed')
  const gmv = activeOrders.reduce((sum, order) => sum + Number(order.subtotal), 0)
  const resellerFees = activeOrders.reduce((sum, order) => sum + Number(order.reseller_operation_fee || 0), 0)
  const merchantFees = completedOrders.reduce((sum, order) => sum + Number(order.platform_fee || 0), 0)
  const merchantCount = new Set(orders.map((order) => order.merchant_id)).size
  const resellerCount = new Set(orders.map((order) => order.reseller_id)).size
  const cards = [
    { label: 'Sales / GMV', value: peso(gmv), icon: PhilippinePeso },
    { label: 'Completed Orders', value: completedOrders.length, icon: PackageCheck },
    { label: 'Total Orders', value: orders.length, icon: ShoppingBag },
    { label: 'Merchants with Orders', value: merchantCount, icon: Store },
    { label: 'Resellers with Orders', value: resellerCount, icon: Users },
    { label: 'Platform Fees', value: peso(resellerFees + merchantFees), icon: PhilippinePeso }
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <ReportToolbar title="Sales Dashboard" subtitle="Platform sales summary and order report by order date." startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} onApply={() => load(startDate, endDate)} onDownload={() => downloadExcel(orders, appliedRange.start, appliedRange.end)} downloadDisabled={!orders.length} appliedStartDate={appliedRange.start} appliedEndDate={appliedRange.end} recordCount={orders.length} />

      {loading ? <div className="flex justify-center py-24"><Spinner /></div> : <>
        <SummaryCards cards={cards} />
        <h2 className="font-semibold text-ink mb-3">Orders</h2>
        {orders.length === 0 ? <EmptyState icon={ShoppingBag} title="No orders in this date range" /> : <div className="space-y-3">{orders.map((order) => <div key={order.id} className="card p-4 flex justify-between gap-4 flex-wrap"><div><p className="font-mono text-sm text-ink/70">{order.order_number}</p><p className="font-medium text-ink">{order.merchant_profiles?.business_name} · {order.profiles?.full_name || 'Reseller'}</p><p className="text-xs text-ink/50">{formatDate(order.created_at)} · {order.order_items?.length || 0} item(s) · {order.status}</p></div><div className="text-right"><p className="font-semibold text-ink">{peso(order.total)}</p><p className="text-xs text-teal-700">Fees: {peso(Number(order.reseller_operation_fee || 0) + Number(order.platform_fee || 0))}</p></div></div>)}</div>}
      </>}
    </div>
  )
}
