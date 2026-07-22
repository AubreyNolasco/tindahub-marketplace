import { useEffect, useState } from 'react'
import { MessageSquareText, Star, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import StarRating from '../components/product/StarRating'

export default function ReviewsManagement({ admin = false }) {
  const { user } = useAuth()
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    let query = supabase.from('product_reviews').select('*, products!inner(name, merchant_id)').order('created_at', { ascending: false })
    if (!admin) query = query.eq('products.merchant_id', user.id)
    const { data, error } = await query
    if (error) toast.error(error.message)
    setReviews(data || [])
    setLoading(false)
  }
  useEffect(() => { if (user) load() }, [user?.id])

  const remove = async (id) => {
    if (!admin || !window.confirm('Delete this review?')) return
    const { error } = await supabase.from('product_reviews').delete().eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Review removed.')
    load()
  }

  return <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8"><div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Customer feedback</p><h1 className="mt-1 font-display text-2xl font-bold text-ink">Product Reviews & Ratings</h1><p className="mt-1 text-sm text-ink/50">Verified reviews submitted by resellers after completed orders.</p></div>
    {loading ? <div className="flex justify-center py-24"><Spinner /></div> : reviews.length === 0 ? <div className="card"><EmptyState icon={MessageSquareText} title="No reviews yet" message="Verified reseller reviews will appear here." /></div> : <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-soft"><div className="divide-y divide-black/[0.06]">{reviews.map((review) => <article key={review.id} className="p-4 sm:p-5"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate font-semibold text-ink">{review.products?.name}</p><div className="mt-1 flex flex-wrap items-center gap-2"><StarRating value={review.rating} size={15} /><span className="text-xs font-semibold text-ink/50">{review.rating}/5</span><span className="text-xs text-ink/30">•</span><span className="text-xs text-ink/45">{new Date(review.created_at).toLocaleDateString()}</span></div></div>{admin && <button onClick={() => remove(review.id)} className="rounded-xl p-2 text-coral-500 hover:bg-coral-100" title="Delete review"><Trash2 size={17} /></button>}</div><p className="mt-3 text-sm leading-6 text-ink/65">{review.comment}</p><p className="mt-3 text-xs font-semibold text-teal-700">{review.reviewer_name} · Verified purchase</p></article>)}</div></div>}
  </div>
}
