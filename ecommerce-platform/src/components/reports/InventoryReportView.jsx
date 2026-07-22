import { useEffect, useState } from 'react'
import { Package, Boxes, PhilippinePeso, AlertTriangle, XCircle, Store } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso, formatDate, today, firstDayOfMonth } from '../../utils/format'
import { exportExcel } from '../../utils/excel'
import EmptyState from '../ui/EmptyState'
import Spinner from '../ui/Spinner'
import ReportToolbar from './ReportToolbar'
import SummaryCards from './SummaryCards'

const LOW_STOCK_THRESHOLD = 5

function downloadMerchantExcel(products, role) {
  const headers = [...(role === 'admin' ? ['Merchant'] : []), 'Product', 'SKU', 'Price', 'Wholesale Price', 'Stock Qty', 'Inventory Value', 'Status']
  const rows = products.map((p) => [
    ...(role === 'admin' ? [p.merchant_profiles?.business_name || p.merchant_id] : []),
    p.name, p.sku || '', p.price, p.wholesale_price || '', p.stock_quantity, Number(p.price) * Number(p.stock_quantity),
    p.is_active ? 'Active' : 'Hidden'
  ])
  exportExcel(`jom-hub-${role}-inventory-${today()}.xls`, 'Inventory Report', headers, rows)
}

function downloadResellerExcel(rows, startDate, endDate) {
  const headers = ['Product', 'Merchant', 'Total Qty Purchased', 'Total Spent', 'Orders', 'Last Order Date']
  const excelRows = rows.map((r) => [r.product, r.merchant, r.totalQty, r.totalSpent, r.orderCount, formatDate(r.lastOrderDate)])
  exportExcel(`jom-hub-reseller-inventory-${startDate}-to-${endDate}.xls`, 'Inventory Report', headers, excelRows)
}

function stockBadge(qty) {
  if (qty <= 0) return <span className="badge bg-coral-100 text-coral-600">Out of Stock</span>
  if (qty <= LOW_STOCK_THRESHOLD) return <span className="badge bg-mango-100 text-mango-600">Low Stock</span>
  return <span className="badge bg-teal-100 text-teal-700">In Stock</span>
}

function MerchantInventory({ user, role }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    let query = supabase
      .from('products')
      .select(role === 'admin' ? '*, merchant_profiles(business_name)' : '*')
      .order('name', { ascending: true })
    if (role !== 'admin') query = query.eq('merchant_id', user.id)
    const { data, error } = await query
    if (error) toast.error(error.message)
    setProducts(data || [])
    setLoading(false)
  }

  const totalStock = products.reduce((sum, p) => sum + Number(p.stock_quantity), 0)
  const totalValue = products.reduce((sum, p) => sum + Number(p.price) * Number(p.stock_quantity), 0)
  const lowStock = products.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= LOW_STOCK_THRESHOLD).length
  const outOfStock = products.filter((p) => p.stock_quantity <= 0).length

  const cards = [
    { label: 'Total Products', value: products.length, icon: Package },
    { label: 'Active Products', value: products.filter((p) => p.is_active).length, icon: Boxes },
    { label: 'Total Stock Units', value: totalStock, icon: Boxes },
    { label: 'Total Inventory Value', value: peso(totalValue), icon: PhilippinePeso },
    { label: 'Low Stock', value: lowStock, icon: AlertTriangle },
    { label: 'Out of Stock', value: outOfStock, icon: XCircle }
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <ReportToolbar
        title="Inventory Report"
        subtitle={role === 'admin' ? 'Platform-wide live snapshot of merchant product stock and value.' : 'Live snapshot of your product stock and value.'}
        showDateRange={false}
        onDownload={() => downloadMerchantExcel(products, role)}
        downloadDisabled={!products.length}
      />

      {loading ? <div className="flex justify-center py-24"><Spinner /></div> : <>
        <SummaryCards cards={cards} />
        <h2 className="font-semibold text-ink mb-3">Products</h2>
        {products.length === 0 ? <EmptyState icon={Package} title="No products yet" /> : (
          <div className="card overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-teal-50 text-ink/60 text-left">
                <tr>
                  {role === 'admin' && <th className="px-4 py-2.5 font-medium">Merchant</th>}
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium">SKU</th>
                  <th className="px-4 py-2.5 font-medium text-right">Price</th>
                  <th className="px-4 py-2.5 font-medium text-right">Stock Qty</th>
                  <th className="px-4 py-2.5 font-medium text-right">Value</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-black/5">
                    {role === 'admin' && <td className="px-4 py-2.5 text-ink/70">{p.merchant_profiles?.business_name || p.merchant_id}</td>}
                    <td className="px-4 py-2.5 text-ink font-medium">{p.name}</td>
                    <td className="px-4 py-2.5 text-ink/60">{p.sku || '—'}</td>
                    <td className="px-4 py-2.5 text-right text-ink/70">{peso(p.price)}</td>
                    <td className="px-4 py-2.5 text-right text-ink/70">{p.stock_quantity}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-ink">{peso(Number(p.price) * Number(p.stock_quantity))}</td>
                    <td className="px-4 py-2.5">{stockBadge(p.stock_quantity)}</td>
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

function ResellerInventory({ user }) {
  const [startDate, setStartDate] = useState(firstDayOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    if (startDate > endDate) return toast.error('The start date must be before or the same as the end date.')
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('id, created_at, merchant_profiles(business_name), order_items(product_name, quantity, line_total)')
      .eq('reseller_id', user.id)
      .neq('status', 'cancelled')
      .gte('created_at', `${startDate}T00:00:00`)
      .lte('created_at', `${endDate}T23:59:59.999`)
    if (error) toast.error(error.message)

    const grouped = {}
    for (const order of data || []) {
      const merchant = order.merchant_profiles?.business_name || 'Merchant'
      for (const item of order.order_items || []) {
        const key = `${item.product_name}__${merchant}`
        if (!grouped[key]) {
          grouped[key] = { product: item.product_name, merchant, totalQty: 0, totalSpent: 0, orderIds: new Set(), lastOrderDate: order.created_at }
        }
        grouped[key].totalQty += Number(item.quantity)
        grouped[key].totalSpent += Number(item.line_total)
        grouped[key].orderIds.add(order.id)
        if (new Date(order.created_at) > new Date(grouped[key].lastOrderDate)) grouped[key].lastOrderDate = order.created_at
      }
    }
    const aggregated = Object.values(grouped)
      .map((g) => ({ ...g, orderCount: g.orderIds.size }))
      .sort((a, b) => b.totalSpent - a.totalSpent)

    setRows(aggregated)
    setLoading(false)
  }

  const totalQty = rows.reduce((sum, r) => sum + r.totalQty, 0)
  const totalSpent = rows.reduce((sum, r) => sum + r.totalSpent, 0)
  const merchantCount = new Set(rows.map((r) => r.merchant)).size

  const cards = [
    { label: 'Products Stocked', value: rows.length, icon: Package },
    { label: 'Total Units Purchased', value: totalQty, icon: Boxes },
    { label: 'Total Amount Spent', value: peso(totalSpent), icon: PhilippinePeso },
    { label: 'Merchants Sourced From', value: merchantCount, icon: Store }
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <ReportToolbar
        title="Inventory Report"
        subtitle="Products you've stocked up on from merchants in this date range."
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={load}
        onDownload={() => downloadResellerExcel(rows, startDate, endDate)}
        downloadDisabled={!rows.length}
      />

      {loading ? <div className="flex justify-center py-24"><Spinner /></div> : <>
        <SummaryCards cards={cards} />
        <h2 className="font-semibold text-ink mb-3">Stocked Products</h2>
        {rows.length === 0 ? <EmptyState icon={Package} title="No purchases in this date range" /> : (
          <div className="card overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-teal-50 text-ink/60 text-left">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Product</th>
                  <th className="px-4 py-2.5 font-medium">Merchant</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total Qty</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total Spent</th>
                  <th className="px-4 py-2.5 font-medium text-right">Orders</th>
                  <th className="px-4 py-2.5 font-medium">Last Order</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.product}__${r.merchant}`} className="border-t border-black/5">
                    <td className="px-4 py-2.5 text-ink font-medium">{r.product}</td>
                    <td className="px-4 py-2.5 text-ink/70">{r.merchant}</td>
                    <td className="px-4 py-2.5 text-right text-ink/70">{r.totalQty}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-ink">{peso(r.totalSpent)}</td>
                    <td className="px-4 py-2.5 text-right text-ink/70">{r.orderCount}</td>
                    <td className="px-4 py-2.5 text-ink/70">{formatDate(r.lastOrderDate)}</td>
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

export default function InventoryReportView({ role }) {
  const { user } = useAuth()
  return role === 'merchant' || role === 'admin' ? <MerchantInventory user={user} role={role} /> : <ResellerInventory user={user} />
}
