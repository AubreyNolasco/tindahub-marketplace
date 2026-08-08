import { useCallback, useEffect, useMemo, useState } from 'react'
import { Baby, BadgeCheck, Car, ChevronDown, Cookie, Dumbbell, Filter, Gem, Gift, Hammer, Home as HomeIcon, LayoutGrid, PackageSearch, Pill, Search, ShieldCheck, Shirt, SlidersHorizontal, Smartphone, Sparkles, Store, Tag, Truck, X, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import ProductCard from '../components/product/ProductCard'
import CampaignCountdown from '../components/product/CampaignCountdown'
import StarRating from '../components/product/StarRating'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import { applyCampaignDiscount, getActiveCampaignDiscounts, getActiveCampaignProducts } from '../utils/campaigns'
import { isStoreOpen } from '../utils/storeHours'

// Honest to what this platform actually guarantees — not a copy of a
// generic marketplace's trust-badge copy ("Free Shipping" isn't a JOM
// HUB promise; shipping is receiver-pays or reseller-arranged).
const TRUST_BADGES = [
  { icon: ShieldCheck, title: 'Wallet-Protected Payments', text: 'Escrow-style checkout, held safely until delivery' },
  { icon: BadgeCheck, title: 'Verified Merchants', text: 'Every store is approved before it can list' },
  { icon: Truck, title: 'Real-Time Order Tracking', text: 'Follow every order from packed to delivered' },
]

// Keyword -> icon for the Shopee/Lazada-style category row. Purely
// presentational (no schema change — `categories` has no icon column),
// falls back to a generic grid icon for anything unmatched.
const CATEGORY_ICON_RULES = [
  [/electronic|gadget|phone|mobile|computer/i, Smartphone],
  [/fashion|cloth|apparel|shoe|bag/i, Shirt],
  [/beauty|cosmetic|skin|personal care/i, Sparkles],
  [/health|wellness|vitamin|medicine|pharma/i, Pill],
  [/home|furniture|kitchen|appliance/i, HomeIcon],
  [/food|grocery|snack|beverage/i, Cookie],
  [/baby|kid|toy/i, Baby],
  [/sport|fitness|outdoor|gym/i, Dumbbell],
  [/auto|motor|vehicle|car/i, Car],
  [/tool|hardware|construction/i, Hammer],
  [/jewel|watch|accessor/i, Gem],
  [/gift|occasion|party/i, Gift],
]
function getCategoryIcon(name = '') {
  return CATEGORY_ICON_RULES.find(([pattern]) => pattern.test(name))?.[1] || Tag
}

function FilterPanel({ categories, merchants, activeCategory, setActiveCategory, activeMerchant, setActiveMerchant, categorySearch, setCategorySearch, storeSearch, setStoreSearch, minPrice, setMinPrice, maxPrice, setMaxPrice, minRating, setMinRating, clearFilters, onClose }) {
  const [expanded, setExpanded] = useState({})
  const search = categorySearch.toLowerCase()
  const categoryTree = categories
    .filter((category) => !category.parent_id)
    .map((parent) => ({
      ...parent,
      children: categories.filter((c) => c.parent_id === parent.id && (!search || c.name.toLowerCase().includes(search))),
    }))
    .filter((parent) => !search || parent.name.toLowerCase().includes(search) || parent.children.length > 0)
  const visibleMerchants = merchants.filter((merchant) => merchant.business_name.toLowerCase().includes(storeSearch.toLowerCase()))
  return <div className="flex h-full flex-col bg-surface">
    <div className="flex items-center justify-between border-b border-black/5 px-5 py-4"><div className="flex items-center gap-2"><SlidersHorizontal size={18} className="text-teal-600" /><h2 className="font-display font-bold text-ink">Filters</h2></div>{onClose && <button onClick={onClose} className="rounded-lg p-1.5 text-ink/45 hover:bg-black/5"><X size={19} /></button>}</div>
    <div className="flex-1 divide-y divide-black/5 overflow-y-auto">
      <section className="p-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Categories</h3>{activeCategory && <button onClick={() => setActiveCategory(null)} className="text-[11px] font-semibold text-teal-700">Clear</button>}</div><label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" /><input value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className="input-field py-2 pl-9 text-xs" placeholder="Search category" /></label><div className="mt-3 space-y-1">
        <button onClick={() => setActiveCategory(null)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${!activeCategory ? 'bg-teal-50 font-semibold text-teal-800' : 'text-ink/60 hover:bg-black/[0.03]'}`}><span>All categories</span>{!activeCategory && <span className="h-2 w-2 rounded-full bg-teal-500" />}</button>
        {categoryTree.map((category) => {
          const isExpanded = expanded[category.id] || (search && category.children.length > 0)
          return <div key={category.id}>
            <div className={`flex w-full items-center rounded-lg text-left text-sm ${activeCategory === category.id ? 'bg-teal-50 font-semibold text-teal-800' : 'text-ink/60 hover:bg-black/[0.03]'}`}>
              <button onClick={() => setActiveCategory(category.id)} className="flex flex-1 items-center justify-between px-3 py-2"><span className="truncate">{category.name}</span>{activeCategory === category.id && <span className="h-2 w-2 rounded-full bg-teal-500" />}</button>
              {category.children.length > 0 && <button onClick={() => setExpanded((e) => ({ ...e, [category.id]: !e[category.id] }))} className="px-2 py-2 text-ink/40" aria-label={isExpanded ? `Collapse ${category.name}` : `Expand ${category.name}`}><ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} /></button>}
            </div>
            {isExpanded && category.children.length > 0 && <div className="ml-4 mt-1 space-y-1 border-l border-black/10 pl-3">
              {category.children.map((child) => <button key={child.id} onClick={() => setActiveCategory(child.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs ${activeCategory === child.id ? 'bg-teal-50 font-semibold text-teal-800' : 'text-ink/55 hover:bg-black/[0.03]'}`}><span className="truncate">{child.name}</span>{activeCategory === child.id && <span className="h-2 w-2 rounded-full bg-teal-500" />}</button>)}
            </div>}
          </div>
        })}
        {categoryTree.length === 0 && <p className="px-3 py-3 text-xs text-ink/40">No matching category</p>}
      </div></section>

      <section className="p-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Stores</h3>{activeMerchant && <button onClick={() => setActiveMerchant(null)} className="text-[11px] font-semibold text-teal-700">Clear</button>}</div><label className="relative block"><Store size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" /><input value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} className="input-field py-2 pl-9 text-xs" placeholder="Search store name" /></label><div className="mt-3 space-y-1"><button onClick={() => setActiveMerchant(null)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${!activeMerchant ? 'bg-teal-50 font-semibold text-teal-800' : 'text-ink/60 hover:bg-black/[0.03]'}`}><span>All stores</span>{!activeMerchant && <span className="h-2 w-2 rounded-full bg-teal-500" />}</button>{visibleMerchants.map((merchant) => <button key={merchant.id} onClick={() => setActiveMerchant(merchant.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${activeMerchant === merchant.id ? 'bg-teal-50 font-semibold text-teal-800' : 'text-ink/60 hover:bg-black/[0.03]'}`}><span className="truncate">{merchant.business_name}</span>{activeMerchant === merchant.id && <span className="h-2 w-2 rounded-full bg-teal-500" />}</button>)}{visibleMerchants.length === 0 && <p className="px-3 py-3 text-xs text-ink/40">No matching store</p>}</div></section>

      <section className="p-5"><h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Price range</h3><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[11px] font-medium text-ink/45">Minimum<div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink/35">₱</span><input type="number" min="0" step="1" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="input-field py-2 pl-7 pr-2 text-xs" placeholder="0" /></div></label><label className="text-[11px] font-medium text-ink/45">Maximum<div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink/35">₱</span><input type="number" min="0" step="1" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="input-field py-2 pl-7 pr-2 text-xs" placeholder="Any" /></div></label></div></section>

      <section className="p-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Rating</h3>{minRating > 0 && <button onClick={() => setMinRating(0)} className="text-[11px] font-semibold text-teal-700">Clear</button>}</div><div className="space-y-1">{[4, 3, 2, 1].map((stars) => <button key={stars} onClick={() => setMinRating(stars)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${minRating === stars ? 'bg-teal-50 font-semibold text-teal-800' : 'text-ink/60 hover:bg-black/[0.03]'}`}><StarRating value={stars} size={14} /><span>& up</span></button>)}</div></section>
    </div>
    <div className="border-t border-black/5 p-4"><button onClick={clearFilters} className="btn-secondary w-full py-2 text-xs">Clear all filters</button></div>
  </div>
}

export default function Catalog() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [merchants, setMerchants] = useState([])
  const [activeCategory, setActiveCategory] = useState(null)
  const [activeMerchant, setActiveMerchant] = useState(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categorySearch, setCategorySearch] = useState('')
  const [storeSearch, setStoreSearch] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [minRating, setMinRating] = useState(0)
  const [sort, setSort] = useState('newest')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { Promise.all([supabase.from('categories').select('*').order('name'), supabase.from('merchant_profiles').select('id,business_name').eq('status', 'approved').order('business_name')]).then(([categoryResult, merchantResult]) => { if (categoryResult.error || merchantResult.error) toast.error(categoryResult.error?.message || merchantResult.error?.message); setCategories(categoryResult.data || []); setMerchants(merchantResult.data || []) }) }, [])
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => clearTimeout(timer) }, [search])
  const loadProducts = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('products').select('*, merchant_profiles(business_name,store_open_time,store_close_time,auto_pause_outside_hours,store_timezone)').eq('is_active', true)
    if (activeCategory) {
      // A parent category with subcategories matches products filed
      // directly under it OR under any of its (one-level-deep) children —
      // otherwise selecting "Electronics" would show nothing if every
      // product were actually tagged under "Electronics > Phones".
      const childIds = categories.filter((c) => c.parent_id === activeCategory).map((c) => c.id)
      query = childIds.length ? query.in('category_id', [activeCategory, ...childIds]) : query.eq('category_id', activeCategory)
    }
    if (activeMerchant) query = query.eq('merchant_id', activeMerchant)
    if (debouncedSearch) {
      const searchTerm = debouncedSearch.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
      if (searchTerm) {
        const searchPattern = `%${searchTerm}%`
        const [storeMatches, categoryMatches] = await Promise.all([
          supabase.from('merchant_profiles').select('id').eq('status', 'approved').ilike('business_name', searchPattern),
          supabase.from('categories').select('id').ilike('name', searchPattern),
        ])
        const conditions = [
          `name.ilike.${searchPattern}`,
          `description.ilike.${searchPattern}`,
          `sku.ilike.${searchPattern}`,
        ]
        const storeIds = (storeMatches.data || []).map((store) => store.id)
        const categoryIds = (categoryMatches.data || []).map((category) => category.id)
        if (storeIds.length) conditions.push(`merchant_id.in.(${storeIds.join(',')})`)
        if (categoryIds.length) conditions.push(`category_id.in.(${categoryIds.join(',')})`)
        query = query.or(conditions.join(','))
      }
    }
    if (minPrice !== '' && Number(minPrice) >= 0) query = query.gte('price', Number(minPrice))
    if (maxPrice !== '' && Number(maxPrice) >= 0) query = query.lte('price', Number(maxPrice))
    query = sort === 'price_low' ? query.order('price', { ascending: true }) : sort === 'price_high' ? query.order('price', { ascending: false }) : sort === 'name' ? query.order('name', { ascending: true }) : query.order('created_at', { ascending: false })
    const { data, error } = await query.limit(200)
    if (error) toast.error(error.message)
    const productIds = (data || []).map((product) => product.id)
    // Rating/sold-count social proof for the Shopee/Lazada-style card —
    // one bulk query each (join-not-loop), not one per product.
    // product_reviews is already publicly readable; sold counts need the
    // dedicated aggregate-only RPC since order_items itself is
    // participant-scoped RLS.
    const [campaignDiscounts, campaignProducts, reviewsResult, soldResult] = await Promise.all([
      getActiveCampaignDiscounts(),
      getActiveCampaignProducts(),
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
    setProducts((data || []).filter(product => isStoreOpen(product.merchant_profiles)).map((product) => ({
      ...applyCampaignDiscount(product, campaignDiscounts, campaignProducts),
      avg_rating: ratingsByProduct[product.id] ? ratingsByProduct[product.id].sum / ratingsByProduct[product.id].count : 0,
      review_count: ratingsByProduct[product.id]?.count || 0,
      sold_count: soldByProduct[product.id] || 0,
    })))
    setLoading(false)
  }, [activeCategory, activeMerchant, debouncedSearch, minPrice, maxPrice, sort, categories])

  useEffect(() => { loadProducts() }, [loadProducts])

  const activeFilterCount = [activeCategory, activeMerchant, minPrice, maxPrice, minRating || null].filter(Boolean).length
  const activeCategoryName = useMemo(() => categories.find((category) => category.id === activeCategory)?.name, [categories, activeCategory])
  const activeMerchantName = useMemo(() => merchants.find((merchant) => merchant.id === activeMerchant)?.business_name, [merchants, activeMerchant])
  const clearFilters = () => { setActiveCategory(null); setActiveMerchant(null); setMinPrice(''); setMaxPrice(''); setMinRating(0); setCategorySearch(''); setStoreSearch('') }
  const filterProps = { categories, merchants, activeCategory, setActiveCategory, activeMerchant, setActiveMerchant, categorySearch, setCategorySearch, storeSearch, setStoreSearch, minPrice, setMinPrice, maxPrice, setMaxPrice, minRating, setMinRating, clearFilters }
  const visibleProducts = useMemo(() => minRating > 0 ? products.filter((p) => p.avg_rating >= minRating) : products, [products, minRating])
  const showPromo = !activeCategory && !activeMerchant && !debouncedSearch
  const discountedProducts = useMemo(() => products.filter((p) => p.campaign_discount_percent > 0), [products])
  const topDiscount = useMemo(() => discountedProducts.reduce((max, p) => Math.max(max, p.campaign_discount_percent), 0), [discountedProducts])
  // Only per-product campaigns carry an end date (applyCampaignDiscount
  // only sets campaign_ends_at for those, not whole-store join
  // discounts) — soonest one wins for the countdown, if any exist.
  const soonestEndsAt = useMemo(() => discountedProducts.map((p) => p.campaign_ends_at).filter(Boolean).sort()[0], [discountedProducts])

  return <div className="min-h-screen bg-bg">
    <section className="relative overflow-hidden border-b border-teal-900/10 bg-gradient-to-br from-teal-950 via-teal-900 to-teal-700 text-white"><div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full border-[55px] border-white/[0.04]" /><div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12"><div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-100"><Store size={13} /> JOM HUB Marketplace</div><h1 className="mt-4 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">Everything your business needs.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-white/70 sm:text-base">Discover products from verified stores. Browse everything or use the filters to find the right match.</p><label className="relative mt-7 block max-w-3xl"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-teal-900/45" size={20} /><input className="w-full rounded-2xl border border-white/20 bg-surface py-4 pl-12 pr-12 text-sm text-ink shadow-xl shadow-black/10 outline-none transition placeholder:text-ink/35 focus:ring-4 focus:ring-white/20 sm:text-base" placeholder="Search products, stores, categories or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />{search && <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink/35 hover:bg-black/5"><X size={17} /></button>}</label></div></section>
    {categories.length > 0 && (
      <section className="border-b border-black/[0.06] bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex gap-4 overflow-x-auto pb-1 sm:flex-wrap sm:justify-center sm:gap-6">
            <button type="button" onClick={() => setActiveCategory(null)} className="flex shrink-0 flex-col items-center gap-1.5 text-center">
              <span className={`grid h-12 w-12 place-items-center rounded-full transition sm:h-14 sm:w-14 ${!activeCategory ? 'bg-teal-600 text-white shadow-sm' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'}`}><LayoutGrid size={20} /></span>
              <span className={`text-[10px] font-semibold sm:text-xs ${!activeCategory ? 'text-teal-700' : 'text-ink/55'}`}>All</span>
            </button>
            {categories.filter((category) => !category.parent_id).map((category) => {
              const Icon = getCategoryIcon(category.name)
              const active = activeCategory === category.id
              return <button key={category.id} type="button" onClick={() => setActiveCategory(category.id)} className="flex shrink-0 flex-col items-center gap-1.5 text-center">
                <span className={`grid h-12 w-12 place-items-center rounded-full transition sm:h-14 sm:w-14 ${active ? 'bg-teal-600 text-white shadow-sm' : 'bg-teal-50 text-teal-700 hover:bg-teal-100'}`}><Icon size={20} /></span>
                <span className={`max-w-[4.5rem] truncate text-[10px] font-semibold sm:max-w-[5.5rem] sm:text-xs ${active ? 'text-teal-700' : 'text-ink/55'}`}>{category.name}</span>
              </button>
            })}
          </div>
        </div>
      </section>
    )}
    {showPromo && (
      <section className="border-b border-black/[0.06] bg-surface">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_auto]">
          {topDiscount > 0 && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-coral-700 via-coral-600 to-mango-600 p-6 text-white shadow-card sm:p-8">
              <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full border-[40px] border-white/10" />
              <div className="relative">
                <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"><Zap size={13} />Mega Sale</p>
                <p className="mt-3 font-display text-2xl font-extrabold leading-tight sm:text-3xl">Up to {Math.round(topDiscount)}% OFF on selected items!</p>
                {soonestEndsAt && <CampaignCountdown endsAt={soonestEndsAt} className="mt-3 text-sm text-white/85" />}
              </div>
            </div>
          )}
          <div className={`grid gap-3 ${topDiscount > 0 ? 'grid-cols-1 sm:grid-cols-3 lg:w-72 lg:grid-cols-1' : 'sm:grid-cols-3'}`}>
            {TRUST_BADGES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-surface-inset px-3.5 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700"><Icon size={18} /></span>
                <div className="min-w-0"><p className="truncate text-xs font-bold text-ink">{title}</p><p className="truncate text-[11px] text-ink/50">{text}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    )}
    {showPromo && discountedProducts.length > 0 && (
      <section className="border-b border-black/[0.06] bg-gradient-to-br from-mango-50 to-white dark:from-mango-500/5 dark:to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-mango-500 text-white shadow-sm"><Zap size={18} /></span><div><h2 className="font-display text-lg font-bold text-ink">Flash Sale</h2><p className="text-xs text-ink/50">Limited-time marketplace discounts, updated automatically.</p></div></div>
            {soonestEndsAt && <CampaignCountdown endsAt={soonestEndsAt} className="hidden text-sm text-mango-700 sm:inline-flex" />}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible lg:grid-cols-5">
            {discountedProducts.slice(0, 10).map((product) => <div key={product.id} className="w-36 shrink-0 sm:w-auto"><ProductCard product={product} /></div>)}
          </div>
        </div>
      </section>
    )}
    <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 md:hidden"><button type="button" onClick={() => setFiltersOpen(true)} className="btn-secondary flex w-full items-center justify-center gap-2 shadow-sm"><Filter size={17} /> Filter products {activeFilterCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-teal-600 px-1 text-[10px] text-white">{activeFilterCount}</span>}</button></div>

    <div className="mx-auto grid max-w-7xl gap-5 px-2 py-6 sm:px-6 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-7 lg:py-8"><aside className="hidden overflow-hidden rounded-2xl border border-black/[0.06] bg-surface shadow-card md:sticky md:top-24 md:block md:h-[calc(100vh-7rem)]"><FilterPanel {...filterProps} /></aside><main className="min-w-0"><div className="mb-5 flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between sm:px-0"><div><h2 className="font-display text-xl font-bold text-ink">{activeMerchantName ? `${activeMerchantName} Products` : activeCategoryName ? `${activeCategoryName} Products` : 'All Products'}</h2><p className="mt-1 text-sm text-ink/50">{loading ? 'Loading products...' : `${visibleProducts.length} product${visibleProducts.length === 1 ? '' : 's'} found`}</p><div className="mt-2 flex flex-wrap gap-1.5">{activeCategoryName && <span className="badge bg-teal-50 text-teal-700">Category: {activeCategoryName}</span>}{activeMerchantName && <span className="badge bg-teal-50 text-teal-700">Store: {activeMerchantName}</span>}{(minPrice || maxPrice) && <span className="badge bg-teal-50 text-teal-700">Price: ₱{minPrice || '0'} – ₱{maxPrice || 'Any'}</span>}{minRating > 0 && <span className="badge bg-teal-50 text-teal-700">Rating: {minRating}★ & up</span>}</div></div><label className="relative"><select value={sort} onChange={(e) => setSort(e.target.value)} className="input-field appearance-none py-2 pl-3 pr-9 text-sm"><option value="newest">Newest first</option><option value="price_low">Price: low to high</option><option value="price_high">Price: high to low</option><option value="name">Product name</option></select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/40" /></label></div>
      {loading ? <div className="flex justify-center py-24"><Spinner /></div> : visibleProducts.length === 0 ? <div className="rounded-2xl border border-black/[0.06] bg-surface"><EmptyState icon={PackageSearch} title="No products found" message="Try another product name, store, category, or price range." action={<button onClick={clearFilters} className="btn-primary">Clear filters</button>} /></div> : <div className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-4 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">{visibleProducts.map((product) => <ProductCard key={product.id} product={product} />)}</div>}</main></div>

    {filtersOpen && <div className="fixed inset-0 z-50 md:hidden"><button onClick={() => setFiltersOpen(false)} className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" aria-label="Close filters" /><aside className="absolute bottom-0 left-0 top-0 w-[min(88vw,340px)] shadow-2xl"><FilterPanel {...filterProps} onClose={() => setFiltersOpen(false)} /></aside></div>}
  </div>
}
