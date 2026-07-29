import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Package, EyeOff, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { SAMPLE_PRODUCTS } from '../../config/sampleProducts'

export default function Products({ admin = false }) {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [merchants, setMerchants] = useState([])
  const [sampleMerchantId, setSampleMerchantId] = useState('')
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    load()
    if (admin) loadMerchants()
  }, [])

  const loadMerchants = async () => {
    const { data, error } = await supabase.rpc('get_admin_merchant_profiles')
    if (error) return toast.error(error.message)
    const approved = (data || []).filter((merchant) => merchant.status === 'approved')
    setMerchants(approved)
    if (approved.length === 1) setSampleMerchantId(approved[0].id)
  }

  const seedSamples = async () => {
    if (!sampleMerchantId) return toast.error('Choose an approved Merchant first.')
    setSeeding(true)
    const sampleSkus = SAMPLE_PRODUCTS.map((product) => product.sku)
    const { data: existing, error: checkError } = await supabase.from('products').select('id, sku').eq('merchant_id', sampleMerchantId).in('sku', sampleSkus)
    if (checkError) { setSeeding(false); return toast.error(checkError.message) }
    const existingSkus = new Set((existing || []).map((product) => product.sku))
    const missing = SAMPLE_PRODUCTS.filter((product) => !existingSkus.has(product.sku)).map((product) => ({ ...product, merchant_id: sampleMerchantId }))
    const updates = (existing || []).map((savedProduct) => {
      const sample = SAMPLE_PRODUCTS.find((product) => product.sku === savedProduct.sku)
      return supabase.from('products').update(sample).eq('id', savedProduct.id)
    })
    const updateResults = await Promise.all(updates)
    const updateError = updateResults.find((result) => result.error)?.error
    if (updateError) { setSeeding(false); return toast.error(updateError.message) }
    const { error } = missing.length ? await supabase.from('products').insert(missing) : { error: null }
    setSeeding(false)
    if (error) return toast.error(error.message)
    toast.success(missing.length ? `${missing.length} sample products added and sample photos refreshed.` : 'Sample products and photos refreshed.')
    load()
  }

  const load = async () => {
    setLoading(true)
    let query = supabase
      .from('products')
      .select(admin ? '*, merchant_profiles(business_name)' : '*')
      .order('created_at', { ascending: false })
    if (!admin) query = query.eq('merchant_id', user.id)
    const { data, error } = await query
    if (error) toast.error(error.message)
    setProducts(data || [])
    setLoading(false)
  }

  const toggleActive = async (product) => {
    await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Product deleted successfully.')
    load()
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-ink">Products</h1>
        <Link to={admin ? '/admin/products/new' : '/merchant/products/new'} className="btn-primary text-sm flex items-center gap-1.5">
          <Plus size={16} /> Add Product
        </Link>
      </div>

      {admin && <section className="mb-6 rounded-2xl border border-mango-300 bg-mango-100/50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4"><div><p className="flex items-center gap-2 font-display font-bold text-ink"><Sparkles size={18} className="text-mango-700" /> Ready-made sample catalog</p><p className="mt-1 text-xs leading-5 text-ink/55">Adds or refreshes four complete sample products with realistic photos, pricing, stock, discounts, and shipping details.</p></div><div className="mt-3 flex flex-col gap-2 sm:mt-0 sm:w-72"><select value={sampleMerchantId} onChange={(event) => setSampleMerchantId(event.target.value)} className="input-field py-2.5 text-sm"><option value="">Choose approved Merchant</option>{merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.business_name}</option>)}</select><button type="button" onClick={seedSamples} disabled={seeding || !sampleMerchantId} className="btn-accent flex items-center justify-center gap-2 py-2.5 text-sm"><Sparkles size={15} /> {seeding ? 'Updating samples...' : 'Add / Refresh Samples'}</button></div></section>}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          message="Add your first product so Resellers can discover it."
          action={<Link to={admin ? '/admin/products/new' : '/merchant/products/new'} className="btn-primary">Add Product</Link>}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div key={p.id} className="card overflow-hidden">
              <div className="aspect-video bg-teal-50 flex items-center justify-center overflow-hidden relative">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="text-teal-300" size={32} />
                )}
                {!p.is_active && (
                  <span className="absolute top-2 right-2 badge bg-scrim/70 text-white flex items-center gap-1">
                    <EyeOff size={12} /> Hidden
                  </span>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-ink truncate">{p.name}</h3>
                {admin && <p className="truncate text-xs font-semibold text-mango-700">{p.merchant_profiles?.business_name || 'Merchant'}</p>}
                <p className="text-teal-700 font-bold mt-1">{peso(p.price)}</p>
                <p className="text-xs text-ink/50">{p.stock_quantity} stock</p>
                <div className="flex items-center gap-2 mt-3">
                  <Link to={admin ? `/admin/products/${p.id}/edit` : `/merchant/products/${p.id}/edit`} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1">
                    <Pencil size={13} /> Edit
                  </Link>
                  <button onClick={() => toggleActive(p)} className="btn-secondary text-xs px-3 py-1.5">
                    {p.is_active ? 'Itago' : 'Ipakita'}
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 text-ink/40 hover:text-coral-500 ml-auto">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
