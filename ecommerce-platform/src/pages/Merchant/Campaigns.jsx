import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, CalendarDays, ChevronDown, Download, Megaphone, Package, Send, Tag, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso } from '../../utils/format'
import { exportExcel } from '../../utils/excel'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'

// Phase 5/6: minimal dependency-free CSV parser (handles quoted fields
// with embedded commas/newlines) -- no existing CSV/XLSX library in this
// project, and the export side already reuses utils/excel.js's
// exportExcel rather than adding one.
function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false }
      else field += c
    } else if (c === '"') inQuotes = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = '' }
    else field += c
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''))
}

// Status -> Badge tone, matching the merchant_status-style enum pattern
// already used across the app (Approval Center, Merchants, etc).
const STATUS_TONES = { draft: 'neutral', pending: 'warning', approved: 'info', active: 'success', paused: 'warning', rejected: 'danger', expired: 'neutral', archived: 'neutral' }

export default function MerchantCampaigns() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState([])
  const [joined, setJoined] = useState(new Set())
  const [products, setProducts] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [openPanel, setOpenPanel] = useState(null)
  const [pickerProduct, setPickerProduct] = useState('')
  const [pickerPrice, setPickerPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editPrice, setEditPrice] = useState('')
  const [importing, setImporting] = useState(null)
  const [importReport, setImportReport] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const now = new Date().toISOString()
    const [campaignResult, joinedResult, productResult, submissionResult] = await Promise.all([
      supabase.from('campaigns').select('*').eq('is_active', true).gte('ends_at', now).order('starts_at'),
      supabase.from('merchant_campaigns').select('campaign_id').eq('merchant_id', user.id),
      supabase.from('products').select('id, name, sku, price, stock_quantity, is_active').eq('merchant_id', user.id).eq('is_active', true).order('name'),
      supabase.from('campaign_products').select('*').eq('merchant_id', user.id)
    ])
    if (campaignResult.error || joinedResult.error) toast.error(campaignResult.error?.message || joinedResult.error?.message)
    setCampaigns(campaignResult.data || [])
    setJoined(new Set((joinedResult.data || []).map((row) => row.campaign_id)))
    setProducts(productResult.data || [])
    setSubmissions(submissionResult.data || [])
    setLoading(false)
  }, [user])
  useEffect(() => { if (user) load() }, [user, load])

  const join = async (campaignId) => {
    const { error } = await supabase.from('merchant_campaigns').insert({ campaign_id: campaignId, merchant_id: user.id })
    if (error) return toast.error(error.message)
    toast.success('Your store joined the campaign!')
    load()
  }

  // Phase 4: live pricing-rule preview so a merchant sees the same floor/
  // ceiling the server will enforce (submit_campaign_product) before they
  // click Submit, instead of finding out only from a rejected validation.
  const pricingInfo = (campaignId) => {
    const product = products.find((p) => p.id === pickerProduct)
    if (!product) return null
    const campaign = campaigns.find((c) => c.id === campaignId)
    const original = Number(product.price)
    const maxDiscount = campaign?.max_discount_percent != null ? Number(campaign.max_discount_percent) : null
    const minDiscount = campaign?.min_discount_percent != null ? Number(campaign.min_discount_percent) : null
    const minAllowedPrice = maxDiscount != null ? Number((original * (1 - maxDiscount / 100)).toFixed(2)) : null
    const maxAllowedPrice = minDiscount != null ? Number((original * (1 - minDiscount / 100)).toFixed(2)) : null
    const suggested = Number((original * (1 - (maxDiscount ?? minDiscount ?? 10) / 100)).toFixed(2))
    const price = Number(pickerPrice)
    let status = 'Enter a campaign price', statusTone = 'neutral'
    if (pickerPrice) {
      if (!price || price <= 0 || price >= original) { status = 'Must be lower than the original price'; statusTone = 'danger' }
      else if (minAllowedPrice != null && price < minAllowedPrice) { status = `Below the minimum allowed price (${peso(minAllowedPrice)})`; statusTone = 'danger' }
      else if (maxAllowedPrice != null && price > maxAllowedPrice) { status = `Above the maximum allowed price (${peso(maxAllowedPrice)})`; statusTone = 'danger' }
      else { status = 'Valid'; statusTone = 'success' }
    }
    return { original, suggested, minAllowedPrice, status, statusTone }
  }

  const submissionsFor = (campaignId) => submissions.filter((s) => s.campaign_id === campaignId && s.status !== 'archived')
  const availableProducts = (campaignId) => {
    const submittedIds = new Set(submissionsFor(campaignId).map((s) => s.product_id))
    return products.filter((p) => !submittedIds.has(p.id))
  }

  const submitProduct = async (campaignId) => {
    if (!pickerProduct) return toast.error('Choose a product first.')
    const price = Number(pickerPrice)
    if (!price || price <= 0) return toast.error('Enter a valid campaign price.')
    setSubmitting(true)
    const { data, error } = await supabase.rpc('submit_campaign_product', { p_campaign_id: campaignId, p_product_id: pickerProduct, p_campaign_price: price })
    setSubmitting(false)
    if (error) return toast.error(error.message)
    toast[data.validation_errors?.length ? 'error' : 'success'](data.validation_errors?.length ? 'Saved as Draft — see the validation notes below.' : 'Product submitted to campaign.')
    setPickerProduct(''); setPickerPrice('')
    load()
  }

  const saveEdit = async (submission) => {
    const price = Number(editPrice)
    if (!price || price <= 0) return toast.error('Enter a valid campaign price.')
    const { data, error } = await supabase.rpc('submit_campaign_product', { p_campaign_id: submission.campaign_id, p_product_id: submission.product_id, p_campaign_price: price })
    if (error) return toast.error(error.message)
    toast[data.validation_errors?.length ? 'error' : 'success'](data.validation_errors?.length ? 'Saved as Draft — see the validation notes below.' : 'Submission updated.')
    setEditingId(null)
    load()
  }

  const withdraw = async (id) => {
    const { error } = await supabase.rpc('withdraw_campaign_submission', { p_id: id })
    if (error) return toast.error(error.message)
    toast.success('Submission withdrawn.')
    load()
  }

  // Phase 5: bulk import from a CSV with columns sku (or product_id),
  // campaign_price (or discount, as a % to compute price from), and an
  // optional stock_allocation. Every row goes through the exact same
  // submit_campaign_product validation as a single manual submission --
  // no separate/looser bulk-import code path.
  const importCsv = async (campaignId, file) => {
    setImporting(campaignId)
    setImportReport(null)
    try {
      const text = await file.text()
      const rows = parseCsv(text)
      if (rows.length < 2) { toast.error('CSV has no data rows.'); return }
      const header = rows[0].map((h) => h.trim().toLowerCase())
      const idx = (name) => header.indexOf(name)
      const skuIdx = idx('sku'), productIdIdx = idx('product_id'), priceIdx = idx('campaign_price'), discountIdx = idx('discount'), stockIdx = idx('stock_allocation')
      if (skuIdx === -1 && productIdIdx === -1) { toast.error('CSV needs a "sku" or "product_id" column.'); return }
      const report = []
      for (const r of rows.slice(1)) {
        const sku = skuIdx >= 0 ? (r[skuIdx] || '').trim() : ''
        const productId = productIdIdx >= 0 ? (r[productIdIdx] || '').trim() : ''
        const rowLabel = sku || productId || '(row)'
        const product = productId ? products.find((p) => p.id === productId) : products.find((p) => (p.sku || '').toLowerCase() === sku.toLowerCase())
        if (!product) { report.push({ label: rowLabel, ok: false, message: 'Product not found (check SKU / Product ID, and that it belongs to your store).' }); continue }
        let price = priceIdx >= 0 && r[priceIdx] ? Number(r[priceIdx]) : null
        if (!price && discountIdx >= 0 && r[discountIdx]) price = Number((Number(product.price) * (1 - Number(r[discountIdx]) / 100)).toFixed(2))
        if (!price || price <= 0) { report.push({ label: product.name, ok: false, message: 'Missing/invalid campaign_price or discount column.' }); continue }
        const stockAllocation = stockIdx >= 0 && r[stockIdx] ? Number(r[stockIdx]) : null
        const { data, error } = await supabase.rpc('submit_campaign_product', { p_campaign_id: campaignId, p_product_id: product.id, p_campaign_price: price, p_stock_allocation: stockAllocation })
        if (error) report.push({ label: product.name, ok: false, message: error.message })
        else if (data.validation_errors?.length) report.push({ label: product.name, ok: false, message: data.validation_errors.join(' ') })
        else report.push({ label: product.name, ok: true, message: `Submitted at ${peso(price)}${data.status === 'approved' ? ' (auto-approved)' : ' (pending review)'}` })
      }
      setImportReport({ campaignId, rows: report })
      const okCount = report.filter((r) => r.ok).length
      toast[okCount === report.length ? 'success' : 'error'](`Imported ${okCount}/${report.length} rows successfully.`)
      load()
    } finally {
      setImporting(null)
    }
  }

  const exportCampaignCsv = (campaign) => {
    const rows = submissionsFor(campaign.id).map((s) => {
      const product = products.find((p) => p.id === s.product_id)
      return [product?.sku || '', product?.name || '', product?.price != null ? peso(product.price) : '', peso(s.campaign_price), s.stock_allocation ?? '', s.status, (s.validation_errors || []).join(' | '), s.rejection_reason || '']
    })
    exportExcel(`campaign-${campaign.name.replace(/[^a-z0-9]+/gi, '-')}-products.xls`, 'Campaign Products',
      ['SKU', 'Product', 'Original price', 'Campaign price', 'Stock allocation', 'Status', 'Validation errors', 'Rejection reason'], rows, { title: campaign.name })
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Grow your sales</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">Marketplace Campaigns</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink/50">Join a campaign to apply its discount to your whole store, or submit individual products with your own campaign price for review.</p>
      </div>
      {campaigns.length === 0 ? (
        <div className="card"><EmptyState icon={Megaphone} title="No available campaigns" message="New marketplace campaigns will appear here." /></div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {campaigns.map((campaign) => {
            const hasJoined = joined.has(campaign.id)
            const upcoming = Date.now() < new Date(campaign.starts_at).getTime()
            const mySubmissions = submissionsFor(campaign.id)
            const panelOpen = openPanel === campaign.id
            return (
              <article key={campaign.id} className={`overflow-hidden rounded-2xl border bg-surface shadow-soft ${hasJoined ? 'border-teal-300 ring-2 ring-teal-500/10' : 'border-black/[0.06]'}`}>
                <div className="bg-gradient-to-br from-teal-900 to-teal-600 p-5 text-white">
                  <div className="flex items-center justify-between">
                    <Tag size={22} className="text-mango-300" />
                    {hasJoined && <span className="badge gap-1 bg-white/15 text-white"><BadgeCheck size={13} /> Joined</span>}
                  </div>
                  <p className="mt-5 font-display text-4xl font-bold text-mango-300">{Number(campaign.discount_percent)}% OFF</p>
                  <h2 className="mt-2 font-display text-lg font-bold">{campaign.name}</h2>
                </div>
                <div className="p-5">
                  <p className="min-h-[3rem] text-sm leading-6 text-ink/55">{campaign.description || 'Apply this campaign discount to all your products.'}</p>
                  <div className="mt-4 rounded-xl bg-surface-inset p-3 text-xs leading-5 text-ink/55">
                    <p className="flex items-center gap-2 font-semibold text-ink/70"><CalendarDays size={14} />{upcoming ? 'Starts' : 'Ends'} {new Date(upcoming ? campaign.starts_at : campaign.ends_at).toLocaleString()}</p>
                    {(campaign.min_discount_percent || campaign.max_discount_percent) && (
                      <p className="mt-1">Product submission discount range: {campaign.min_discount_percent ?? 0}%–{campaign.max_discount_percent ?? 100}%{campaign.requires_approval ? ' · needs admin approval' : ' · auto-approved'}</p>
                    )}
                  </div>
                  <button onClick={() => join(campaign.id)} disabled={hasJoined} className="btn-primary mt-4 w-full disabled:bg-teal-100 disabled:text-teal-700">{hasJoined ? 'Already joined (whole store)' : 'Join campaign (whole store)'}</button>

                  <button type="button" onClick={() => setOpenPanel(panelOpen ? null : campaign.id)} className="mt-3 flex w-full items-center justify-between rounded-xl border border-black/[0.06] px-3 py-2 text-sm font-semibold text-ink/70 hover:bg-surface-inset">
                    <span className="flex items-center gap-2"><Package size={15} /> Submit individual products {mySubmissions.length > 0 && <Badge tone="neutral">{mySubmissions.length}</Badge>}</span>
                    <ChevronDown size={16} className={`transition-transform ${panelOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {panelOpen && (
                    <div className="mt-3 space-y-3 rounded-xl border border-black/[0.06] p-3">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <select className="input-field flex-1 text-sm" value={pickerProduct} onChange={(e) => setPickerProduct(e.target.value)}>
                          <option value="">Choose a product...</option>
                          {availableProducts(campaign.id).map((p) => <option key={p.id} value={p.id}>{p.name} — {peso(p.price)}</option>)}
                        </select>
                        <input type="number" min="0.01" step="0.01" placeholder="Campaign price" className="input-field w-full text-sm sm:w-36" value={pickerPrice} onChange={(e) => setPickerPrice(e.target.value)} />
                        <Button size="sm" icon={Send} disabled={submitting} onClick={() => submitProduct(campaign.id)}>Submit</Button>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 border-t border-black/[0.06] pt-3 text-xs">
                        <label className="cursor-pointer font-semibold text-teal-700 hover:underline">
                          <input type="file" accept=".csv" className="hidden" disabled={importing === campaign.id} onChange={(e) => { const input = e.target; const file = input.files?.[0]; if (file) importCsv(campaign.id, file).finally(() => { input.value = '' }) }} />
                          <span className="inline-flex items-center gap-1"><Upload size={13} />{importing === campaign.id ? 'Importing…' : 'Import CSV'}</span>
                        </label>
                        <button type="button" onClick={() => exportCampaignCsv(campaign)} disabled={mySubmissions.length === 0} className="inline-flex items-center gap-1 font-semibold text-teal-700 hover:underline disabled:cursor-not-allowed disabled:text-ink/30 disabled:no-underline"><Download size={13} /> Export</button>
                        <span className="text-ink/40">CSV columns: sku or product_id, campaign_price (or discount %), stock_allocation (optional)</span>
                      </div>

                      {importReport?.campaignId === campaign.id && (
                        <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-surface-inset p-2.5 text-xs">
                          {importReport.rows.map((r, i) => <p key={i} className={r.ok ? 'text-teal-700' : 'text-coral-600'}>{r.ok ? '✓' : '✗'} <span className="font-semibold">{r.label}</span> — {r.message}</p>)}
                        </div>
                      )}

                      {pickerProduct && (() => {
                        const info = pricingInfo(campaign.id)
                        if (!info) return null
                        return (
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 rounded-lg bg-surface-inset p-2.5 text-xs sm:grid-cols-4">
                            <div><p className="text-ink/45">Original price</p><p className="font-semibold text-ink">{peso(info.original)}</p></div>
                            <div><p className="text-ink/45">Suggested price</p><p className="font-semibold text-teal-700">{peso(info.suggested)}</p></div>
                            <div><p className="text-ink/45">Min. allowed price</p><p className="font-semibold text-ink">{info.minAllowedPrice != null ? peso(info.minAllowedPrice) : 'No floor'}</p></div>
                            <div><p className="text-ink/45">Validation</p><Badge tone={info.statusTone} className="mt-0.5">{info.status}</Badge></div>
                          </div>
                        )
                      })()}

                      {mySubmissions.length === 0 ? (
                        <p className="py-2 text-center text-xs text-ink/45">No products submitted to this campaign yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {mySubmissions.map((s) => {
                            const product = products.find((p) => p.id === s.product_id)
                            const isEditing = editingId === s.id
                            return (
                              <div key={s.id} className="rounded-lg bg-surface-inset p-2.5 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-semibold text-ink">{product?.name || 'Product'}</p>
                                  <Badge tone={STATUS_TONES[s.status]} className="capitalize">{s.status}</Badge>
                                </div>
                                {isEditing ? (
                                  <div className="mt-2 flex items-center gap-2">
                                    <input type="number" min="0.01" step="0.01" className="input-field flex-1 text-xs" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                                    <Button size="sm" onClick={() => saveEdit(s)}>Save</Button>
                                    <button type="button" onClick={() => setEditingId(null)} className="rounded-lg p-1.5 text-ink/40 hover:bg-black/5"><X size={14} /></button>
                                  </div>
                                ) : (
                                  <>
                                    <p className="mt-1 text-ink/55">Campaign price: <span className="font-semibold text-teal-700">{peso(s.campaign_price)}</span></p>
                                    {s.status === 'rejected' && s.rejection_reason && <p className="mt-1 text-coral-600">Reason: {s.rejection_reason}</p>}
                                    {Array.isArray(s.validation_errors) && s.validation_errors.length > 0 && (
                                      <ul className="mt-1 list-disc pl-4 text-coral-600">{s.validation_errors.map((err, i) => <li key={i}>{err}</li>)}</ul>
                                    )}
                                    {['draft', 'pending', 'approved'].includes(s.status) && (
                                      <div className="mt-2 flex gap-3">
                                        <button type="button" onClick={() => { setEditingId(s.id); setEditPrice(String(s.campaign_price)) }} className="font-semibold text-teal-700 hover:underline">Edit price</button>
                                        <button type="button" onClick={() => withdraw(s.id)} className="font-semibold text-coral-600 hover:underline">Withdraw</button>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
