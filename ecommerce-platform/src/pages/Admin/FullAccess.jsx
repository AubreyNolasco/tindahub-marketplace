import { useEffect, useMemo, useState } from 'react'
import { Banknote, ShoppingCart, UserPlus, Users, CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso } from '../../utils/format'

const emptyInvite = { email: '', full_name: '', phone: '', role: 'reseller', business_name: '' }

export default function FullAccess() {
  const { user } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [products, setProducts] = useState([])
  const [customers, setCustomers] = useState([])
  const [plans, setPlans] = useState([])
  const [cartItems, setCartItems] = useState([])
  const [invite, setInvite] = useState(emptyInvite)
  const [topup, setTopup] = useState({ owner_id: '', amount: '', note: '' })
  const [customer, setCustomer] = useState({ reseller_id: '', name: '', phone: '', address: '', notes: '' })
  const [cart, setCart] = useState({ reseller_id: '', customer_id: '', product_id: '', quantity: 1 })
  const [saving, setSaving] = useState('')

  const resellers = useMemo(() => profiles.filter((p) => p.role === 'reseller'), [profiles])
  const selectedCustomers = customers.filter((c) => c.reseller_id === cart.reseller_id)

  const load = async () => {
    const [p, pr, c, sp, ac] = await Promise.all([
      supabase.from('profiles').select('id,full_name,role').in('role', ['merchant', 'reseller']).order('full_name'),
      supabase.from('products').select('id,name,stock_quantity,min_order_qty,price,merchant_profiles(business_name)').eq('is_active', true).gt('stock_quantity', 0).order('name'),
      supabase.from('customers').select('id,reseller_id,name,address').order('name'),
      supabase.from('subscription_plans').select('*').order('months'),
      supabase.from('admin_cart_items').select('*,profiles!admin_cart_items_reseller_id_fkey(full_name),customers(name),products(name,price)').order('created_at', { ascending: false })
    ])
    const error = [p, pr, c, sp, ac].find((result) => result.error)?.error
    if (error) toast.error(error.message)
    setProfiles(p.data || []); setProducts(pr.data || []); setCustomers(c.data || []); setPlans(sp.data || []); setCartItems(ac.data || [])
  }

  useEffect(() => { load() }, [])

  const submitInvite = async (e) => {
    e.preventDefault(); setSaving('invite')
    const email = invite.email.trim().toLowerCase()
    const { error } = await supabase.from('account_invitations').upsert({ ...invite, email, invited_by: user.id, status: 'pending' }, { onConflict: 'email' })
    if (!error) {
      const result = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/auth/callback`, data: { full_name: invite.full_name, role: invite.role, phone: invite.phone, business_name: invite.business_name } } })
      if (result.error) toast.error(result.error.message)
      else { toast.success('Account invitation sent. The account activates after the email link is opened.'); setInvite(emptyInvite) }
    } else toast.error(error.message)
    setSaving('')
  }

  const submitTopup = async (e) => {
    e.preventDefault(); setSaving('topup')
    const { error } = await supabase.rpc('admin_manual_topup', { p_owner_id: topup.owner_id, p_amount: Number(topup.amount), p_note: topup.note || null })
    if (error) toast.error(error.message); else { toast.success('Wallet credited and audit record created.'); setTopup({ owner_id: '', amount: '', note: '' }) }
    setSaving('')
  }

  const submitCustomer = async (e) => {
    e.preventDefault(); setSaving('customer')
    const { error } = await supabase.rpc('admin_create_customer', { p_reseller_id: customer.reseller_id, p_name: customer.name, p_phone: customer.phone, p_address: customer.address, p_notes: customer.notes || null })
    if (error) toast.error(error.message); else { toast.success('Customer added to the reseller account.'); setCustomer({ reseller_id: '', name: '', phone: '', address: '', notes: '' }); await load() }
    setSaving('')
  }

  const submitCart = async (e) => {
    e.preventDefault(); setSaving('cart')
    const { error } = await supabase.rpc('admin_add_cart_item', { p_reseller_id: cart.reseller_id, p_customer_id: cart.customer_id || null, p_product_id: cart.product_id, p_quantity: Number(cart.quantity) })
    if (error) toast.error(error.message); else { toast.success('Item added to the assisted cart.'); await load() }
    setSaving('')
  }

  const updatePlan = async (plan) => {
    setSaving(`plan-${plan.months}`)
    const { error } = await supabase.from('subscription_plans').update({ name: plan.name, fee: Number(plan.fee), active: plan.active, updated_by: user.id, updated_at: new Date().toISOString() }).eq('months', plan.months)
    if (error) toast.error(error.message); else toast.success('Subscription fee updated.')
    setSaving('')
  }

  const field = 'input-field mt-1'
  return <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6 sm:py-8">
    <div className="mb-7"><h1 className="font-display text-2xl font-bold text-ink">Admin Full Access</h1><p className="mt-1 text-sm text-ink/55">Perform audited actions on behalf of merchants and resellers.</p></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={submitInvite} className="card space-y-3 p-5"><h2 className="flex items-center gap-2 font-bold"><UserPlus className="text-teal-600" size={19}/> Create Merchant or Reseller</h2><div className="grid gap-3 sm:grid-cols-2"><input required className={field} placeholder="Full name" value={invite.full_name} onChange={(e)=>setInvite({...invite,full_name:e.target.value})}/><input required type="email" className={field} placeholder="Email" value={invite.email} onChange={(e)=>setInvite({...invite,email:e.target.value})}/><input className={field} placeholder="Phone" value={invite.phone} onChange={(e)=>setInvite({...invite,phone:e.target.value})}/><select className={field} value={invite.role} onChange={(e)=>setInvite({...invite,role:e.target.value})}><option value="reseller">Reseller</option><option value="merchant">Merchant</option></select></div>{invite.role==='merchant'&&<input required className={field} placeholder="Business name" value={invite.business_name} onChange={(e)=>setInvite({...invite,business_name:e.target.value})}/>}<button disabled={saving==='invite'} className="btn-primary w-full">{saving==='invite'?'Sending...':'Create & Send Login Link'}</button></form>

      <form onSubmit={submitTopup} className="card space-y-3 p-5"><h2 className="flex items-center gap-2 font-bold"><Banknote className="text-teal-600" size={19}/> Insert Manual Top-Up</h2><select required className={field} value={topup.owner_id} onChange={(e)=>setTopup({...topup,owner_id:e.target.value})}><option value="">Choose account</option>{profiles.map((p)=><option key={p.id} value={p.id}>{p.full_name} · {p.role}</option>)}</select><input required type="number" min="1" max="1000000" step="0.01" className={field} placeholder="Amount" value={topup.amount} onChange={(e)=>setTopup({...topup,amount:e.target.value})}/><textarea className={field} placeholder="Reason / reference" value={topup.note} onChange={(e)=>setTopup({...topup,note:e.target.value})}/><button disabled={saving==='topup'} className="btn-primary w-full">Credit Wallet</button></form>

      <form onSubmit={submitCustomer} className="card space-y-3 p-5"><h2 className="flex items-center gap-2 font-bold"><Users className="text-teal-600" size={19}/> Add Customer for Reseller</h2><select required className={field} value={customer.reseller_id} onChange={(e)=>setCustomer({...customer,reseller_id:e.target.value})}><option value="">Choose reseller</option>{resellers.map((p)=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select><div className="grid gap-3 sm:grid-cols-2"><input required className={field} placeholder="Customer name" value={customer.name} onChange={(e)=>setCustomer({...customer,name:e.target.value})}/><input className={field} placeholder="Phone" value={customer.phone} onChange={(e)=>setCustomer({...customer,phone:e.target.value})}/></div><textarea required minLength="8" className={field} placeholder="Complete delivery address" value={customer.address} onChange={(e)=>setCustomer({...customer,address:e.target.value})}/><textarea className={field} placeholder="Notes" value={customer.notes} onChange={(e)=>setCustomer({...customer,notes:e.target.value})}/><button disabled={saving==='customer'} className="btn-primary w-full">Save Customer</button></form>

      <form onSubmit={submitCart} className="card space-y-3 p-5"><h2 className="flex items-center gap-2 font-bold"><ShoppingCart className="text-teal-600" size={19}/> Assisted Add to Cart</h2><select required className={field} value={cart.reseller_id} onChange={(e)=>setCart({...cart,reseller_id:e.target.value,customer_id:''})}><option value="">Choose reseller</option>{resellers.map((p)=><option key={p.id} value={p.id}>{p.full_name}</option>)}</select><select className={field} value={cart.customer_id} onChange={(e)=>setCart({...cart,customer_id:e.target.value})}><option value="">Reseller / no customer</option>{selectedCustomers.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select required className={field} value={cart.product_id} onChange={(e)=>setCart({...cart,product_id:e.target.value})}><option value="">Choose product</option>{products.map((p)=><option key={p.id} value={p.id}>{p.name} · {peso(p.price)} · stock {p.stock_quantity}</option>)}</select><input required type="number" min="1" className={field} value={cart.quantity} onChange={(e)=>setCart({...cart,quantity:e.target.value})}/><button disabled={saving==='cart'} className="btn-primary w-full">Add to Assisted Cart</button>{cartItems.slice(0,5).map((i)=><p key={i.id} className="rounded-lg bg-surface-inset px-3 py-2 text-xs text-ink/60">{i.profiles?.full_name}: {i.products?.name} × {i.quantity}{i.customers?.name?` for ${i.customers.name}`:''}</p>)}</form>
    </div>
    <section className="card mt-6 p-5"><h2 className="mb-4 flex items-center gap-2 font-bold"><CreditCard className="text-teal-600" size={19}/> Subscription Fees</h2><div className="grid gap-3 md:grid-cols-3">{plans.map((plan)=><div key={plan.months} className="rounded-xl border border-black/10 p-4"><input className={field} value={plan.name} onChange={(e)=>setPlans(plans.map((p)=>p.months===plan.months?{...p,name:e.target.value}:p))}/><label className="mt-3 block text-xs font-semibold text-ink/50">{plan.months} months fee<input type="number" min="0" step="0.01" className={field} value={plan.fee} onChange={(e)=>setPlans(plans.map((p)=>p.months===plan.months?{...p,fee:e.target.value}:p))}/></label><label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={plan.active} onChange={(e)=>setPlans(plans.map((p)=>p.months===plan.months?{...p,active:e.target.checked}:p))}/> Active</label><button type="button" onClick={()=>updatePlan(plan)} disabled={saving===`plan-${plan.months}`} className="btn-secondary mt-3 w-full text-sm">Save Fee</button></div>)}</div></section>
  </div>
}
