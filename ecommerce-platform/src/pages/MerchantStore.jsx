import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Store, Package, MessageCircle, Tag, BadgeCheck, ShieldCheck, Truck, Award } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import ProductCard from '../components/product/ProductCard'
import StarRating from '../components/product/StarRating'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import { applyCampaignDiscount, getActiveCampaignDiscounts, getActiveCampaignProducts } from '../utils/campaigns'

// Same honesty rule as Catalog.jsx's marketplace-wide badges — describe
// what this platform actually does, not a copy of generic storefront
// badge copy.
const STORE_BADGES = [
  { icon: BadgeCheck, text: 'Approved Merchant' },
  { icon: ShieldCheck, text: 'Wallet-Protected Payments' },
  { icon: Truck, text: 'Order Tracking' },
]

export default function MerchantStore() {
  const { id } = useParams()
  const { user, role } = useAuth()
  const [merchant, setMerchant] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: m, error: merchantErr }, { data: p, error: productsErr }, discounts, campaignProducts] = await Promise.all([
      supabase.from('merchant_profiles').select('id,business_name,business_description,status,created_at').eq('id', id).maybeSingle(),
      supabase.from('products').select('*, merchant_profiles(business_name)').eq('merchant_id', id).eq('is_active', true),
      getActiveCampaignDiscounts(),
      getActiveCampaignProducts()
    ])
    if (merchantErr) toast.error(merchantErr.message)
    if (productsErr) toast.error(productsErr.message)
    setMerchant(m)

    const productIds = (p || []).map((product) => product.id)
    const [reviewsResult, soldResult] = await Promise.all([
      productIds.length ? supabase.from('product_reviews').select('product_id, rating').in('product_id', productIds) : Promise.resolve({ data: [] }),
      productIds.length ? supabase.rpc('get_product_sold_counts', { p_product_ids: productIds }) : Promise.resolve({ data: [] }),
    ])
    const ratingsByProduct = {}
    for (const review of reviewsResult.data || []) {
      const bucket = (ratingsByProduct[review.product_id] ??= { sum: 0, count: 0 })
      bucket.sum += review.rating
      bucket.count += 1
    }
    const soldByProduct = Object.fromEntries((soldResult.data || []).map((row) => [row.product_id, row.sold_count]))
    setProducts((p || []).map((product) => ({
      ...applyCampaignDiscount(product, discounts, campaignProducts),
      avg_rating: ratingsByProduct[product.id] ? ratingsByProduct[product.id].sum / ratingsByProduct[product.id].count : 0,
      review_count: ratingsByProduct[product.id]?.count || 0,
      sold_count: soldByProduct[product.id] || 0,
    })))
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const storeRating = useMemo(() => {
    const withReviews = products.filter((p) => p.review_count > 0)
    const totalReviews = withReviews.reduce((sum, p) => sum + p.review_count, 0)
    if (!totalReviews) return { average: 0, count: 0 }
    const weightedSum = withReviews.reduce((sum, p) => sum + p.avg_rating * p.review_count, 0)
    return { average: weightedSum / totalReviews, count: totalReviews }
  }, [products])
  const bestSellers = useMemo(() => [...products].filter((p) => p.sold_count > 0).sort((a, b) => b.sold_count - a.sold_count).slice(0, 5), [products])

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="min-h-screen bg-bg">
      <div className="border-b border-black/[0.06] bg-gradient-to-br from-teal-950 via-teal-900 to-teal-700">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/15 text-white sm:h-20 sm:w-20"><Store size={32} /></div>
              <div>
                <div className="flex flex-wrap items-center gap-2"><h1 className="font-display text-xl font-bold text-white sm:text-2xl">{merchant?.business_name}</h1>{merchant?.status === 'approved' && <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold text-white"><BadgeCheck size={13} /> Official Store</span>}</div>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-white/75">
                  {storeRating.count > 0 ? <span className="flex items-center gap-1.5"><StarRating value={storeRating.average} size={14} />{storeRating.average.toFixed(1)} ({storeRating.count} review{storeRating.count === 1 ? '' : 's'})</span> : <span>No ratings yet</span>}
                  <span className="text-white/40">·</span>
                  <span>{products.length} product{products.length === 1 ? '' : 's'}</span>
                </div>
              </div>
            </div>
            {user && user.id !== id && (role === 'reseller' || role === 'merchant') && (
              <Link to={`/${role}/chats/${id}`} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-teal-800 transition hover:bg-white/90">
                <MessageCircle size={16} /> Chat
              </Link>
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            {STORE_BADGES.map(({ icon: Icon, text }) => <span key={text} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85"><Icon size={14} />{text}</span>)}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {products.length === 0 ? (
          <EmptyState icon={Package} title="No products yet" message="This store has not listed any products yet." />
        ) : (
          <>
            {bestSellers.length > 0 && (
              <div className="mb-8">
                <div className="mb-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-100 text-teal-700"><Award size={16} /></span><h2 className="font-display text-lg font-bold text-ink">Best Selling Products</h2></div>
                <div className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-4 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
                  {bestSellers.map((p) => <ProductCard key={p.id} product={p} />)}
                </div>
              </div>
            )}
            {products.some((p) => p.campaign_discount_percent > 0) && (
              <div className="mb-8">
                <div className="mb-3 flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-mango-100 text-mango-600 dark:bg-mango-500/15"><Tag size={16} /></span><h2 className="font-display text-lg font-bold text-ink">On campaign right now</h2></div>
                <div className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-4 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                  {products.filter((p) => p.campaign_discount_percent > 0).map((p) => <ProductCard key={p.id} product={p} />)}
                </div>
              </div>
            )}
            <div>
              <h2 className="mb-3 font-display text-lg font-bold text-ink">All Products</h2>
              <div className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-4 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {products.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
