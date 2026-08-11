import { useCallback, useEffect, useState } from 'react'
import { CircleDollarSign, PackageCheck, Printer, ShieldAlert, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso, formatDate, ORDER_STATUS_STYLES, ORDER_STATUS_LABELS } from '../../utils/format'
import DataTable from '../../components/ui/DataTable'
import ActionPopup, { DetailRow, DetailSection } from '../../components/ui/ActionPopup'
import { PageGuideButton } from '../../components/system/SystemGuide'
import OrderCaseModal from './OrderCaseModal'
import CustomerPaymentModal from './CustomerPaymentModal'
import { realizedResellerMargin } from '../../utils/orderProcess'
import { printReceipt } from '../../utils/receipt'
import ShippingDecisionModal from './ShippingDecisionModal'

export default function PurchaseHistory() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(null)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [caseOrder, setCaseOrder] = useState(null)
  const [paymentOrder, setPaymentOrder] = useState(null)
  const [shippingDecisionOrder, setShippingDecisionOrder] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*, merchant_profiles(business_name), order_items(*), order_cases(id,case_type,status,created_at), customer_payment_records(*), lalamove_bookings(status,lalamove_order_id,driver_info,failure_reason,updated_at)')
      .eq('reseller_id', user.id)
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setOrders(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const confirmReceived = async (order) => {
    setConfirming(order.id)
    const { error } = await supabase.from('orders').update({ status: 'completed', delivered_at: new Date().toISOString() }).eq('id', order.id)
    setConfirming(null)
    if (error) return toast.error(error.message)
    toast.success('Thank you! The merchant payout has been released.')
    load()
  }

  const viewDispatchProof = async (order) => {
    if (!order.dispatch_proof_url) return
    const { data, error } = await supabase.storage.from('delivery-proofs').createSignedUrl(order.dispatch_proof_url, 300)
    if (error) return toast.error(error.message)
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const openDetail = (order) => {
    setSelectedOrder(order)
    setShowDetail(true)
  }

  const columns = [
    { header: 'Order #', accessor: 'order_number', sortable: true },
    { header: 'Date', accessor: 'created_at', format: 'date', sortable: true },
    { header: 'Merchant', render: (row) => row.merchant_profiles?.business_name || '—', sortable: true },
    { header: 'Items', render: (row) => (row.order_items?.length || 0) + ' item(s)' },
    { header: 'Total', accessor: 'total', format: 'currency', sortable: true },
    { header: 'Status', accessor: 'status', format: 'badge', sortable: true },
    {
      header: 'Shipping fee',
      render: (row) => row.status !== 'processing' || !row.shipping_fee_confirmation_status ? <span className="text-ink/30">—</span>
        : row.shipping_fee_confirmation_status === 'pending' ? <span className="badge bg-coral-100 text-coral-700">Needs your decision</span>
        : row.shipping_fee_confirmation_status === 'declined' ? <span className="badge bg-mango-100 text-mango-700">Waiting on Merchant</span>
        : <span className="badge bg-teal-100 text-teal-700">Accepted</span>
    }
  ]

  const needsMyDecision = orders.filter((order) => order.status === 'processing' && order.shipping_fee_confirmation_status === 'pending').length

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">My Orders</h1>
          <p className="mt-1 text-sm text-ink/50">Track purchases, review shipping fees, and confirm delivery.</p>
        </div>
        <div className="flex items-center gap-2">
          <PageGuideButton pageKey="product-flow" />
          <button onClick={load} className="btn-secondary p-2.5">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {needsMyDecision > 0 && (
        <div className="mb-4">
          <span className="badge bg-coral-100 text-coral-700">{needsMyDecision} order{needsMyDecision === 1 ? '' : 's'} waiting on you to confirm the shipping fee</span>
        </div>
      )}

      <DataTable
        columns={columns}
        data={orders}
        loading={loading}
        searchPlaceholder="Search by order #, merchant..."
        emptyTitle="No orders yet"
        emptyMessage="Place your first order from the catalog."
        onView={openDetail}
        actions={[
          {
            label: 'Print receipt',
            icon: <Printer size={15} />,
            onClick: (row) => printReceipt({
              title: 'Marketplace Order', reference: row.order_number, status: row.status,
              date: formatDate(row.created_at),
              rows: [
                { label: 'Merchant', value: row.merchant_profiles?.business_name },
                { label: 'Total', value: peso(row.total) }
              ]
            })
          }
        ]}
      />

      {/* Detail Popup */}
      <ActionPopup
        open={showDetail}
        onClose={() => { setShowDetail(false); setSelectedOrder(null) }}
        title={selectedOrder?.order_number || 'Order Details'}
        subtitle={selectedOrder?.merchant_profiles?.business_name}
        size="lg"
      >
        {selectedOrder && (
          <div>
            <div className="mb-4">
              <span className={`badge ${ORDER_STATUS_STYLES[selectedOrder.status]}`}>
                {ORDER_STATUS_LABELS[selectedOrder.status]}
              </span>
              <span className="ml-2 text-sm text-ink/50">{formatDate(selectedOrder.created_at)}</span>
            </div>

            <DetailSection title="Order Items">
              {selectedOrder.order_items?.map((item) => (
                <DetailRow key={item.id} label={`${item.product_name} × ${item.quantity}`} value={peso(item.line_total)} />
              ))}
              <DetailRow label="Subtotal" value={peso(selectedOrder.subtotal)} className="font-bold border-t border-black/10 pt-2 mt-2" />
              <DetailRow label="Shipping" value={selectedOrder.shipping_payment_method === 'receiver_pays_on_delivery' ? 'Pay upon delivery' : peso(selectedOrder.shipping_fee)} />
              {Number(selectedOrder.reseller_operation_fee) > 0 && (
                <DetailRow label="System Fee (1%)" value={peso(selectedOrder.reseller_operation_fee)} />
              )}
              <DetailRow label="Total Charged" value={peso(selectedOrder.total)} className="font-bold text-teal-700 text-base" />
            </DetailSection>

            {selectedOrder.delivery_provider && (
              <DetailSection title="Delivery">
                <DetailRow label="Provider" value={selectedOrder.delivery_provider} />
                <DetailRow label="Tracking" value={selectedOrder.tracking_number || '—'} />
                <DetailRow label="ETA" value={selectedOrder.estimated_delivery_at ? new Date(selectedOrder.estimated_delivery_at).toLocaleString('en-PH') : '—'} />
                <DetailRow label="Fee" value={selectedOrder.actual_shipping_fee != null ? peso(selectedOrder.actual_shipping_fee) : '—'} />
                {selectedOrder.lalamove_bookings?.[0] && (
                  <DetailRow label="Lalamove status" value={selectedOrder.lalamove_bookings[0].status.replace(/_/g, ' ')} />
                )}
                {selectedOrder.dispatch_proof_url && (
                  <button onClick={() => viewDispatchProof(selectedOrder)} className="btn-secondary mt-2 text-xs">View Dispatch Proof</button>
                )}
              </DetailSection>
            )}

            {selectedOrder.customer_payment_records?.[0] && (
              <DetailSection title="Customer Payment">
                <DetailRow label="Status" value={selectedOrder.customer_payment_records[0].status.replace(/_/g, ' ')} />
                <DetailRow label="Received" value={peso(selectedOrder.customer_payment_records[0].received_amount)} />
                <DetailRow label="Expected" value={peso(selectedOrder.customer_payment_records[0].expected_amount)} />
                <DetailRow label="Margin" value={peso(realizedResellerMargin(selectedOrder.customer_payment_records[0].received_amount, selectedOrder.total))} />
              </DetailSection>
            )}

            {/* Shipping Fee Decision */}
            {selectedOrder.status === 'processing' && (
              <div className="mt-4 rounded-xl border border-mango-200 bg-mango-50 p-4">
                {selectedOrder.shipping_fee_confirmation_status === 'pending' && (
                  <>
                    <p className="font-semibold text-ink">Shipping fee: {peso(selectedOrder.proposed_shipping_fee)}</p>
                    <p className="mt-1 text-xs text-ink/60">The Merchant submitted this fee. Review and accept or decline.</p>
                    <button onClick={() => { setShowDetail(false); setShippingDecisionOrder(selectedOrder) }} className="btn-primary mt-3 text-sm">Review Shipping Fee</button>
                  </>
                )}
                {selectedOrder.shipping_fee_confirmation_status === 'accepted' && (
                  <p className="font-semibold text-teal-800">You accepted {peso(selectedOrder.proposed_shipping_fee)}. Waiting for dispatch.</p>
                )}
                {selectedOrder.shipping_fee_confirmation_status === 'declined' && (
                  <p className="text-coral-700"><strong>Declined.</strong> Note: {selectedOrder.shipping_fee_reseller_note}</p>
                )}
              </div>
            )}

            {/* Open Cases */}
            {selectedOrder.order_cases?.filter(c => ['open', 'merchant_review', 'admin_review'].includes(c.status)).map(c => (
              <p key={c.id} className="mt-3 rounded-xl bg-coral-100 p-3 text-xs font-semibold text-coral-700">
                Open {c.case_type} request · {c.status.replace('_', ' ')}
              </p>
            ))}

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-2 border-t border-black/[0.06] pt-4">
              {selectedOrder.status === 'shipped' && (
                <button onClick={() => confirmReceived(selectedOrder)} disabled={confirming === selectedOrder.id} className="btn-primary flex items-center gap-1.5 text-sm">
                  <PackageCheck size={16} /> {confirming === selectedOrder.id ? 'Confirming...' : 'Confirm Delivery'}
                </button>
              )}
              {!['cancelled'].includes(selectedOrder.status) && (
                <>
                  <button onClick={() => { setShowDetail(false); setPaymentOrder(selectedOrder) }} className="btn-secondary flex items-center gap-1.5 text-sm">
                    <CircleDollarSign size={15} /> Record Payment
                  </button>
                  {selectedOrder.status !== 'completed' && (
                    <button onClick={() => { setShowDetail(false); setCaseOrder(selectedOrder) }} className="flex items-center gap-1.5 rounded-xl bg-coral-100 px-4 py-2.5 text-sm font-semibold text-coral-700">
                      <ShieldAlert size={15} /> Help
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </ActionPopup>

      <OrderCaseModal order={caseOrder} open={Boolean(caseOrder)} onClose={() => setCaseOrder(null)} onSaved={load} />
      <CustomerPaymentModal order={paymentOrder} open={Boolean(paymentOrder)} onClose={() => setPaymentOrder(null)} onSaved={load} />
      <ShippingDecisionModal order={shippingDecisionOrder} open={Boolean(shippingDecisionOrder)} onClose={() => setShippingDecisionOrder(null)} onSaved={load} />
    </div>
  )
}
