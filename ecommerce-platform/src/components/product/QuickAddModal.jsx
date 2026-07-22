import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Package, Plus, UserRound, X } from 'lucide-react'
import { peso } from '../../utils/format'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'
import { isCompleteAddress } from '../../utils/address'

export default function QuickAddModal({ product, quantity, onQuantityChange, onClose, onAdd }) {
  const { user, role } = useAuth()
  const [customers, setCustomers] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [loadingCustomers, setLoadingCustomers] = useState(role === 'reseller')
  useEffect(() => {
    if (role !== 'reseller' || !user) return
    supabase.from('customers').select('id,name,phone,address').eq('reseller_id', user.id).order('name').then(({ data, error }) => {
      if (error) toast.error(error.message)
      const eligibleCustomers = (data || []).filter((customer) => isCompleteAddress(customer.address))
      setCustomers(eligibleCustomers)
      if (eligibleCustomers.length === 1) setCustomerId(eligibleCustomers[0].id)
      setLoadingCustomers(false)
    })
  }, [role, user])
  if (!product) return null
  const minimum = product.min_order_qty || 1
  const canAdd = product.stock_quantity >= minimum

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-label="Add product to cart">
      <div className="card w-full max-w-md p-5 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-black/5 text-ink/60" aria-label="Close"><X size={20} /></button>
        <div className="flex gap-4 pr-8">
          <div className="w-24 h-24 shrink-0 bg-teal-50 rounded-xl overflow-hidden flex items-center justify-center">
            {product.images?.[0] ? <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" /> : <Package className="text-teal-300" size={34} />}
          </div>
          <div>
            <h2 className="font-display font-bold text-xl text-ink">{product.name}</h2>
            <p className="font-semibold text-teal-700 mt-1">{peso(product.price)}</p>
            <p className="text-xs text-ink/50 mt-1">{product.stock_quantity} available - Min. order: {minimum}</p>
          </div>
        </div>
        <p className="text-sm text-ink/70 leading-relaxed mt-4">{product.description || 'No additional product details.'}</p>
        {product.sku && <p className="text-xs text-ink/50 mt-2">SKU: {product.sku}</p>}

        {role === 'reseller' && <div className="mt-5 rounded-xl border border-teal-100 bg-teal-50 p-4"><label className="flex items-center gap-2 text-sm font-semibold text-ink"><UserRound size={17} className="text-teal-600" /> Customer for this order</label>{loadingCustomers ? <p className="mt-2 text-xs text-ink/45">Loading customers...</p> : customers.length ? <><select required className="input-field mt-2" value={customerId} onChange={(e) => setCustomerId(e.target.value)}><option value="">Choose a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} {customer.phone ? `· ${customer.phone}` : ''}</option>)}</select>{customerId && <p className="mt-2 text-xs text-ink/55">{customers.find((customer) => customer.id === customerId)?.address || 'No address saved'}</p>}</> : <p className="mt-2 text-xs text-ink/55">You need a saved customer before adding products. <Link to="/reseller/customers" className="font-bold text-teal-700 underline">Add customer</Link></p>}</div>}

        <div className="flex items-center justify-between mt-6">
          <span className="text-sm font-semibold text-ink">Quantity</span>
          <div className="flex items-center border border-black/10 rounded-xl overflow-hidden">
            <button onClick={() => onQuantityChange(Math.max(minimum, quantity - 1))} className="p-2.5 hover:bg-teal-50" aria-label="Decrease quantity"><Minus size={16} /></button>
            <span className="px-4 font-semibold min-w-12 text-center">{quantity}</span>
            <button onClick={() => onQuantityChange(Math.min(product.stock_quantity, quantity + 1))} className="p-2.5 hover:bg-teal-50" aria-label="Increase quantity"><Plus size={16} /></button>
          </div>
        </div>
        <p className="text-right text-sm font-semibold text-ink mt-3">Subtotal: {peso(product.price * quantity)}</p>
        <button onClick={() => onAdd(role === 'reseller' ? customers.find((customer) => customer.id === customerId) : null)} disabled={!canAdd || (role === 'reseller' && !customerId)} className="btn-primary w-full mt-5">
          {canAdd ? 'Idagdag sa Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  )
}
