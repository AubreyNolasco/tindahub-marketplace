import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Loader2, Plus, ShieldAlert, Trash2, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { cleanText, safeUploadPath, validateImage } from '../../utils/security'
import { isCompleteAddress } from '../../utils/address'
import { findProductSafetyViolation, PROHIBITED_PRODUCT_RULES } from '../../config/productSafety'

const emptyForm = {
  name: '',
  description: '',
  sku: '',
  category_id: '',
  price: '',
  wholesale_price: '',
  suggested_retail_price: '',
  stock_quantity: '',
  min_order_qty: 1,
  discount_tiers: [],
  packed_weight_kg: '', packed_length_cm: '', packed_width_cm: '', packed_height_cm: '',
  product_type: '', fragile: false, keep_upright: false, motorcycle_safe: false
}

export default function ProductForm({ admin = false }) {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [form, setForm] = useState(emptyForm)
  const [categories, setCategories] = useState([])
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [existingImage, setExistingImage] = useState(null)
  const [saving, setSaving] = useState(false)
  const [merchants, setMerchants] = useState([])
  const [merchantId, setMerchantId] = useState('')
  const [safetyConfirmed, setSafetyConfirmed] = useState(false)

  useEffect(() => {
    loadCategories()
    if (admin) loadMerchants()
    if (isEdit) loadProduct()
  }, [id])

  const loadMerchants = async () => {
    const { data, error } = await supabase.rpc('get_admin_merchant_profiles')
    if (error) return toast.error(error.message)
    const approved = (data || []).filter((merchant) => merchant.status === 'approved')
    setMerchants(approved)
    if (!isEdit && approved.length === 1) setMerchantId(approved[0].id)
  }

  const loadCategories = async () => {
    const { data, error } = await supabase.from('categories').select('*').order('name')
    if (error) toast.error(error.message)
    setCategories(data || [])
  }

  const loadProduct = async () => {
    const { data, error } = await supabase.from('products').select('*').eq('id', id).maybeSingle()
    if (error) toast.error(error.message)
    if (data) {
      setMerchantId(data.merchant_id)
      setForm({
        name: data.name,
        description: data.description || '',
        sku: data.sku || '',
        category_id: data.category_id || '',
        price: data.price,
        wholesale_price: data.wholesale_price || '',
        suggested_retail_price: data.suggested_retail_price || data.price || '',
        stock_quantity: data.stock_quantity,
        min_order_qty: data.min_order_qty,
        discount_tiers: Array.isArray(data.discount_tiers) ? data.discount_tiers.map((tier) => ({
          ...tier,
          discount_percent: tier.discount_percent || (data.price ? Number(((1 - Number(tier.price) / Number(data.price)) * 100).toFixed(2)) : '')
        })) : [],
        packed_weight_kg: data.packed_weight_kg || '', packed_length_cm: data.packed_length_cm || '',
        packed_width_cm: data.packed_width_cm || '', packed_height_cm: data.packed_height_cm || '',
        product_type: data.product_type || '', fragile: Boolean(data.fragile), keep_upright: Boolean(data.keep_upright), motorcycle_safe: Boolean(data.motorcycle_safe)
      })
      setExistingImage(data.images?.[0] || null)
    }
  }

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))
  const toggle = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.checked }))
  const addTier = () => setForm((current) => ({ ...current, discount_tiers: [...current.discount_tiers, { min_qty: '', discount_percent: '' }] }))
  const updateTier = (index, key, value) => setForm((current) => ({ ...current, discount_tiers: current.discount_tiers.map((tier, tierIndex) => tierIndex === index ? { ...tier, [key]: value } : tier) }))
  const removeTier = (index) => setForm((current) => ({ ...current, discount_tiers: current.discount_tiers.filter((_, tierIndex) => tierIndex !== index) }))

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fileError = validateImage(file)
    if (fileError) { toast.error(fileError); e.target.value = ''; return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!admin && !isCompleteAddress(profile?.merchant_profiles?.business_address)) { toast.error('Complete your merchant pickup address before uploading a product.'); navigate('/merchant/address'); return }
    if (admin && !merchantId) return toast.error('Choose the Merchant that owns this product.')
    if (!safetyConfirmed) return toast.error('Confirm the product safety and posting rules before saving.')
    const safetyViolation = findProductSafetyViolation(form)
    if (safetyViolation) return toast.error(`This listing contains prohibited content: “${safetyViolation}”. Remove it or contact Admin for review.`)
    setSaving(true)
    try {
      let images = existingImage ? [existingImage] : []

      if (imageFile) {
        const path = safeUploadPath(user.id, 'product', imageFile)
        const { error: uploadErr } = await supabase.storage
          .from('product-images')
          .upload(path, imageFile, { upsert: true })
        if (uploadErr) throw uploadErr
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path)
        images = [urlData.publicUrl]
      }

      const resellerBasePrice = Number(form.wholesale_price || form.price)
      const suggestedRetailPrice = Number(form.suggested_retail_price || form.price)
      if (resellerBasePrice <= 0 || suggestedRetailPrice <= resellerBasePrice) throw new Error('Suggested retail price must be higher than the reseller buying price.')
      if (((suggestedRetailPrice - resellerBasePrice) / suggestedRetailPrice) * 100 < 15) throw new Error('The reseller offer must leave at least 15% projected gross margin.')
      const discountTiers = form.discount_tiers.map((tier) => {
        const discountPercent = Number(tier.discount_percent)
        return { min_qty: Number(tier.min_qty), discount_percent: discountPercent, price: Number((resellerBasePrice * (1 - discountPercent / 100)).toFixed(2)) }
      }).sort((a, b) => a.min_qty - b.min_qty)
      if (discountTiers.some((tier) => !Number.isInteger(tier.min_qty) || tier.min_qty < 2 || tier.discount_percent <= 0 || tier.discount_percent >= 100 || tier.price <= 0)) throw new Error('Quantity must be at least 2 and discount must be between 1% and 99%.')
      if (new Set(discountTiers.map((tier) => tier.min_qty)).size !== discountTiers.length) throw new Error('Each discount quantity must be unique.')
      const payload = {
        merchant_id: admin ? merchantId : user.id,
        name: cleanText(form.name, 200),
        description: cleanText(form.description, 5000),
        sku: cleanText(form.sku, 100),
        category_id: form.category_id || null,
        price: Number(form.price),
        wholesale_price: form.wholesale_price ? Number(form.wholesale_price) : null,
        suggested_retail_price: form.suggested_retail_price ? Number(form.suggested_retail_price) : Number(form.price),
        stock_quantity: Number(form.stock_quantity),
        min_order_qty: Number(form.min_order_qty) || 1,
        discount_tiers: discountTiers,
        packed_weight_kg: Number(form.packed_weight_kg), packed_length_cm: Number(form.packed_length_cm),
        packed_width_cm: Number(form.packed_width_cm), packed_height_cm: Number(form.packed_height_cm),
        product_type: cleanText(form.product_type, 100), fragile: form.fragile, keep_upright: form.keep_upright, motorcycle_safe: form.motorcycle_safe,
        images
      }

      if (isEdit) {
        const { error } = await supabase.from('products').update(payload).eq('id', id)
        if (error) throw error
        toast.success('Product updated successfully.')
      } else {
        const { error } = await supabase.from('products').insert(payload)
        if (error) throw error
        toast.success('Product added successfully.')
      }
      navigate(admin ? '/admin/products' : '/merchant/products')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {!admin && !isCompleteAddress(profile?.merchant_profiles?.business_address) && <div className="mb-5 rounded-2xl border border-mango-300 bg-mango-100/60 p-4 text-sm text-ink/65">Complete your pickup address before uploading products. <button onClick={() => navigate('/merchant/address')} className="font-bold text-teal-700 underline">Update address</button></div>}
      <h1 className="font-display font-bold text-2xl text-ink mb-6">
        {isEdit ? 'Edit Product' : 'New Product'}
      </h1>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {admin && <label className="block text-sm font-semibold text-ink/70">Product owner (Merchant)<select required className="input-field mt-1" value={merchantId} onChange={(event) => setMerchantId(event.target.value)} disabled={isEdit}><option value="">Choose approved Merchant</option>{merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.business_name} · {merchant.profile_full_name}</option>)}</select>{isEdit && <span className="mt-1 block text-[11px] font-normal text-ink/40">Product ownership is locked while editing.</span>}</label>}
        <div>
          <label className="text-sm font-medium text-ink/70">Product Image</label>
          <label className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-teal-200 rounded-xl p-6 cursor-pointer hover:bg-teal-50 transition-colors relative">
            {(imagePreview || existingImage) ? (
              <img src={imagePreview || existingImage} alt="preview" className="max-h-40 rounded-lg" />
            ) : (
              <>
                <Upload className="text-teal-400 mb-2" size={24} />
                <span className="text-sm text-ink/60">Click to upload</span>
              </>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>
        </div>

        <div>
          <label className="text-sm font-medium text-ink/70">Product Name</label>
          <input required className="input-field mt-1" value={form.name} onChange={update('name')} />
        </div>

        <div>
          <label className="text-sm font-medium text-ink/70">Description</label>
          <textarea className="input-field mt-1" rows={3} value={form.description} onChange={update('description')} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-ink/70">Category</label>
            <select className="input-field mt-1" value={form.category_id} onChange={update('category_id')}>
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-ink/70">SKU (optional)</label>
            <input className="input-field mt-1" value={form.sku} onChange={update('sku')} />
          </div>
        </div>

        <div className="rounded-2xl border border-teal-100 bg-teal-50/50 p-4">
          <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-ink">Reseller Quantity Discounts</p><p className="mt-0.5 text-xs text-ink/50">Enter how many items qualify and the percentage discount.</p></div><button type="button" onClick={addTier} className="btn-secondary flex shrink-0 items-center gap-1 px-3 py-2 text-xs"><Plus size={14} /> Add discount</button></div>
          {form.discount_tiers.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-teal-200 bg-white/60 p-4 text-center text-xs text-ink/45">No reseller discounts yet.</p> : <div className="mt-4 space-y-2">{form.discount_tiers.map((tier, index) => <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-xl bg-white p-3"><label className="text-xs font-medium text-ink/55">Minimum quantity<input required type="number" min="2" step="1" className="input-field mt-1" value={tier.min_qty} onChange={(event) => updateTier(index, 'min_qty', event.target.value)} placeholder="10" /></label><label className="text-xs font-medium text-ink/55">Discount from buying price<input required type="number" min="0.01" max="99" step="0.01" className="input-field mt-1" value={tier.discount_percent} onChange={(event) => updateTier(index, 'discount_percent', event.target.value)} placeholder="10%" /></label><button type="button" onClick={() => removeTier(index)} className="mb-0.5 rounded-xl p-3 text-coral-500 hover:bg-coral-100" title="Remove discount"><Trash2 size={17} /></button>{(form.wholesale_price || form.price) && tier.discount_percent > 0 && <p className="col-span-2 text-xs font-semibold text-teal-700">Quantity reseller price: ₱{(Number(form.wholesale_price || form.price) * (1 - Number(tier.discount_percent) / 100)).toFixed(2)} each</p>}</div>)}</div>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-ink/70">Retail Price (₱)</label>
            <input required type="number" step="0.01" min="0" className="input-field mt-1" value={form.price} onChange={update('price')} />
          </div>
          <div>
            <label className="text-sm font-medium text-ink/70">Wholesale Price (optional)</label>
            <input type="number" step="0.01" min="0" className="input-field mt-1" value={form.wholesale_price} onChange={update('wholesale_price')} />
          </div>
        </div>
        <div className="rounded-2xl border border-mango-300 bg-mango-100/50 p-4"><label className="text-sm font-semibold text-ink">Suggested Reseller Retail Price (₱)<input required type="number" step="0.01" min="0" className="input-field mt-1 bg-white" value={form.suggested_retail_price} onChange={update('suggested_retail_price')} /></label><p className="mt-2 text-xs leading-5 text-ink/55">Wholesale must leave at least 15% projected gross margin at this suggested price. The complete one-piece and bulk earnings preview below includes the capped system fee.</p></div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-ink/70">Stock Quantity</label>
            <input required type="number" min="0" className="input-field mt-1" value={form.stock_quantity} onChange={update('stock_quantity')} />
          </div>
          <div>
            <label className="text-sm font-medium text-ink/70">Minimum Order Qty</label>
            <input required type="number" min="1" className="input-field mt-1" value={form.min_order_qty} onChange={update('min_order_qty')} />
          </div>
        </div>

        <div className="rounded-2xl border border-teal-100 bg-cream p-4"><h2 className="font-display font-bold text-ink">Packed Shipping Information</h2><p className="mt-1 text-xs leading-5 text-ink/50">Enter the final packed values for one item. Dimensions are Length × Width × Height.</p><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><label className="text-xs font-medium text-ink/60">Actual weight (kg)<input required type="number" min="0.001" step="0.001" className="input-field mt-1" value={form.packed_weight_kg} onChange={update('packed_weight_kg')} /></label><label className="text-xs font-medium text-ink/60">Length (cm)<input required type="number" min="0.01" step="0.01" className="input-field mt-1" value={form.packed_length_cm} onChange={update('packed_length_cm')} /></label><label className="text-xs font-medium text-ink/60">Width (cm)<input required type="number" min="0.01" step="0.01" className="input-field mt-1" value={form.packed_width_cm} onChange={update('packed_width_cm')} /></label><label className="text-xs font-medium text-ink/60">Height (cm)<input required type="number" min="0.01" step="0.01" className="input-field mt-1" value={form.packed_height_cm} onChange={update('packed_height_cm')} /></label></div><div className="mt-3 rounded-xl border border-teal-100 bg-white p-3"><p className="text-[11px] uppercase tracking-wide text-ink/40">Automatic package volume</p><p className="mt-1 font-display text-lg font-bold text-teal-700">{(Number(form.packed_length_cm || 0) * Number(form.packed_width_cm || 0) * Number(form.packed_height_cm || 0)).toLocaleString()} cm³</p><p className="mt-0.5 text-[11px] text-ink/40">Used only for vehicle fit—not as a separate volumetric charge.</p></div><label className="mt-3 block text-xs font-medium text-ink/60">Product type<input required maxLength="100" className="input-field mt-1" value={form.product_type} onChange={update('product_type')} placeholder="Food tray, bottled drinks, cake..." /></label><div className="mt-4 grid gap-2 sm:grid-cols-3"><label className="flex items-center gap-2 rounded-xl bg-white p-3 text-xs font-semibold text-ink/65"><input type="checkbox" checked={form.fragile} onChange={toggle('fragile')} className="accent-teal-600" /> Fragile</label><label className="flex items-center gap-2 rounded-xl bg-white p-3 text-xs font-semibold text-ink/65"><input type="checkbox" checked={form.keep_upright} onChange={toggle('keep_upright')} className="accent-teal-600" /> Keep upright</label><label className="flex items-center gap-2 rounded-xl bg-white p-3 text-xs font-semibold text-ink/65"><input type="checkbox" checked={form.motorcycle_safe} onChange={toggle('motorcycle_safe')} className="accent-teal-600" /> Motorcycle-safe</label></div></div>

        <section className="rounded-2xl border border-coral-200 bg-coral-50/60 p-4">
          <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 shrink-0 text-coral-600" size={22} /><div><h2 className="font-display font-bold text-ink">Product Posting Safety Rules</h2><p className="mt-1 text-xs leading-5 text-ink/55">For reseller and customer safety, JOM HUB may reject, deactivate, or investigate unlawful, unsafe, misleading, or unverified regulated listings.</p></div></div>
          <details className="mt-4 rounded-xl border border-coral-100 bg-white p-3"><summary className="cursor-pointer text-sm font-bold text-coral-700">View products and content that cannot be posted</summary><div className="mt-3 grid gap-2 sm:grid-cols-2">{PROHIBITED_PRODUCT_RULES.map((rule) => <div key={rule.title} className="rounded-lg bg-cream p-3"><p className="text-xs font-bold text-ink">{rule.title}</p><p className="mt-1 text-[11px] leading-5 text-ink/50">{rule.detail}</p></div>)}</div></details>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-coral-200 bg-white p-3 text-xs leading-5 text-ink/65"><input required type="checkbox" checked={safetyConfirmed} onChange={(event) => setSafetyConfirmed(event.target.checked)} className="mt-1 accent-coral-600" /><span>I confirm that this product is lawful, authentic, safe, not expired/recalled, accurately described, and has all required registrations, permits, and certifications. I accept responsibility for the listing and supporting documents.</span></label>
        </section>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving || !safetyConfirmed || (admin ? !merchantId : !isCompleteAddress(profile?.merchant_profiles?.business_address))} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Saving...' : 'Save Product'}
          </button>
          <button type="button" onClick={() => navigate(admin ? '/admin/products' : '/merchant/products')} className="btn-secondary flex items-center gap-1">
            <X size={16} /> Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
