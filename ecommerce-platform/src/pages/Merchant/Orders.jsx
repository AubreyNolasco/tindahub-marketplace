import { useCallback, useEffect, useState } from 'react'
import { Check, X, Truck, ShieldAlert, RefreshCw, Eye, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso, formatDate, ORDER_STATUS_STYLES as BADGE_STYLES, ORDER_STATUS_LABELS } from '../../utils/format'
import DataTable from '../../components/ui/DataTable'
import ActionPopup, { DetailRow, DetailSection } from '../../components/ui/ActionPopup'
import { PageGuideButton } from '../../components/system/SystemGuide'
import DeliveryModal from '../../components/order/DeliveryModal'
import OrderCaseModal from '../../components/order/OrderCaseModal'
import ShippingFeeModal from '../../components/order/ShippingFeeModal'
import PromptModal from '../../components/ui/PromptModal'
import { printReceipt } from '../../utils/receipt'

const NEXT_STATUS = { confirmed: 'processing' }

const STATUS_ERRORS = {
  NO_MERCHANT_WALLET: 'No merchant wallet was found.',
  INSUFFICIENT_MERCHANT_FEE_BALANCE: 'Insufficient wallet balance for fee.'
}

export default function Orders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [showDetail, setShowDetail] = useState(false)
  const [deliveryOrder, setDeliveryOrder] = useState(null)
  const [caseOrder, setCaseOrder] = useState(null)
  const [shippingFeeOrder, setShippingFeeOrder] = useState(null)
  const [caseReviewTarget, setCaseReviewTarget] = useState(null) // { caseItem, approve }

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*), payments(*), customers(name, phone, address, notes), order_cases(*), lalamove_bookings(status,lalamove_order_id,driver_info,failure_reason,updated_at)')
      .eq('merchant_id', user.id)
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setOrders(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const viewProof = async (order) => {
    const payment = order.payments?.[0]
    if (!payment?.proof_url) return
    const { data, error } = await supabase.storage.from('payment-proofs').createSignedUrl(payment.proof_url, 300)
    if (error) return toast.error('Unable to load proof.')
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }
  const viewDispatchProof = async (order) => {
    if (!order.dispatch_proof_url) return
    const { data, error } = await supabase.storage.from('delivery-proofs').createSignedUrl(order.dispatch_proof_url, 300)
    if (error) return toast.error(error.message)
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  const verifyPayment = async (order, approve) => {
    const payment = order.payments?.[0]
    if (!payment) return
    const { error } = await supabase.from('payments').update({
      status: approve ? 'verified' : 'rejected',
      verified_by: user.id,
      verified_at: new Date().toISOString()
    }).eq('id', payment.id)
    if (error) return toast.error(error.message)
    if (!approve) await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
    toast.success(approve ? 'Payment verified!' : 'Payment rejected.')
    load()
  }

  const advanceStatus = async (order) => {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    const { error } = await supabase.from('orders').update({ status: next }).eq('id', order.id)
    if (error) return toast.error(STATUS_ERRORS[error.message] || error.message)
    toast.success(`Order updated to ${ORDER_STATUS_LABELS[next]}.`)
    load()
  }

  const reviewCase = async (caseItem, approve, notes = '') => {
    const { error } = await supabase.rpc('review_order_case', { p_case_id: caseItem.id, p_approve: approve, p_notes: notes })
    if (error) return toast.error(error.message)
    toast.success(approve ? 'Approved.' : 'Rejected.')
    setCaseReviewTarget(null)
    load()
  }

  const openDetail = (order) => {
    setSelectedOrder(order)
    setShowDetail(true)
  }

  const columns = [
    { header: 'Order #', accessor: 'order_number', sortable: true },
    { header: 'Date', accessor: 'created_at', format: 'date', sortable: true },
    {
      header: 'Customer',
      render: (row) => row.customers?.name || row.shipping_address?.split(',').slice(-3, -2)[0]?.trim() || '—'
    },
    { header: 'Items', render: (row) => (row.order_items?.length || 0) + ' item(s)' },
    { header: 'Total', accessor: 'total', format: 'currency', sortable: true },
    { header: 'Status', accessor: 'status', format: 'badge', sortable: true },
    {
      header: 'Shipping fee',
      render: (row) => row.status !== 'processing' || !row.shipping_fee_confirmation_status ? <span className="text-ink/30">—</span>
        : row.shipping_fee_confirmation_status === 'pending' ? <span className="badge bg-mango-100 text-mango-700">Waiting on reseller</span>
        : row.shipping_fee_confirmation_status === 'declined' ? <span className="badge bg-coral-100 text-coral-700">Needs your action</span>
        : <span className="badge bg-teal-100 text-teal-700">Accepted</span>
    }
  ]

  const needsFeeAction = orders.filter((order) => order.status === 'processing' && order.shipping_fee_confirmation_status === 'declined').length
  const waitingOnReseller = orders.filter((order) => order.status === 'processing' && order.shipping_fee_confirmation_status === 'pending').length

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Customer Orders</h1>
          <p className="mt-1 text-sm text-ink/50">Manage incoming orders, payments, and dispatch.</p>
        </div>
        <div className="flex items-center gap-2">
          <PageGuideButton pageKey="product-flow" />
          <button onClick={load} className="btn-secondary p-2.5" aria-label="Refresh orders">
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {(needsFeeAction > 0 || waitingOnReseller > 0) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {needsFeeAction > 0 && <span className="badge bg-coral-100 text-coral-700">{needsFeeAction} order{needsFeeAction === 1 ? '' : 's'} declined — resubmit shipping fee</span>}
          {waitingOnReseller > 0 && <span className="badge bg-mango-100 text-mango-700">{waitingOnReseller} order{waitingOnReseller === 1 ? '' : 's'} waiting on Reseller to confirm shipping fee</span>}
        </div>
      )}

      <DataTable
        columns={columns}
        data={orders}
        loading={loading}
        searchPlaceholder="Search by order #, customer..."
        emptyTitle="No orders yet"
        emptyMessage="Orders will appear here when someone buys your products."
        actions={[
          {
            label: 'View details',
            icon: <Eye size={15} />,
            onClick: (row) => openDetail(row)
          },
          {
            label: 'Print receipt',
            icon: <Printer size={15} />,
            onClick: (row) => printReceipt({
              title: 'Marketplace Order', reference: row.order_number, status: row.status,
              date: formatDate(row.created_at),
              rows: [
                { label: 'Customer', value: row.customers?.name || '—' },
                { label: 'Total', value: peso(row.total) },
                { label: 'Status', value: ORDER_STATUS_LABELS[row.status] }
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
        subtitle={selectedOrder ? formatDate(selectedOrder.created_at) : ''}
        size="lg"
      >
        {selectedOrder && (
          <div>
            {/* Status Timeline */}
            <div className="mb-6">
              <span className={`badge ${BADGE_STYLES[selectedOrder.status]}`}>
                {ORDER_STATUS_LABELS[selectedOrder.status]}
              </span>
            </div>

            {/* Customer */}
            {selectedOrder.customers && (
              <DetailSection title="Customer">
                <DetailRow label="Name" value={selectedOrder.customers.name} />
                <DetailRow label="Phone" value={selectedOrder.customers.phone || '—'} />
                <DetailRow label="Address" value={selectedOrder.customers.address || selectedOrder.shipping_address} />
                {selectedOrder.customers.notes && <DetailRow label="Notes" value={selectedOrder.customers.notes} />}
              </DetailSection>
            )}

            {/* Items */}
            <DetailSection title="Order Items">
              {selectedOrder.order_items?.map((item) => (
                <DetailRow
                  key={item.id}
                  label={`${item.product_name} × ${item.quantity}`}
                  value={peso(item.line_total)}
                />
              ))}
              <DetailRow label="Subtotal" value={peso(selectedOrder.subtotal)} className="font-bold border-t border-black/10 pt-2 mt-2" />
              <DetailRow label="Shipping" value={selectedOrder.shipping_payment_method === 'receiver_pays_on_delivery' ? 'Pay on delivery' : peso(selectedOrder.shipping_fee)} />
              <DetailRow label="Total" value={peso(selectedOrder.total)} className="font-bold text-teal-700 text-base" />
            </DetailSection>

            {/* Payment */}
            {selectedOrder.payments?.[0] && (
              <DetailSection title="Payment">
                <DetailRow label="Method" value={selectedOrder.payments[0].method?.toUpperCase()} />
                <DetailRow label="Reference" value={selectedOrder.payments[0].reference_number || '—'} />
                <DetailRow label="Status" value={selectedOrder.payments[0].status} />
                {selectedOrder.payments[0].proof_url && (
                  <button onClick={() => viewProof(selectedOrder)} className="btn-secondary mt-2 text-xs">View Payment Proof</button>
                )}
              </DetailSection>
            )}

            {/* Delivery */}
            {selectedOrder.delivery_provider && (
              <DetailSection title="Delivery">
                <DetailRow label="Provider" value={selectedOrder.delivery_provider} />
                <DetailRow label="Tracking" value={selectedOrder.tracking_number || '—'} />
                <DetailRow label="ETA" value={selectedOrder.estimated_delivery_at ? formatDate(selectedOrder.estimated_delivery_at) : '—'} />
                {selectedOrder.lalamove_bookings?.[0] && (
                  <DetailRow label="Lalamove status" value={selectedOrder.lalamove_bookings[0].status.replace(/_/g, ' ')} />
                )}
                {selectedOrder.dispatch_proof_url && (
                  <button onClick={() => viewDispatchProof(selectedOrder)} className="btn-secondary mt-2 text-xs">View Dispatch Proof</button>
                )}
              </DetailSection>
            )}

            {/* Open Cases */}
            {selectedOrder.order_cases?.filter(c => ['open', 'merchant_review', 'admin_review'].includes(c.status)).map(c => (
              <div key={c.id} className="mt-4 rounded-xl bg-coral-100 p-4">
                <p className="font-bold capitalize text-coral-700">{c.case_type}</p>
                <p className="text-sm text-coral-700 mt-1">{c.reason}</p>
                {c.status === 'merchant_review' && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => setCaseReviewTarget({ caseItem: c, approve: true })} className="btn-primary text-xs">Approve</button>
                    <button onClick={() => setCaseReviewTarget({ caseItem: c, approve: false })} className="btn-secondary text-xs">Reject</button>
                  </div>
                )}
              </div>
            ))}

            {/* Shipping fee / dispatch */}
            {selectedOrder.status === 'processing' && (
              <div className="mt-4 rounded-xl border border-mango-200 bg-mango-50 p-4 text-sm text-ink/65">
                {!selectedOrder.shipping_fee_confirmation_status && (
                  <>
                    <p className="font-semibold text-ink">Packaging step: enter the actual shipping fee for Reseller approval.</p>
                    <button onClick={() => { setShowDetail(false); setShippingFeeOrder(selectedOrder) }} className="btn-primary mt-2 flex items-center gap-1.5 text-sm"><Truck size={16} /> Submit shipping fee</button>
                  </>
                )}
                {selectedOrder.shipping_fee_confirmation_status === 'pending' && (
                  <p className="font-semibold text-mango-700">Waiting for the Reseller to confirm the {peso(selectedOrder.proposed_shipping_fee)} shipping fee. Dispatch is locked.</p>
                )}
                {selectedOrder.shipping_fee_confirmation_status === 'declined' && (
                  <>
                    <p className="font-semibold text-coral-700">Reseller will not accept this fee.</p>
                    <p className="mt-1">Note: {selectedOrder.shipping_fee_reseller_note}</p>
                    <button onClick={() => { setShowDetail(false); setShippingFeeOrder(selectedOrder) }} className="btn-secondary mt-2 text-sm">Submit a revised shipping fee</button>
                  </>
                )}
                {selectedOrder.shipping_fee_confirmation_status === 'accepted' && (
                  <>
                    <p className="font-semibold text-teal-800">Reseller accepted {peso(selectedOrder.proposed_shipping_fee)}. You may now dispatch the order.</p>
                    <button onClick={() => { setShowDetail(false); setDeliveryOrder(selectedOrder) }} className="btn-primary mt-2 flex items-center gap-1.5 text-sm"><Truck size={16} /> Enter delivery details</button>
                  </>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="mt-6 flex flex-wrap gap-2 border-t border-black/[0.06] pt-4">
              {selectedOrder.payments?.[0]?.status === 'submitted' && (
                <>
                  <button onClick={() => verifyPayment(selectedOrder, true)} className="btn-primary flex items-center gap-1.5 text-sm"><Check size={15} /> Verify Payment</button>
                  <button onClick={() => verifyPayment(selectedOrder, false)} className="flex items-center gap-1.5 rounded-xl bg-coral-100 px-4 py-2.5 text-sm font-semibold text-coral-700"><X size={15} /> Reject</button>
                </>
              )}
              {NEXT_STATUS[selectedOrder.status] && (
                <button onClick={() => advanceStatus(selectedOrder)} className="btn-primary text-sm">
                  Mark as "{ORDER_STATUS_LABELS[NEXT_STATUS[selectedOrder.status]]}"
                </button>
              )}
              {!['completed', 'cancelled'].includes(selectedOrder.status) && (
                <button onClick={() => { setShowDetail(false); setCaseOrder(selectedOrder) }} className="flex items-center gap-1.5 rounded-xl bg-coral-100 px-4 py-2.5 text-sm font-semibold text-coral-700">
                  <ShieldAlert size={15} /> Help
                </button>
              )}
              {selectedOrder.status === 'shipped' && (
                <p className="text-xs text-ink/50 mt-2">Awaiting buyer confirmation — payout released after delivery confirmation.</p>
              )}
            </div>
          </div>
        )}
      </ActionPopup>

      {/* Modals */}
      <DeliveryModal order={deliveryOrder} open={Boolean(deliveryOrder)} onClose={() => setDeliveryOrder(null)} onSaved={load} />
      <ShippingFeeModal order={shippingFeeOrder} open={Boolean(shippingFeeOrder)} onClose={() => setShippingFeeOrder(null)} onSaved={load} />
      <OrderCaseModal order={caseOrder} open={Boolean(caseOrder)} onClose={() => setCaseOrder(null)} onSaved={load} />
      <PromptModal
        open={!!caseReviewTarget}
        onClose={() => setCaseReviewTarget(null)}
        onSubmit={(notes) => reviewCase(caseReviewTarget.caseItem, caseReviewTarget.approve, notes)}
        title={caseReviewTarget?.approve ? 'Approve order case' : 'Reject order case'}
        label={caseReviewTarget?.approve ? 'Resolution notes' : 'Rejection reason'}
        type="textarea"
        submitText={caseReviewTarget?.approve ? 'Approve' : 'Reject'}
      />
    </div>
  )
}
