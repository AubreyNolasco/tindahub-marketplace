import { useCallback, useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Store, Package, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import ProductCard from '../components/product/ProductCard'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'

export default function MerchantStore() {
  const { id } = useParams()
  const { user, role } = useAuth()
  const [merchant, setMerchant] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: m, error: merchantErr }, { data: p, error: productsErr }] = await Promise.all([
      supabase.from('merchant_profiles').select('id,business_name,business_description,status,created_at').eq('id', id).maybeSingle(),
      supabase.from('products').select('*, merchant_profiles(business_name)').eq('merchant_id', id).eq('is_active', true)
    ])
    if (merchantErr) toast.error(merchantErr.message)
    if (productsErr) toast.error(productsErr.message)
    setMerchant(m)
    setProducts(p || [])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between gap-3 mb-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-teal-50 flex items-center justify-center">
            <Store className="text-teal-600" size={26} />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl text-ink">{merchant?.business_name}</h1>
          </div>
        </div>
        {user && user.id !== id && (role === 'reseller' || role === 'merchant') && (
          <Link to={`/${role}/chats/${id}`} className="btn-secondary flex items-center gap-2">
            <MessageCircle size={16} /> Message Merchant
          </Link>
        )}
      </div>

      {products.length === 0 ? (
        <EmptyState icon={Package} title="No products yet" message="This store has not listed any products yet." />
      ) : (
        <div className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-4 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  )
}
