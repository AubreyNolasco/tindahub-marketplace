import { useEffect, useState } from 'react'
import { Download, PackageCheck, PhilippinePeso, ShoppingBag, Store, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { formatDate, peso, today, firstDayOfMonth } from '../../utils/format'
import { exportExcel } from '../../utils/excel'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

function downloadExcel(orders, startDate, endDate) {
  const rows = orders.flatMap((order) => (order.order_items || []).map((item) => [
    order.order_number, formatDate(order.created_at), order.status, order.merchant_profiles?.business_name || '',
    order.profiles?.full_name || '', order.profiles?.phone || '', order.customers?.name || '', order.customers?.phone || '',
    order.customers?.address || '', order.payments?.[0]?.method || '', order.payments?.[0]?.reference_number || '', order.payments?.[0]?.status || '', item.product_name, item.unit_price,
    item.quantity, item.line_total, order.subtotal, order.reseller_operation_fee, order.platform_fee,
    order.total, order.shipping_address || '', order.notes || ''
  ]))
  const headers = ['Order No.', 'Order Date', 'Status', 'Merchant', 'Reseller', 'Reseller Phone', 'Customer', 'Customer Phone', 'Customer Address', 'Payment Method', 'Payment Ref.', 'Payment Status', 'Product', 'Unit Price', 'Quantity', 'Line Total', 'Subtotal', 'Reseller 1% Fee', 'Merchant 3% Fee', 'Order Total', 'Shipping Address', 'Notes']
  exportExcel(`jom-hub-sales-${startDate}-to-${endDate}.xls`, 'Sales Report', headers, rows)
}

export default function Sales() {
  const [startDate, setStartDate] = useState(firstDayOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    if (startDate > endDate) return toast.error('The start date must be earlier than or equal to the end date.')
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), merchant_profiles(business_name), profiles!orders_reseller_id_fkey(full_name, phone), customers(name, phone, address), payments(method, reference_number, status)')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59.999`)
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setOrders(data || [])
    setLoading(false)
  }

  const activeOrders = orders.filter((order) => order.status !== 'cancelled')
  const completedOrders = orders.filter((order) => order.status === 'completed')
  const gmv = activeOrders.reduce((sum, order) => sum + Number(order.total), 0)
  const resellerFees = activeOrders.reduce((sum, order) => sum + Number(order.reseller_operation_fee || 0), 0)
  const merchantFees = activeOrders.reduce((sum, order) => sum + Number(order.platform_fee || 0), 0)
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
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div><h1 className="font-display font-bold text-2xl text-ink">Sales Dashboard</h1><p className="text-ink/60">Sales summary and order report by order date.</p></div>
        <button onClick={() => downloadExcel(orders, startDate, endDate)} disabled={!orders.length} className="btn-secondary text-sm flex items-center gap-1.5"><Download size={16} /> Download Excel</button>
      </div>

      <div className="card p-4 mb-6 flex flex-wrap gap-3 items-end">
        <label className="text-sm font-medium text-ink">From<input type="date" className="input-field mt-1" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label className="text-sm font-medium text-ink">To<input type="date" className="input-field mt-1" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <button onClick={load} className="btn-primary text-sm">Apply date</button>
      </div>

      {loading ? <div className="flex justify-center py-24"><Spinner /></div> : <>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">{cards.map((card) => <div key={card.label} className="card p-5"><card.icon className="text-teal-500 mb-3" size={22} /><p className="text-2xl font-display font-bold text-ink">{card.value}</p><p className="text-sm text-ink/60">{card.label}</p></div>)}</div>
        <h2 className="font-semibold text-ink mb-3">Orders</h2>
        {orders.length === 0 ? <EmptyState icon={ShoppingBag} title="No orders in this date range" /> : <div className="space-y-3">{orders.map((order) => <div key={order.id} className="card p-4 flex justify-between gap-4 flex-wrap"><div><p className="font-mono text-sm text-ink/70">{order.order_number}</p><p className="font-medium text-ink">{order.merchant_profiles?.business_name} · {order.profiles?.full_name || 'Reseller'}</p><p className="text-xs text-ink/50">{formatDate(order.created_at)} · {order.order_items?.length || 0} item(s) · {order.status}</p></div><div className="text-right"><p className="font-semibold text-ink">{peso(order.total)}</p><p className="text-xs text-teal-700">Fees: {peso(Number(order.reseller_operation_fee || 0) + Number(order.platform_fee || 0))}</p></div></div>)}</div>}
      </>}
    </div>
  )
}
