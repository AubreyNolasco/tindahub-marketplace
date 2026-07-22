import { Star } from 'lucide-react'

export default function StarRating({ value = 0, onChange, size = 17 }) {
  return <div className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((star) => onChange ? <button key={star} type="button" onClick={() => onChange(star)} className="rounded p-0.5 transition hover:scale-110" aria-label={`Rate ${star} stars`}><Star size={size} className={star <= value ? 'fill-mango-500 text-mango-500' : 'text-black/15'} /></button> : <Star key={star} size={size} className={star <= Math.round(value) ? 'fill-mango-500 text-mango-500' : 'text-black/15'} />)}
  </div>
}
