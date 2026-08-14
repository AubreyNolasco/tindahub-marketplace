import { useEffect, useState } from 'react'
import { Plus, Save, Send, Archive, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { peso } from '../../utils/format'
import { previewShippingFee } from '../../utils/shippingPreview'
import Spinner from '../../components/ui/Spinner'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const vehicleLabels = { motorcycle: 'Motorcycle', sedan: 'Sedan' }

const blankRule = (vehicleType, nextVersion) => ({
  vehicle_type: vehicleType,
  version: nextVersion,
  base_fee: '',
  included_distance_km: '5',
  rate_per_km: '',
  additional_distance_rate: '',
  minimum_fee: '',
  maximum_fee: '',
  surcharge_percent: '0',
  rounding_increment: '5',
  road_directness_multiplier: '1.3',
  status: 'draft',
  effective_date: new Date().toISOString().slice(0, 10)
})

export default function ShippingPricing() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [previewDistance, setPreviewDistance] = useState('7.8')
  const [saving, setSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // { type: 'publish'|'archive', row }
  const [confirming, setConfirming] = useState(false)
  const [revenue, setRevenue] = useState(null)
  const [revenueSaving, setRevenueSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const [rulesRes, revenueRes] = await Promise.all([
      supabase.from('shipping_pricing_rules').select('*').order('vehicle_type').order('version', { ascending: false }),
      supabase.from('revenue_settings').select('*').eq('id', true).maybeSingle()
    ])
    if (rulesRes.error) toast.error(rulesRes.error.message)
    if (revenueRes.error) toast.error(revenueRes.error.message)
    setRules(rulesRes.data || [])
    setRevenue(revenueRes.data || null)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = (vehicleType) => {
    const highest = rules.filter((r) => r.vehicle_type === vehicleType).reduce((max, r) => Math.max(max, r.version), 0)
    setForm(blankRule(vehicleType, highest + 1))
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      vehicle_type: form.vehicle_type,
      version: Number(form.version),
      base_fee: Number(form.base_fee),
      included_distance_km: Number(form.included_distance_km),
      rate_per_km: Number(form.rate_per_km),
      additional_distance_rate: Number(form.additional_distance_rate),
      minimum_fee: form.minimum_fee === '' ? null : Number(form.minimum_fee),
      maximum_fee: form.maximum_fee === '' ? null : Number(form.maximum_fee),
      surcharge_percent: Number(form.surcharge_percent || 0),
      rounding_increment: Number(form.rounding_increment || 5),
      road_directness_multiplier: Number(form.road_directness_multiplier || 1.3),
      effective_date: form.effective_date
    }
    const result = form.id
      ? await supabase.from('shipping_pricing_rules').update(payload).eq('id', form.id)
      : await supabase.from('shipping_pricing_rules').insert({ ...payload, status: 'draft' })
    setSaving(false)
    if (result.error) return toast.error(result.error.message)
    toast.success('Pricing rule saved as draft.')
    setForm(null)
    load()
  }

  const publish = (row) => setConfirmAction({ type: 'publish', row })
  const archive = (row) => setConfirmAction({ type: 'archive', row })

  const runConfirmedAction = async () => {
    if (!confirmAction) return
    const { type, row } = confirmAction
    setConfirming(true)
    const { error } = type === 'publish'
      ? await supabase.rpc('publish_shipping_pricing_rule', { target_id: row.id })
      : await supabase.from('shipping_pricing_rules').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', row.id)
    setConfirming(false)
    if (error) return toast.error(error.message)
    toast.success(type === 'publish' ? `${vehicleLabels[row.vehicle_type]} rate published — live at checkout now.` : 'Version archived.')
    setConfirmAction(null)
    load()
  }

  const saveRevenue = async (e) => {
    e.preventDefault()
    setRevenueSaving(true)
    const { error } = await supabase.from('revenue_settings').update({
      merchant_success_fee_percent: Number(revenue.merchant_success_fee_percent),
      reseller_service_fee_percent: Number(revenue.reseller_service_fee_percent),
      reseller_fee_minimum: Number(revenue.reseller_fee_minimum),
      reseller_fee_maximum: Number(revenue.reseller_fee_maximum),
      tax_reserve_percent: Number(revenue.tax_reserve_percent),
      updated_at: new Date().toISOString()
    }).eq('id', true)
    setRevenueSaving(false)
    if (error) return toast.error(error.message)
    toast.success('Order processing fee settings saved.')
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Shipping &amp; Order Fees</h1>
        <p className="mt-1 text-sm text-ink/55">Configure the automatic, distance-based delivery fee formula and the order processing fee — both apply live at checkout.</p>
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-bold">Delivery Fee Rules</h2>
          <p className="mt-1 text-sm text-ink/55">One published rate per vehicle. Distance is straight-line, scaled by the road-directness multiplier — see billing_distance_km in a live order for what actually got charged.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary inline-flex items-center justify-center gap-2" onClick={() => openNew('motorcycle')}><Plus size={16} /> Motorcycle rate</button>
          <button className="btn-secondary inline-flex items-center justify-center gap-2" onClick={() => openNew('sedan')}><Plus size={16} /> Sedan rate</button>
        </div>
      </div>

      <div className="mt-4">
        <DataTable
          columns={[
            { header: 'Vehicle', accessor: 'vehicle_type', render: (row) => <>{vehicleLabels[row.vehicle_type] || row.vehicle_type}<p className="text-xs font-normal text-ink/45">v{row.version}</p></> },
            { header: 'Base Fee', accessor: 'base_fee', render: (row) => peso(row.base_fee) },
            { header: 'Included Distance', accessor: 'included_distance_km', render: (row) => `${row.included_distance_km} km` },
            { header: 'Rate / km', accessor: 'rate_per_km', render: (row) => peso(row.rate_per_km) },
            { header: 'Additional / km', accessor: 'additional_distance_rate', render: (row) => peso(row.additional_distance_rate) },
            { header: 'Road Multiplier', accessor: 'road_directness_multiplier', render: (row) => `×${row.road_directness_multiplier}` },
            { header: 'Effective', accessor: 'effective_date' },
            { header: 'Status', accessor: 'status', render: (row) => <Badge tone={row.status === 'published' ? 'success' : row.status === 'archived' ? 'neutral' : 'warning'}>{row.status}</Badge> }
          ]}
          data={rules}
          searchable={false}
          pageSize={20}
          emptyTitle="No pricing rules yet"
          emptyMessage="Add a Motorcycle or Sedan rate to enable automatic shipping fees."
          actions={[
            { label: 'Edit', icon: <Save size={16} />, onClick: setForm, hidden: (row) => row.status === 'published' },
            { label: 'Publish', icon: <Send size={16} />, onClick: publish, className: 'text-teal-700 hover:bg-teal-50', hidden: (row) => row.status === 'published' },
            { label: 'Archive', icon: <Archive size={16} />, onClick: archive, hidden: (row) => row.status !== 'published' }
          ]}
        />
      </div>

      {revenue && (
        <form onSubmit={saveRevenue} className="card mt-10 p-5">
          <h2 className="font-display text-lg font-bold">Order Processing Fee</h2>
          <p className="mt-1 text-sm text-ink/55">Percentage of subtotal, separate from the delivery fee. The reseller fee is clamped to a minimum/maximum per order; the merchant fee is deducted from the merchant's payout, not charged to the buyer.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">Reseller System Fee (%)
              <input required type="number" min="0" max="10" step="0.1" className="input-field mt-1" value={revenue.reseller_service_fee_percent} onChange={(e) => setRevenue({ ...revenue, reseller_service_fee_percent: e.target.value })} />
            </label>
            <label className="text-sm font-semibold">Merchant Success Fee (%)
              <input required type="number" min="0" max="25" step="0.1" className="input-field mt-1" value={revenue.merchant_success_fee_percent} onChange={(e) => setRevenue({ ...revenue, merchant_success_fee_percent: e.target.value })} />
            </label>
            <label className="text-sm font-semibold">Reseller Fee Minimum (₱)
              <input required type="number" min="0" step="0.01" className="input-field mt-1" value={revenue.reseller_fee_minimum} onChange={(e) => setRevenue({ ...revenue, reseller_fee_minimum: e.target.value })} />
            </label>
            <label className="text-sm font-semibold">Reseller Fee Maximum (₱)
              <input required type="number" min="0" step="0.01" className="input-field mt-1" value={revenue.reseller_fee_maximum} onChange={(e) => setRevenue({ ...revenue, reseller_fee_maximum: e.target.value })} />
            </label>
            <label className="text-sm font-semibold">Tax Reserve (%)
              <input required type="number" min="0" max="100" step="0.1" className="input-field mt-1" value={revenue.tax_reserve_percent} onChange={(e) => setRevenue({ ...revenue, tax_reserve_percent: e.target.value })} />
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <button disabled={revenueSaving} className="btn-primary">{revenueSaving ? 'Saving…' : 'Save Processing Fee Settings'}</button>
          </div>
        </form>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} hideHeader bodyClassName="" size="lg" ariaLabel={form ? (form.id ? 'Edit Pricing Rule' : 'New Pricing Rule') : undefined}>
        {form && (
          <form onSubmit={save} className="p-5 sm:p-7">
            <div className="flex justify-between">
              <h2 className="font-display text-xl font-bold">{form.id ? 'Edit' : 'New'} {vehicleLabels[form.vehicle_type]} Rate — v{form.version}</h2>
              <button type="button" onClick={() => setForm(null)} aria-label="Close"><X /></button>
            </div>
            <p className="mt-1 text-xs text-ink/50">Saves as a draft. Nothing changes at checkout until you publish it — publishing archives the currently published {vehicleLabels[form.vehicle_type]} rate.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Base Fee (₱)
                <input required type="number" min="0" step="0.01" className="input-field mt-1" value={form.base_fee} onChange={(e) => setForm({ ...form, base_fee: e.target.value })} />
              </label>
              <label className="text-sm font-semibold">Included Distance (km)
                <input required type="number" min="0" step="0.1" className="input-field mt-1" value={form.included_distance_km} onChange={(e) => setForm({ ...form, included_distance_km: e.target.value })} />
              </label>
              <label className="text-sm font-semibold">Rate per km within included distance (₱)
                <input required type="number" min="0" step="0.01" className="input-field mt-1" value={form.rate_per_km} onChange={(e) => setForm({ ...form, rate_per_km: e.target.value })} />
              </label>
              <label className="text-sm font-semibold">Additional rate per km beyond that (₱)
                <input required type="number" min="0" step="0.01" className="input-field mt-1" value={form.additional_distance_rate} onChange={(e) => setForm({ ...form, additional_distance_rate: e.target.value })} />
              </label>
              <label className="text-sm font-semibold">Minimum Fee (₱, optional)
                <input type="number" min="0" step="0.01" className="input-field mt-1" value={form.minimum_fee} onChange={(e) => setForm({ ...form, minimum_fee: e.target.value })} />
              </label>
              <label className="text-sm font-semibold">Maximum Fee (₱, optional)
                <input type="number" min="0" step="0.01" className="input-field mt-1" value={form.maximum_fee} onChange={(e) => setForm({ ...form, maximum_fee: e.target.value })} />
              </label>
              <label className="text-sm font-semibold">Peak/High-Demand Surcharge (%)
                <input required type="number" min="0" max="100" step="0.1" className="input-field mt-1" value={form.surcharge_percent} onChange={(e) => setForm({ ...form, surcharge_percent: e.target.value })} />
              </label>
              <label className="text-sm font-semibold">Round fee up to nearest (₱)
                <input required type="number" min="0.01" step="0.01" className="input-field mt-1" value={form.rounding_increment} onChange={(e) => setForm({ ...form, rounding_increment: e.target.value })} />
              </label>
              <label className="text-sm font-semibold">Road Directness Multiplier
                <input required type="number" min="1" step="0.05" className="input-field mt-1" value={form.road_directness_multiplier} onChange={(e) => setForm({ ...form, road_directness_multiplier: e.target.value })} />
                <span className="mt-1 block text-xs font-normal text-ink/45">Applied to straight-line pin distance to approximate road travel — there's no routing service, so this is what stands in for it.</span>
              </label>
              <label className="text-sm font-semibold">Effective Date
                <input required type="date" className="input-field mt-1" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
              </label>
            </div>

            <div className="mt-5 rounded-xl border border-black/[0.06] bg-black/[0.015] p-4">
              <label className="text-sm font-semibold">Preview at distance (km)
                <input type="number" min="0" step="0.1" className="input-field mt-1 w-32" value={previewDistance} onChange={(e) => setPreviewDistance(e.target.value)} />
              </label>
              {(() => {
                const distance = Number(previewDistance)
                const rule = { base_fee: Number(form.base_fee), included_distance_km: Number(form.included_distance_km), rate_per_km: Number(form.rate_per_km), additional_distance_rate: Number(form.additional_distance_rate), minimum_fee: form.minimum_fee === '' ? null : Number(form.minimum_fee), maximum_fee: form.maximum_fee === '' ? null : Number(form.maximum_fee), surcharge_percent: Number(form.surcharge_percent || 0), rounding_increment: Number(form.rounding_increment || 5), road_directness_multiplier: Number(form.road_directness_multiplier || 1.3) }
                if (previewDistance === '' || Number.isNaN(distance) || distance < 0 || Object.values(rule).some((v) => v !== null && Number.isNaN(v))) return <p className="mt-2 text-xs text-ink/45">Fill in the rate fields above to see a preview.</p>
                const { fee, billingDistanceKm } = previewShippingFee(rule, distance)
                return <p className="mt-2 text-sm text-ink/70">A {distance} km straight-line trip bills as <strong>{billingDistanceKm} km</strong> after the road multiplier, charging <strong className="text-teal-700">{peso(fee)}</strong>.</p>
              })()}
              <p className="mt-1.5 text-[11px] text-ink/40">Preview only — vehicle selection depends on the actual cart's product weights at checkout, so a real order may use the other rate instead.</p>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save as Draft'}</button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={runConfirmedAction}
        loading={confirming}
        variant={confirmAction?.type === 'publish' ? 'primary' : 'danger'}
        title={confirmAction?.type === 'publish' ? 'Publish this rate?' : 'Archive this rate?'}
        message={confirmAction?.type === 'publish'
          ? `Publish ${vehicleLabels[confirmAction?.row?.vehicle_type]} v${confirmAction?.row?.version}? It becomes the live rate for every new order immediately. Orders already placed keep the rate that applied when they were charged.`
          : `Archive ${vehicleLabels[confirmAction?.row?.vehicle_type]} v${confirmAction?.row?.version}? New orders for this vehicle will fall back to manual quotation until another version is published.`}
        confirmText={confirmAction?.type === 'publish' ? 'Publish' : 'Archive'}
      />
    </div>
  )
}
