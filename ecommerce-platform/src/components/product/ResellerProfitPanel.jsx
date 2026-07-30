import { TrendingUp } from 'lucide-react'
import { peso } from '../../utils/format'
import { getResellerProfitEstimate } from '../../utils/pricing'

export default function ResellerProfitPanel({ product, quantity, sellingPrice, onSellingPriceChange, compact = false }) {
  const estimate = getResellerProfitEstimate(product, quantity, sellingPrice)
  const profitable = estimate.estimatedProfit > 0
  return <section className={`rounded-2xl border p-4 ${profitable ? 'border-mango-300 bg-mango-100/50' : 'border-coral-200 bg-coral-50'}`}>
    <div className="flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-bold text-ink"><TrendingUp size={17} className={profitable ? 'text-mango-700' : 'text-coral-600'} /> Reseller Profit Calculator</p><p className="mt-1 text-[11px] leading-5 text-ink/50">{estimate.quantity === 1 ? 'Per-piece order' : `${estimate.quantity}-piece / bulk order`}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${profitable ? 'bg-teal-700 text-white' : 'bg-coral-100 text-coral-700'}`}>{profitable ? 'WITH PROFIT' : 'ADJUST PRICE'}</span></div>
    <label className="mt-3 block text-xs font-semibold text-ink/65">Your customer selling price per item<input type="number" min="0" step="0.01" value={sellingPrice} onChange={(event) => onSellingPriceChange(event.target.value)} className="input-field mt-1 bg-surface" /></label>
    <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}><div><p className="text-[10px] text-ink/40">Buying price</p><p className="text-sm font-bold text-teal-700">{peso(estimate.buyingUnitPrice)} each</p></div><div><p className="text-[10px] text-ink/40">Customer total</p><p className="text-sm font-bold text-ink">{peso(estimate.customerTotal)}</p></div><div><p className="text-[10px] text-ink/40">System fee</p><p className="text-sm font-bold text-ink">{peso(estimate.systemFee)}</p></div><div><p className="text-[10px] text-ink/40">Estimated profit</p><p className={`text-sm font-extrabold ${profitable ? 'text-teal-700' : 'text-coral-600'}`}>{peso(estimate.estimatedProfit)}</p></div></div>
    <p className="mt-3 text-[10px] leading-4 text-ink/45">Estimate after the capped system fee, before delivery, marketing, returns, and taxes. Final customer price remains under the Reseller's control.</p>
  </section>
}
