import { useEffect, useState } from 'react'
import { PackageCheck, PhilippinePeso, ShoppingBag, Store, Users, Hourglass } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso, formatDate, today, firstDayOfMonth, ORDER_STATUS_STYLES, ORDER_STATUS_LABELS } from '../../utils/format'
import { exportExcel } from '../../utils/excel'
import EmptyState from '../ui/EmptyState'
import Spinner from '../ui/Spinner'
import ReportToolbar from './ReportToolbar'
import SummaryCards from './SummaryCards'

const MERCHANT_SELECT = '*, order_items(*), payments(method, reference_number, status), profiles!orders_reseller_id_fkey(full_name, phone)'
const RESELLER_SELECT = '*, order_items(*), merchant_profiles(business_name), customers(name, phone, address)'
const ADMIN_SELECT = '*, order_items(*), merchant_profiles(business_name), profiles!orders_reseller_id_fkey(full_name, phone), payments(method, reference_number, status)'

function downloadExcel(role, orders, startDate, endDate) {
  const rows = orders.flatMap((order) => (order.order_items || []).map((item) => {
    const common = [order.order_number, formatDate(order.created_at), order.status]
    const roleCols = role === 'merchant'
      ? [order.profiles?.full_name || '', order.profiles?.phone || '', order.payments?.[0]?.method || '', order.payments?.[0]?.reference_number || '', order.payments?.[0]?.status || '']
      : role === 'admin'
        ? [order.merchant_profiles?.business_name || '', order.profiles?.full_name || '', order.payments?.[0]?.method || '', order.payments?.[0]?.status || '']
      : [order.merchant_profiles?.business_name || '', order.customers?.name || '', order.customers?.phone || '', order.customers?.address || '']
    const feeCols = role === 'admin' ? [order.reseller_operation_fee,order.platform_fee] : [role === 'merchant' ? order.platform_fee : order.reseller_operation_fee]
    return [
      ...common, ...roleCols, item.product_name, item.unit_price, item.quantity, item.line_total,
      order.subtotal, order.shipping_payment_method === 'receiver_pays_on_delivery' ? (order.actual_shipping_fee ?? 'Paid to courier') : (order.shipping_fee || 0), order.delivery_provider || order.shipping_vehicle || '', order.tracking_number || '', ...feeCols, order.total, order.shipping_address || '', order.notes || ''
    ]
  }))
  const headers = role === 'merchant'
      ? ['Order No.', 'Order Date', 'Status', 'Reseller', 'Reseller Phone', 'Payment Method', 'Payment Ref.', 'Payment Status', 'Product', 'Unit Price', 'Quantity', 'Line Total', 'Subtotal', 'Actual Shipping Fee', 'Delivery Provider', 'Tracking Number', 'Merchant 3% Fee', 'Wallet Order Total', 'Shipping Address', 'Notes']
    : role === 'admin'
      ? ['Order No.', 'Order Date', 'Status', 'Merchant', 'Reseller', 'Payment Method', 'Payment Status', 'Product', 'Unit Price', 'Quantity', 'Line Total', 'Subtotal', 'Actual Shipping Fee', 'Delivery Provider', 'Tracking Number', 'Reseller 1% Fee', 'Merchant 3% Fee', 'Wallet Order Total', 'Shipping Address', 'Notes']
      : ['Order No.', 'Order Date', 'Status', 'Merchant', 'Customer', 'Customer Phone', 'Customer Address', 'Product', 'Unit Price', 'Quantity', 'Line Total', 'Subtotal', 'Actual Shipping Fee', 'Delivery Provider', 'Tracking Number', 'Reseller 1% Fee', 'Wallet Order Total', 'Shipping Address', 'Notes']
  exportExcel(`jom-hub-${role}-sales-${startDate}-to-${endDate}.xls`, 'Sales Report', headers, rows)
}

export default function SalesReportView({ role }) {
  const { user } = useAuth()
  const [startDate, setStartDate] = useState(firstDayOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    if (startDate > endDate) return toast.error('The start date must be before or the same as the end date.')
    setLoading(true)
    let query = supabase
      .from('orders')
      .select(role === 'merchant' ? MERCHANT_SELECT : role === 'admin' ? ADMIN_SELECT : RESELLER_SELECT)
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59.999`)
      .order('created_at', { ascending: false })
    if (role !== 'admin') query = query.eq(role === 'merchant' ? 'merchant_id' : 'reseller_id', user.id)
    const { data, error } = await query
    if (error) toast.error(error.message)
    setOrders(data || [])
    setLoading(false)
  }

  const activeOrders = orders.filter((order) => order.status !== 'cancelled')
  const completedOrders = orders.filter((order) => order.status === 'completed')
  const pendingOrders = orders.filter((order) => !['completed', 'cancelled'].includes(order.status))
  const totalValue = activeOrders.reduce((sum, order) => sum + Number(role === 'reseller' ? order.total : order.subtotal), 0)
  const fees = role === 'admin' ? activeOrders.reduce((sum,order)=>sum+Number(order.reseller_operation_fee||0),0)+completedOrders.reduce((sum,order)=>sum+Number(order.platform_fee||0),0) : role === 'merchant' ? completedOrders.reduce((sum,order)=>sum+Number(order.platform_fee||0),0) : activeOrders.reduce((sum,order)=>sum+Number(order.reseller_operation_fee||0),0)
  const counterpartCount = new Set(orders.flatMap((order) => role === 'admin' ? [order.reseller_id, order.merchant_id] : [role === 'merchant' ? order.reseller_id : order.merchant_id])).size

  const cards = [
    { label: role === 'admin' ? 'Platform GMV' : role === 'merchant' ? 'Total Sales Value' : 'Total Order Value', value: peso(totalValue), icon: PhilippinePeso },
    { label: 'Completed Orders', value: completedOrders.length, icon: PackageCheck },
    { label: 'Pending Orders', value: pendingOrders.length, icon: Hourglass },
    { label: 'Total Orders', value: orders.length, icon: ShoppingBag },
    { label: role === 'admin' ? 'Platform Participants' : role === 'merchant' ? 'Resellers Served' : 'Merchants Ordered From', value: counterpartCount, icon: role === 'merchant' ? Users : Store },
    { label: role === 'admin' ? 'Platform Fees' : role === 'merchant' ? 'Merchant Fees Paid' : 'Reseller Fees Paid', value: peso(fees), icon: PhilippinePeso }
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <ReportToolbar
        title="Sales Report"
        subtitle="Sales summary and order report by order date."
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={load}
        onDownload={() => downloadExcel(role, orders, startDate, endDate)}
        downloadDisabled={!orders.length}
      />

      {loading ? <div className="flex justify-center py-24"><Spinner /></div> : <>
        <SummaryCards cards={cards} />
        <h2 className="font-semibold text-ink mb-3">Orders</h2>
        {orders.length === 0 ? <EmptyState icon={ShoppingBag} title="No orders in this date range" /> : (
          <div className="space-y-3">
            {orders.map((order) => {
              const fee = role==='admin' ? Number(order.reseller_operation_fee||0)+(order.status==='completed'?Number(order.platform_fee||0):0) : Number((role === 'merchant' ? (order.status==='completed'?order.platform_fee:0) : order.reseller_operation_fee) || 0)
              const counterpartName = role === 'merchant' ? (order.profiles?.full_name || 'Reseller') : role === 'admin' ? `${order.merchant_profiles?.business_name || 'Merchant'} / ${order.profiles?.full_name || 'Reseller'}` : (order.merchant_profiles?.business_name || 'Merchant')
              return (
                <div key={order.id} className="card p-4 flex justify-between gap-4 flex-wrap">
                  <div>
                    <p className="font-mono text-sm text-ink/70">{order.order_number}</p>
                    <p className="font-medium text-ink">{counterpartName}</p>
                    <p className="text-xs text-ink/50">{formatDate(order.created_at)} · {order.order_items?.length || 0} item(s) · <span className={`badge ${ORDER_STATUS_STYLES[order.status]}`}>{ORDER_STATUS_LABELS[order.status]}</span></p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-ink">{peso(order.total)}</p>
                    <p className="text-xs text-teal-700">Fee: {peso(fee)}</p>
                    <p className="text-xs text-ink/50">Shipping: {order.shipping_payment_method === 'receiver_pays_on_delivery' ? `${order.actual_shipping_fee!=null?peso(order.actual_shipping_fee):'Amount pending'} paid to courier` : peso(order.shipping_fee || 0)} {order.delivery_provider ? `· ${order.delivery_provider}` : ''}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </>}
    </div>
  )
}
