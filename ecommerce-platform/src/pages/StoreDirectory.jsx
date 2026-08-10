import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Store as StoreIcon, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import StarRating from '../components/product/StarRating'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'

// The "Stores" marketplace icon used to just open the filter drawer --
// the owner asked for an actual store directory instead ("Dito
// makikita yung mga store ng merchant"). Bulk-fetches ratings/product
// counts the same join-not-loop way Catalog.jsx/MerchantStore.jsx
// already do, rather than a query per store card.
export default function StoreDirectory() {
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      setLoading(true)
      const { data: merchants, error } = await supabase.from('merchant_profiles').select('id,business_name,business_description').eq('status', 'approved').order('business_name')
      if (error) { toast.error(error.message); setLoading(false); return }
      const merchantIds = (merchants || []).map((m) => m.id)
      const { data: products } = merchantIds.length
        ? await supabase.from('products').select('id,merchant_id').eq('is_active', true).in('merchant_id', merchantIds)
        : { data: [] }
      const productIds = (products || []).map((p) => p.id)
      const { data: reviews } = productIds.length
        ? await supabase.from('product_reviews').select('product_id,rating').in('product_id', productIds)
        : { data: [] }
      const merchantByProduct = Object.fromEntries((products || []).map((p) => [p.id, p.merchant_id]))
      const statsByMerchant = {}
      for (const product of products || []) {
        (statsByMerchant[product.merchant_id] ??= { productCount: 0, ratingSum: 0, reviewCount: 0 }).productCount += 1
      }
      for (const review of reviews || []) {
        const merchantId = merchantByProduct[review.product_id]
        if (!merchantId) continue
        const bucket = (statsByMerchant[merchantId] ??= { productCount: 0, ratingSum: 0, reviewCount: 0 })
        bucket.ratingSum += review.rating
        bucket.reviewCount += 1
      }
      setStores((merchants || []).map((merchant) => {
        const stats = statsByMerchant[merchant.id] || { productCount: 0, ratingSum: 0, reviewCount: 0 }
        return { ...merchant, productCount: stats.productCount, reviewCount: stats.reviewCount, avgRating: stats.reviewCount ? stats.ratingSum / stats.reviewCount : 0 }
      }))
      setLoading(false)
    })()
  }, [])

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Stores</h1>
        <p className="mt-1 text-sm text-ink/50">Browse every verified merchant store on JOM HUB.</p>
      </div>
      {loading ? (
        <div className="flex justify-center py-24"><Spinner /></div>
      ) : stores.length === 0 ? (
        <EmptyState icon={StoreIcon} title="No stores yet" message="Approved merchant stores will appear here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((store) => (
            <Link key={store.id} to={`/merchant-store/${store.id}`} className="card flex flex-col gap-3 p-5 transition hover:border-teal-200 hover:shadow-card">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><StoreIcon size={22} /></span>
                <div className="min-w-0">
                  <p className="truncate font-display font-bold text-ink">{store.business_name}</p>
                  {store.reviewCount > 0 ? (
                    <span className="flex items-center gap-1.5 text-xs text-ink/55"><StarRating value={store.avgRating} size={13} />{store.avgRating.toFixed(1)} ({store.reviewCount})</span>
                  ) : (
                    <span className="text-xs text-ink/40">No ratings yet</span>
                  )}
                </div>
              </div>
              {store.business_description && <p className="line-clamp-2 text-sm text-ink/55">{store.business_description}</p>}
              <p className="mt-auto flex items-center gap-1.5 text-xs font-semibold text-teal-700"><Package size={13} /> {store.productCount} product{store.productCount === 1 ? '' : 's'}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
