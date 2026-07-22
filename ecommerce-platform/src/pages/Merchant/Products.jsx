import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Package, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

export default function Products({ admin = false }) {
  const { user } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

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
    if (!confirm('Sigurado ka bang gusto mo tanggalin ang produktong ito?')) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Natanggal ang produkto.')
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

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          message="Idagdag ang unang produkto mo para makita ng mga reseller."
          action={<Link to={admin ? '/admin/products/new' : '/merchant/products/new'} className="btn-primary">Magdagdag Ngayon</Link>}
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
                  <span className="absolute top-2 right-2 badge bg-ink/70 text-white flex items-center gap-1">
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
