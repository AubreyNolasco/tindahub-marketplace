import { useEffect, useState } from 'react'
import { Percent, Plus, Power, Ticket, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { peso } from '../../utils/format'
import Spinner from '../../components/ui/Spinner'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'

// Phase 10 of TASK6.md. All writes go through create_voucher/update_voucher/
// delete_voucher (20260806002100_voucher_write_rpcs.sql) -- the vouchers
// table itself has no insert/update/delete grant for `authenticated`
// anymore, by design, so there is no direct-.insert()/.update() path here
// the way Campaigns.jsx has for the `campaigns` table.

const SCOPES = [
  { value: 'platform', label: 'Platform-wide' },
  { value: 'shipping', label: 'Shipping discount' },
  { value: 'merchant', label: 'One merchant’s whole store' },
  { value: 'product', label: 'One product' },
  { value: 'category', label: 'One category' }
]
const initialForm = {
  code: '', scope: 'platform', discount_type: 'percent', discount_value: '', max_discount_amount: '',
  min_spend: '0', usage_limit: '', usage_limit_per_user: '1', starts_at: '', ends_at: '',
  merchant_id: '', product_id: '', category_id: ''
}
const state = (v) => { const now = Date.now(); if (!v.is_active) return 'Disabled'; if (now < new Date(v.starts_at).getTime()) return 'Upcoming'; if (now > new Date(v.ends_at).getTime()) return 'Ended'; return 'Active' }
const STATE_TONE = { Active: 'success', Upcoming: 'info', Ended: 'neutral', Disabled: 'neutral' }

export default function AdminVouchers() {
  const [vouchers, setVouchers] = useState([])
  const [merchants, setMerchants] = useState([])
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [editing, setEditing] = useState(null)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('vouchers')
      .select('*, merchant_profiles(business_name), products(name), categories(name), voucher_redemptions(count)')
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setVouchers(data || [])
    setLoading(false)
  }
  const loadPickers = async () => {
    const [m, c] = await Promise.all([
      supabase.from('merchant_profiles').select('id, business_name').eq('status', 'approved').order('business_name'),
      supabase.from('categories').select('id, name').order('name')
    ])
    setMerchants(m.data || [])
    setCategories(c.data || [])
  }
  useEffect(() => { load(); loadPickers() }, [])

  useEffect(() => {
    if (form.scope !== 'product' || !form.merchant_id) { setProducts([]); return }
    supabase.from('products').select('id, name').eq('merchant_id', form.merchant_id).order('name')
      .then(({ data }) => setProducts(data || []))
  }, [form.scope, form.merchant_id])

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))

  const create = async (event) => {
    event.preventDefault()
    setSaving(true)
    const needsMerchant = form.scope !== 'platform'
    const { error } = await supabase.rpc('create_voucher', {
      p_code: form.code.trim().toUpperCase(),
      p_scope: form.scope,
      p_discount_type: form.discount_type,
      p_discount_value: Number(form.discount_value),
      p_starts_at: new Date(form.starts_at).toISOString(),
      p_ends_at: new Date(form.ends_at).toISOString(),
      p_max_discount_amount: form.max_discount_amount === '' ? null : Number(form.max_discount_amount),
      p_min_spend: form.min_spend === '' ? 0 : Number(form.min_spend),
      p_usage_limit: form.usage_limit === '' ? null : Number(form.usage_limit),
      p_usage_limit_per_user: form.usage_limit_per_user === '' ? 1 : Number(form.usage_limit_per_user),
      p_merchant_id: needsMerchant ? form.merchant_id || null : null,
      p_product_id: form.scope === 'product' ? form.product_id || null : null,
      p_category_id: form.scope === 'category' ? form.category_id || null : null
    })
    setSaving(false)
    if (error) return toast.error(error.message === 'VOUCHER_CODE_TAKEN' ? 'That voucher code is already in use.' : error.message)
    toast.success('Voucher created.')
    setForm(initialForm)
    load()
  }

  const openEdit = (v) => setEditing({
    id: v.id, discount_type: v.discount_type, discount_value: String(v.discount_value),
    max_discount_amount: v.max_discount_amount != null ? String(v.max_discount_amount) : '',
    min_spend: String(v.min_spend), usage_limit: v.usage_limit != null ? String(v.usage_limit) : '',
    usage_limit_per_user: String(v.usage_limit_per_user),
    starts_at: v.starts_at.slice(0, 16), ends_at: v.ends_at.slice(0, 16), is_active: v.is_active
  })
  const saveEdit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const { error } = await supabase.rpc('update_voucher', {
      p_id: editing.id, p_discount_type: editing.discount_type, p_discount_value: Number(editing.discount_value),
      p_starts_at: new Date(editing.starts_at).toISOString(), p_ends_at: new Date(editing.ends_at).toISOString(),
      p_max_discount_amount: editing.max_discount_amount === '' ? null : Number(editing.max_discount_amount),
      p_min_spend: editing.min_spend === '' ? 0 : Number(editing.min_spend),
      p_usage_limit: editing.usage_limit === '' ? null : Number(editing.usage_limit),
      p_usage_limit_per_user: editing.usage_limit_per_user === '' ? 1 : Number(editing.usage_limit_per_user),
      p_is_active: editing.is_active
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Voucher updated.')
    setEditing(null)
    load()
  }
  const toggle = async (v) => {
    const { error } = await supabase.rpc('update_voucher', {
      p_id: v.id, p_discount_type: v.discount_type, p_discount_value: v.discount_value,
      p_starts_at: v.starts_at, p_ends_at: v.ends_at, p_max_discount_amount: v.max_discount_amount,
      p_min_spend: v.min_spend, p_usage_limit: v.usage_limit, p_usage_limit_per_user: v.usage_limit_per_user,
      p_is_active: !v.is_active
    })
    if (error) return toast.error(error.message)
    load()
  }
  const remove = async (v) => {
    if (!window.confirm(`Delete voucher "${v.code}"? This cannot be undone.`)) return
    const { error } = await supabase.rpc('delete_voucher', { p_id: v.id })
    if (error) return toast.error(error.message === 'VOUCHER_HAS_REDEMPTIONS' ? 'This voucher has already been redeemed at least once — disable it instead of deleting it.' : error.message)
    toast.success('Voucher deleted.')
    load()
  }

  const scopeLabel = (v) => v.scope === 'merchant' ? v.merchant_profiles?.business_name : v.scope === 'product' ? v.products?.name : v.scope === 'category' ? v.categories?.name : v.scope === 'shipping' ? (v.merchant_profiles?.business_name || 'Platform-wide') : 'Platform-wide'

  return <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
    <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Marketplace promotions</p><h1 className="mt-1 font-display text-2xl font-bold text-ink">Voucher Management</h1><p className="mt-1 text-sm text-ink/50">Create platform-wide, shipping, or merchant/product/category discount codes.</p></div>

    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <form onSubmit={create} className="h-fit rounded-2xl border border-black/[0.06] bg-surface p-5 shadow-soft">
        <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-700"><Plus size={18} /></span><h2 className="font-display font-bold text-ink">Create voucher</h2></div>
        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-ink/65">Code<input required maxLength="40" className="input-field mt-1 uppercase" value={form.code} onChange={update('code')} placeholder="WELCOME10" /></label>
          <label className="block text-sm font-medium text-ink/65">Scope
            <select className="input-field mt-1" value={form.scope} onChange={update('scope')}>{SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
          </label>
          {form.scope !== 'platform' && (
            <label className="block text-sm font-medium text-ink/65">Merchant{form.scope === 'shipping' && ' (leave blank for platform-wide shipping)'}
              <select required={form.scope !== 'shipping'} className="input-field mt-1" value={form.merchant_id} onChange={update('merchant_id')}>
                <option value="">{form.scope === 'shipping' ? 'Platform-wide' : 'Choose a merchant...'}</option>
                {merchants.map((m) => <option key={m.id} value={m.id}>{m.business_name}</option>)}
              </select>
            </label>
          )}
          {form.scope === 'product' && (
            <label className="block text-sm font-medium text-ink/65">Product
              <select required className="input-field mt-1" value={form.product_id} onChange={update('product_id')} disabled={!form.merchant_id}>
                <option value="">{form.merchant_id ? 'Choose a product...' : 'Choose a merchant first'}</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          )}
          {form.scope === 'category' && (
            <label className="block text-sm font-medium text-ink/65">Category
              <select required className="input-field mt-1" value={form.category_id} onChange={update('category_id')}>
                <option value="">Choose a category...</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-ink/65">Discount type
              <select className="input-field mt-1" value={form.discount_type} onChange={update('discount_type')}>
                <option value="percent">Percent</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>
            <label className="text-sm font-medium text-ink/65">{form.discount_type === 'percent' ? 'Percent off' : 'Amount off'}
              <input required type="number" min="0.01" max={form.discount_type === 'percent' ? '100' : undefined} step="0.01" className="input-field mt-1" value={form.discount_value} onChange={update('discount_value')} />
            </label>
          </div>
          {form.discount_type === 'percent' && <label className="block text-sm font-medium text-ink/65">Max discount amount (optional cap)<input type="number" min="0.01" step="0.01" placeholder="No cap" className="input-field mt-1" value={form.max_discount_amount} onChange={update('max_discount_amount')} /></label>}
          <label className="block text-sm font-medium text-ink/65">Minimum spend<input type="number" min="0" step="0.01" className="input-field mt-1" value={form.min_spend} onChange={update('min_spend')} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-ink/65">Total use limit<input type="number" min="1" placeholder="Unlimited" className="input-field mt-1" value={form.usage_limit} onChange={update('usage_limit')} /></label>
            <label className="text-sm font-medium text-ink/65">Uses per customer<input required type="number" min="1" className="input-field mt-1" value={form.usage_limit_per_user} onChange={update('usage_limit_per_user')} /></label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <label className="text-sm font-medium text-ink/65">Starts<input required type="datetime-local" className="input-field mt-1 text-sm" value={form.starts_at} onChange={update('starts_at')} /></label>
            <label className="text-sm font-medium text-ink/65">Ends<input required type="datetime-local" className="input-field mt-1 text-sm" value={form.ends_at} onChange={update('ends_at')} /></label>
          </div>
          <button disabled={saving} className="btn-primary w-full">{saving ? 'Creating...' : 'Create voucher'}</button>
        </div>
      </form>

      <div>
        {loading ? <div className="flex justify-center py-24"><Spinner /></div> : (
          <DataTable
            columns={[
              { header: 'Code', accessor: 'code', render: (v) => <span className="font-mono font-semibold">{v.code}</span> },
              { header: 'Applies to', accessor: 'scope', render: (v) => <>{scopeLabel(v)}<p className="text-xs font-normal capitalize text-ink/45">{v.scope}</p></> },
              { header: 'Discount', accessor: 'discount_value', render: (v) => <span className="inline-flex items-center gap-1">{v.discount_type === 'percent' ? <><Percent size={12} />{Number(v.discount_value)}%</> : peso(v.discount_value)}</span> },
              { header: 'Used', accessor: 'voucher_redemptions', sortable: false, render: (v) => `${v.voucher_redemptions?.[0]?.count || 0}${v.usage_limit ? ` / ${v.usage_limit}` : ''}` },
              { header: 'Window', accessor: 'ends_at', format: 'datetime' },
              { header: 'Status', accessor: 'is_active', render: (v) => <Badge tone={STATE_TONE[state(v)]}>{state(v)}</Badge> }
            ]}
            data={vouchers}
            pageSize={20}
            searchPlaceholder="Search by code..."
            emptyTitle="No vouchers yet"
            emptyMessage="Create your first voucher using the form on the left."
            onEdit={openEdit}
            onDelete={remove}
            actions={[{ label: 'Enable/Disable', icon: <Power size={15} />, onClick: toggle }]}
          />
        )}
      </div>
    </div>

    {editing && <div className="fixed inset-0 z-[80] overflow-y-auto bg-scrim/55 p-3 sm:p-6">
      <form onSubmit={saveEdit} className="mx-auto max-w-lg rounded-2xl bg-surface p-5 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold flex items-center gap-2"><Ticket size={20} className="text-teal-700" />Edit voucher</h2><button type="button" onClick={() => setEditing(null)}><X /></button></div>
        <p className="mt-1 text-xs text-ink/45">Scope, code, and target (merchant/product/category) can't be changed after creation — create a new voucher instead if those need to change.</p>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-ink/65">Discount type
              <select className="input-field mt-1" value={editing.discount_type} onChange={(e) => setEditing({ ...editing, discount_type: e.target.value })}>
                <option value="percent">Percent</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>
            <label className="text-sm font-medium text-ink/65">Value<input required type="number" min="0.01" step="0.01" className="input-field mt-1" value={editing.discount_value} onChange={(e) => setEditing({ ...editing, discount_value: e.target.value })} /></label>
          </div>
          <label className="block text-sm font-medium text-ink/65">Max discount amount<input type="number" min="0.01" step="0.01" placeholder="No cap" className="input-field mt-1" value={editing.max_discount_amount} onChange={(e) => setEditing({ ...editing, max_discount_amount: e.target.value })} /></label>
          <label className="block text-sm font-medium text-ink/65">Minimum spend<input type="number" min="0" step="0.01" className="input-field mt-1" value={editing.min_spend} onChange={(e) => setEditing({ ...editing, min_spend: e.target.value })} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-ink/65">Total use limit<input type="number" min="1" placeholder="Unlimited" className="input-field mt-1" value={editing.usage_limit} onChange={(e) => setEditing({ ...editing, usage_limit: e.target.value })} /></label>
            <label className="text-sm font-medium text-ink/65">Uses per customer<input required type="number" min="1" className="input-field mt-1" value={editing.usage_limit_per_user} onChange={(e) => setEditing({ ...editing, usage_limit_per_user: e.target.value })} /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-ink/65">Starts<input required type="datetime-local" className="input-field mt-1 text-sm" value={editing.starts_at} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })} /></label>
            <label className="text-sm font-medium text-ink/65">Ends<input required type="datetime-local" className="input-field mt-1 text-sm" value={editing.ends_at} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value })} /></label>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink/65"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} className="h-4 w-4 rounded" />Active</label>
        </div>
        <div className="mt-6 flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button></div>
      </form>
    </div>}
  </div>
}
