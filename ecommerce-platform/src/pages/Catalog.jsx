import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Filter, PackageSearch, Search, SlidersHorizontal, Store, Tag, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import ProductCard from '../components/product/ProductCard'
import EmptyState from '../components/ui/EmptyState'
import Spinner from '../components/ui/Spinner'
import { applyCampaignDiscount, getActiveCampaignDiscounts, getActiveCampaignProducts } from '../utils/campaigns'
import { isStoreOpen } from '../utils/storeHours'

function FilterPanel({ categories, merchants, activeCategory, setActiveCategory, activeMerchant, setActiveMerchant, categorySearch, setCategorySearch, storeSearch, setStoreSearch, minPrice, setMinPrice, maxPrice, setMaxPrice, clearFilters, onClose }) {
  const visibleCategories = categories.filter((category) => category.name.toLowerCase().includes(categorySearch.toLowerCase()))
  const visibleMerchants = merchants.filter((merchant) => merchant.business_name.toLowerCase().includes(storeSearch.toLowerCase()))
  return <div className="flex h-full flex-col bg-surface">
    <div className="flex items-center justify-between border-b border-black/5 px-5 py-4"><div className="flex items-center gap-2"><SlidersHorizontal size={18} className="text-teal-600" /><h2 className="font-display font-bold text-ink">Filters</h2></div>{onClose && <button onClick={onClose} className="rounded-lg p-1.5 text-ink/45 hover:bg-black/5"><X size={19} /></button>}</div>
    <div className="flex-1 divide-y divide-black/5 overflow-y-auto">
      <section className="p-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Categories</h3>{activeCategory && <button onClick={() => setActiveCategory(null)} className="text-[11px] font-semibold text-teal-700">Clear</button>}</div><label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" /><input value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)} className="input-field py-2 pl-9 text-xs" placeholder="Search category" /></label><div className="mt-3 space-y-1"><button onClick={() => setActiveCategory(null)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${!activeCategory ? 'bg-teal-50 font-semibold text-teal-800' : 'text-ink/60 hover:bg-black/[0.03]'}`}><span>All categories</span>{!activeCategory && <span className="h-2 w-2 rounded-full bg-teal-500" />}</button>{visibleCategories.map((category) => <button key={category.id} onClick={() => setActiveCategory(category.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${activeCategory === category.id ? 'bg-teal-50 font-semibold text-teal-800' : 'text-ink/60 hover:bg-black/[0.03]'}`}><span className="truncate">{category.name}</span>{activeCategory === category.id && <span className="h-2 w-2 rounded-full bg-teal-500" />}</button>)}{visibleCategories.length === 0 && <p className="px-3 py-3 text-xs text-ink/40">No matching category</p>}</div></section>

      <section className="p-5"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Stores</h3>{activeMerchant && <button onClick={() => setActiveMerchant(null)} className="text-[11px] font-semibold text-teal-700">Clear</button>}</div><label className="relative block"><Store size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30" /><input value={storeSearch} onChange={(e) => setStoreSearch(e.target.value)} className="input-field py-2 pl-9 text-xs" placeholder="Search store name" /></label><div className="mt-3 space-y-1"><button onClick={() => setActiveMerchant(null)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${!activeMerchant ? 'bg-teal-50 font-semibold text-teal-800' : 'text-ink/60 hover:bg-black/[0.03]'}`}><span>All stores</span>{!activeMerchant && <span className="h-2 w-2 rounded-full bg-teal-500" />}</button>{visibleMerchants.map((merchant) => <button key={merchant.id} onClick={() => setActiveMerchant(merchant.id)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${activeMerchant === merchant.id ? 'bg-teal-50 font-semibold text-teal-800' : 'text-ink/60 hover:bg-black/[0.03]'}`}><span className="truncate">{merchant.business_name}</span>{activeMerchant === merchant.id && <span className="h-2 w-2 rounded-full bg-teal-500" />}</button>)}{visibleMerchants.length === 0 && <p className="px-3 py-3 text-xs text-ink/40">No matching store</p>}</div></section>

      <section className="p-5"><h3 className="text-xs font-bold uppercase tracking-[0.14em] text-ink/45">Price range</h3><div className="mt-3 grid grid-cols-2 gap-2"><label className="text-[11px] font-medium text-ink/45">Minimum<div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink/35">₱</span><input type="number" min="0" step="1" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="input-field py-2 pl-7 pr-2 text-xs" placeholder="0" /></div></label><label className="text-[11px] font-medium text-ink/45">Maximum<div className="relative mt-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-ink/35">₱</span><input type="number" min="0" step="1" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="input-field py-2 pl-7 pr-2 text-xs" placeholder="Any" /></div></label></div></section>
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
  const [sort, setSort] = useState('newest')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { Promise.all([supabase.from('categories').select('*').order('name'), supabase.from('merchant_profiles').select('id,business_name').eq('status', 'approved').order('business_name')]).then(([categoryResult, merchantResult]) => { if (categoryResult.error || merchantResult.error) toast.error(categoryResult.error?.message || merchantResult.error?.message); setCategories(categoryResult.data || []); setMerchants(merchantResult.data || []) }) }, [])
  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300); return () => clearTimeout(timer) }, [search])
  const loadProducts = useCallback(async () => {
    setLoading(true)
    let query = supabase.from('products').select('*, merchant_profiles(business_name,store_open_time,store_close_time,auto_pause_outside_hours,store_timezone)').eq('is_active', true)
    if (activeCategory) query = query.eq('category_id', activeCategory)
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
    const [campaignDiscounts, campaignProducts] = await Promise.all([getActiveCampaignDiscounts(), getActiveCampaignProducts()])
    setProducts((data || []).filter(product => isStoreOpen(product.merchant_profiles)).map((product) => applyCampaignDiscount(product, campaignDiscounts, campaignProducts)))
    setLoading(false)
  }, [activeCategory, activeMerchant, debouncedSearch, minPrice, maxPrice, sort])

  useEffect(() => { loadProducts() }, [loadProducts])

  const activeFilterCount = [activeCategory, activeMerchant, minPrice, maxPrice].filter(Boolean).length
  const activeCategoryName = useMemo(() => categories.find((category) => category.id === activeCategory)?.name, [categories, activeCategory])
  const activeMerchantName = useMemo(() => merchants.find((merchant) => merchant.id === activeMerchant)?.business_name, [merchants, activeMerchant])
  const clearFilters = () => { setActiveCategory(null); setActiveMerchant(null); setMinPrice(''); setMaxPrice(''); setCategorySearch(''); setStoreSearch('') }
  const filterProps = { categories, merchants, activeCategory, setActiveCategory, activeMerchant, setActiveMerchant, categorySearch, setCategorySearch, storeSearch, setStoreSearch, minPrice, setMinPrice, maxPrice, setMaxPrice, clearFilters }

  return <div className="min-h-screen bg-bg">
    <section className="relative overflow-hidden border-b border-teal-900/10 bg-gradient-to-br from-teal-950 via-teal-900 to-teal-700 text-white"><div className="pointer-events-none absolute -right-24 -top-32 h-80 w-80 rounded-full border-[55px] border-white/[0.04]" /><div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12"><div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-100"><Store size={13} /> JOM HUB Marketplace</div><h1 className="mt-4 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">Everything your business needs.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-white/70 sm:text-base">Discover products from verified stores. Browse everything or use the filters to find the right match.</p><label className="relative mt-7 block max-w-3xl"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-teal-900/45" size={20} /><input className="w-full rounded-2xl border border-white/20 bg-surface py-4 pl-12 pr-12 text-sm text-ink shadow-xl shadow-black/10 outline-none transition placeholder:text-ink/35 focus:ring-4 focus:ring-white/20 sm:text-base" placeholder="Search products, stores, categories or SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />{search && <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-ink/35 hover:bg-black/5"><X size={17} /></button>}</label></div></section>
    {!activeCategory && !activeMerchant && !debouncedSearch && products.some((p) => p.campaign_discount_percent > 0) && (
      <section className="border-b border-black/[0.06] bg-gradient-to-br from-mango-50 to-white dark:from-mango-500/5 dark:to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="mb-4 flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-mango-500 text-white shadow-sm"><Tag size={18} /></span><div><h2 className="font-display text-lg font-bold text-ink">On campaign right now</h2><p className="text-xs text-ink/50">Limited-time marketplace discounts, updated automatically.</p></div></div>
          <div className="flex gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible lg:grid-cols-5">
            {products.filter((p) => p.campaign_discount_percent > 0).slice(0, 10).map((product) => <div key={product.id} className="w-36 shrink-0 sm:w-auto"><ProductCard product={product} /></div>)}
          </div>
        </div>
      </section>
    )}
    <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 md:hidden"><button type="button" onClick={() => setFiltersOpen(true)} className="btn-secondary flex w-full items-center justify-center gap-2 shadow-sm"><Filter size={17} /> Filter products {activeFilterCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-teal-600 px-1 text-[10px] text-white">{activeFilterCount}</span>}</button></div>

    <div className="mx-auto grid max-w-7xl gap-5 px-2 py-6 sm:px-6 md:grid-cols-[240px_minmax(0,1fr)] lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-7 lg:py-8"><aside className="hidden overflow-hidden rounded-2xl border border-black/[0.06] bg-surface shadow-card md:sticky md:top-24 md:block md:h-[calc(100vh-7rem)]"><FilterPanel {...filterProps} /></aside><main className="min-w-0"><div className="mb-5 flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between sm:px-0"><div><h2 className="font-display text-xl font-bold text-ink">{activeMerchantName ? `${activeMerchantName} Products` : activeCategoryName ? `${activeCategoryName} Products` : 'All Products'}</h2><p className="mt-1 text-sm text-ink/50">{loading ? 'Loading products...' : `${products.length} product${products.length === 1 ? '' : 's'} found`}</p><div className="mt-2 flex flex-wrap gap-1.5">{activeCategoryName && <span className="badge bg-teal-50 text-teal-700">Category: {activeCategoryName}</span>}{activeMerchantName && <span className="badge bg-teal-50 text-teal-700">Store: {activeMerchantName}</span>}{(minPrice || maxPrice) && <span className="badge bg-teal-50 text-teal-700">Price: ₱{minPrice || '0'} – ₱{maxPrice || 'Any'}</span>}</div></div><label className="relative"><select value={sort} onChange={(e) => setSort(e.target.value)} className="input-field appearance-none py-2 pl-3 pr-9 text-sm"><option value="newest">Newest first</option><option value="price_low">Price: low to high</option><option value="price_high">Price: high to low</option><option value="name">Product name</option></select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink/40" /></label></div>
      {loading ? <div className="flex justify-center py-24"><Spinner /></div> : products.length === 0 ? <div className="rounded-2xl border border-black/[0.06] bg-surface"><EmptyState icon={PackageSearch} title="No products found" message="Try another product name, store, category, or price range." action={<button onClick={clearFilters} className="btn-primary">Clear filters</button>} /></div> : <div className="grid grid-cols-2 gap-2 min-[360px]:grid-cols-4 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>}</main></div>

    {filtersOpen && <div className="fixed inset-0 z-50 md:hidden"><button onClick={() => setFiltersOpen(false)} className="absolute inset-0 bg-scrim/50 backdrop-blur-sm" aria-label="Close filters" /><aside className="absolute bottom-0 left-0 top-0 w-[min(88vw,340px)] shadow-2xl"><FilterPanel {...filterProps} onClose={() => setFiltersOpen(false)} /></aside></div>}
  </div>
}
