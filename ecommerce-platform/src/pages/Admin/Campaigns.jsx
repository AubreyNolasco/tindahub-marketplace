import { useEffect, useState } from 'react'
import { Archive, ArchiveRestore, CalendarDays, Check, ClipboardList, Copy, Download, Pencil, Plus, Power, Tag, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso } from '../../utils/format'
import { exportExcel } from '../../utils/excel'
import Spinner from '../../components/ui/Spinner'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'

const initialForm = { name: '', description: '', discount_percent: '', starts_at: '', ends_at: '', requires_approval: true, min_discount_percent: '', max_discount_percent: '' }
export default function Campaigns() {
  const { user } = useAuth()
  const [campaigns, setCampaigns] = useState([])
  const [pending, setPending] = useState([])
  const [pendingLoading, setPendingLoading] = useState(true)
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const load = async () => { setLoading(true); await supabase.rpc('ensure_recurring_campaigns'); const { data, error } = await supabase.from('campaigns').select('*, merchant_campaigns(count)').order('starts_at', { ascending: false }); if (error) toast.error(error.message); setCampaigns(data || []); setLoading(false) }
  const loadPending = async () => {
    setPendingLoading(true)
    const { data, error } = await supabase.from('campaign_products').select('*, campaigns(name), products(name), merchant_profiles(business_name)').eq('status', 'pending').order('submitted_at')
    if (error) toast.error(error.message)
    setPending(data || [])
    setPendingLoading(false)
  }
  const review = async (id, approve) => {
    const reason = approve ? null : window.prompt('Reason for rejection (optional):')
    const { error } = await supabase.rpc('review_campaign_submission', { p_id: id, p_approve: approve, p_reason: reason || null })
    if (error) return toast.error(error.message)
    toast.success(approve ? 'Submission approved.' : 'Submission rejected.')
    loadPending()
  }
  useEffect(() => { load(); loadPending() }, [])
  // Phase 6: full cross-merchant export (every status, not just pending)
  // for admin reporting -- reuses the same exportExcel util as the
  // merchant's per-campaign export and the existing Sales report.
  const exportAllSubmissions = async () => {
    const { data, error } = await supabase.from('campaign_products').select('*, campaigns(name), products(name, sku), merchant_profiles(business_name)').order('created_at', { ascending: false })
    if (error) return toast.error(error.message)
    if (!data.length) return toast.error('No product submissions to export yet.')
    const rows = data.map((s) => [s.products?.sku || '', s.products?.name || '', s.campaigns?.name || '', s.merchant_profiles?.business_name || '', peso(s.campaign_price), s.stock_allocation ?? '', s.status, (s.validation_errors || []).join(' | '), s.rejection_reason || ''])
    exportExcel('campaign-product-submissions.xls', 'Submissions', ['SKU', 'Product', 'Campaign', 'Merchant', 'Campaign price', 'Stock allocation', 'Status', 'Validation errors', 'Rejection reason'], rows, { title: 'All campaign product submissions' })
  }
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }))
  const create = async (event) => {
    event.preventDefault(); setSaving(true)
    const payload = {
      name: form.name.trim(), description: form.description.trim(), discount_percent: Number(form.discount_percent),
      starts_at: new Date(form.starts_at).toISOString(), ends_at: new Date(form.ends_at).toISOString(), created_by: user.id,
      requires_approval: form.requires_approval,
      min_discount_percent: form.min_discount_percent === '' ? null : Number(form.min_discount_percent),
      max_discount_percent: form.max_discount_percent === '' ? null : Number(form.max_discount_percent)
    }
    const { error } = await supabase.from('campaigns').insert(payload)
    setSaving(false); if (error) return toast.error(error.message)
    toast.success('Campaign created.'); setForm(initialForm); load()
  }
  const toggle = async (campaign) => { const { error } = await supabase.from('campaigns').update({ is_active: !campaign.is_active }).eq('id', campaign.id); if (error) return toast.error(error.message); load() }
  const state = (campaign) => { const now = Date.now(); if (!campaign.is_active) return 'Disabled'; if (now < new Date(campaign.starts_at)) return 'Upcoming'; if (now > new Date(campaign.ends_at)) return 'Ended'; return 'Live' }

  // Phase 13: edit/duplicate/archive round out the admin campaign
  // actions -- create + toggle already existed, but there was no way to
  // fix a typo in a live campaign's name/dates/rules, clone a similar
  // one, or hide an old ended campaign without deleting it outright.
  const openEdit = (campaign) => setEditing({
    id: campaign.id, name: campaign.name, description: campaign.description || '',
    discount_percent: String(campaign.discount_percent),
    starts_at: campaign.starts_at.slice(0, 16), ends_at: campaign.ends_at.slice(0, 16),
    requires_approval: campaign.requires_approval,
    min_discount_percent: campaign.min_discount_percent ?? '', max_discount_percent: campaign.max_discount_percent ?? ''
  })
  const saveEdit = async (event) => {
    event.preventDefault(); setSaving(true)
    const payload = {
      name: editing.name.trim(), description: editing.description.trim(), discount_percent: Number(editing.discount_percent),
      starts_at: new Date(editing.starts_at).toISOString(), ends_at: new Date(editing.ends_at).toISOString(),
      requires_approval: editing.requires_approval,
      min_discount_percent: editing.min_discount_percent === '' ? null : Number(editing.min_discount_percent),
      max_discount_percent: editing.max_discount_percent === '' ? null : Number(editing.max_discount_percent)
    }
    const { error } = await supabase.from('campaigns').update(payload).eq('id', editing.id)
    setSaving(false); if (error) return toast.error(error.message)
    toast.success('Campaign updated.'); setEditing(null); load()
  }
  const duplicate = async (campaign) => {
    const payload = {
      name: `${campaign.name} (Copy)`, description: campaign.description, discount_percent: campaign.discount_percent,
      starts_at: campaign.starts_at, ends_at: campaign.ends_at, created_by: user.id,
      requires_approval: campaign.requires_approval, min_discount_percent: campaign.min_discount_percent,
      max_discount_percent: campaign.max_discount_percent, is_active: false
    }
    const { error } = await supabase.from('campaigns').insert(payload)
    if (error) return toast.error(error.message)
    toast.success('Campaign duplicated as a disabled draft — review its dates before enabling it.')
    load()
  }
  const toggleArchive = async (campaign) => {
    const { error } = await supabase.from('campaigns').update({ archived: !campaign.archived }).eq('id', campaign.id)
    if (error) return toast.error(error.message)
    load()
  }
  const visibleCampaigns = campaigns.filter((c) => showArchived || !c.archived)

  return <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Marketplace promotions</p><h1 className="mt-1 font-display text-2xl font-bold text-ink">Campaign Management</h1><p className="mt-1 text-sm text-ink/50">Create platform-wide offers merchants can join.</p></div>

    <div className="mb-8 rounded-2xl border border-black/[0.06] bg-surface p-5 shadow-soft">
      <div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-mango-50 text-mango-600"><ClipboardList size={18} /></span><h2 className="font-display font-bold text-ink">Pending product submissions</h2></div><Button size="sm" variant="secondary" icon={Download} onClick={exportAllSubmissions}>Export all</Button></div>
      {pendingLoading ? <div className="flex justify-center py-10"><Spinner /></div> : pending.length === 0 ? (
        <div className="mt-3"><EmptyState icon={ClipboardList} title="Nothing to review" message="Merchant product submissions needing approval will appear here." /></div>
      ) : (
        <div className="mt-4 space-y-2">
          {pending.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-inset p-3">
              <div>
                <p className="text-sm font-semibold text-ink">{s.products?.name} <span className="font-normal text-ink/40">— {s.campaigns?.name}</span></p>
                <p className="text-xs text-ink/50">{s.merchant_profiles?.business_name} · Campaign price {peso(s.campaign_price)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" icon={Check} onClick={() => review(s.id, true)}>Approve</Button>
                <Button size="sm" variant="danger-chip" icon={X} onClick={() => review(s.id, false)}>Reject</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
    <form onSubmit={create} className="h-fit rounded-2xl border border-black/[0.06] bg-surface p-5 shadow-soft"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-700"><Plus size={18} /></span><h2 className="font-display font-bold text-ink">Add campaign</h2></div><div className="mt-5 space-y-4"><label className="block text-sm font-medium text-ink/65">Campaign name<input required maxLength="120" className="input-field mt-1" value={form.name} onChange={update('name')} placeholder="8.8 Business Sale" /></label><label className="block text-sm font-medium text-ink/65">Description<textarea maxLength="2000" rows="3" className="input-field mt-1 resize-none" value={form.description} onChange={update('description')} /></label><label className="block text-sm font-medium text-ink/65">Discount percentage<input required type="number" min="0.01" max="99" step="0.01" className="input-field mt-1" value={form.discount_percent} onChange={update('discount_percent')} placeholder="15%" /></label><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1"><label className="text-sm font-medium text-ink/65">Starts<input required type="datetime-local" className="input-field mt-1 text-sm" value={form.starts_at} onChange={update('starts_at')} /></label><label className="text-sm font-medium text-ink/65">Ends<input required type="datetime-local" className="input-field mt-1 text-sm" value={form.ends_at} onChange={update('ends_at')} /></label></div>

<div className="rounded-xl border border-black/[0.06] p-3"><p className="text-xs font-bold uppercase tracking-wide text-ink/45">Product submission rules</p><label className="mt-2 flex items-center gap-2 text-sm text-ink/65"><input type="checkbox" checked={form.requires_approval} onChange={update('requires_approval')} className="h-4 w-4 rounded" />Require admin approval for product submissions</label><div className="mt-2 grid grid-cols-2 gap-2"><label className="text-xs font-medium text-ink/55">Min discount %<input type="number" min="0" max="99" step="0.01" placeholder="No floor" className="input-field mt-1 text-sm" value={form.min_discount_percent} onChange={update('min_discount_percent')} /></label><label className="text-xs font-medium text-ink/55">Max discount %<input type="number" min="0" max="99" step="0.01" placeholder="No ceiling" className="input-field mt-1 text-sm" value={form.max_discount_percent} onChange={update('max_discount_percent')} /></label></div><p className="mt-2 text-[11px] leading-4 text-ink/40">Applies to merchant product submissions on this campaign only — not the whole-store join discount above.</p></div>

<button disabled={saving} className="btn-primary w-full">{saving ? 'Creating...' : 'Create campaign'}</button></div></form>
    <div>
      <div className="mb-3 flex justify-end"><label className="flex items-center gap-2 text-xs font-semibold text-ink/55"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-4 w-4 rounded" />Show archived</label></div>
      {loading ? <div className="flex justify-center py-24"><Spinner /></div> : visibleCampaigns.length === 0 ? <EmptyState icon={Tag} title="No campaigns" message="Create one using the form on the left." /> : <div className="grid gap-4 md:grid-cols-2">{visibleCampaigns.map((campaign) => <article key={campaign.id} className={`rounded-2xl border bg-surface p-5 shadow-soft ${campaign.archived ? 'border-black/[0.06] opacity-60' : 'border-black/[0.06]'}`}><div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-mango-100 text-mango-600"><Tag size={21} /></span><span className="flex items-center gap-1.5">{campaign.archived && <span className="badge bg-black/5 text-ink/50">Archived</span>}<span className={`badge ${state(campaign) === 'Live' ? 'bg-teal-50 text-teal-700' : 'bg-black/5 text-ink/50'}`}>{state(campaign)}</span></span></div><h3 className="mt-4 font-display text-lg font-bold text-ink">{campaign.name}</h3><p className="mt-1 line-clamp-2 min-h-10 text-sm text-ink/50">{campaign.description || 'Marketplace campaign'}</p><p className="mt-4 font-display text-3xl font-bold text-mango-600">{Number(campaign.discount_percent)}% OFF</p>{(campaign.min_discount_percent != null || campaign.max_discount_percent != null) && <p className="mt-1 text-xs text-ink/45">Product submissions: {campaign.min_discount_percent ?? 0}%–{campaign.max_discount_percent ?? 100}% · {campaign.requires_approval ? 'needs approval' : 'auto-approved'}</p>}<div className="mt-4 space-y-1 text-xs text-ink/50"><p className="flex items-center gap-2"><CalendarDays size={14} />{new Date(campaign.starts_at).toLocaleString()}</p><p className="ml-[22px]">to {new Date(campaign.ends_at).toLocaleString()}</p></div><div className="mt-4 flex items-center justify-between border-t border-black/[0.06] pt-4"><span className="text-xs font-semibold text-teal-700">{campaign.merchant_campaigns?.[0]?.count || 0} merchant(s) joined</span><div className="flex items-center gap-1"><button onClick={() => openEdit(campaign)} title="Edit" className="grid h-9 w-9 place-items-center rounded-lg text-ink/50 hover:bg-teal-100 hover:text-teal-600"><Pencil size={15} /></button><button onClick={() => duplicate(campaign)} title="Duplicate" className="grid h-9 w-9 place-items-center rounded-lg text-ink/50 hover:bg-teal-100 hover:text-teal-600"><Copy size={15} /></button><button onClick={() => toggleArchive(campaign)} title={campaign.archived ? 'Unarchive' : 'Archive'} className="grid h-9 w-9 place-items-center rounded-lg text-ink/50 hover:bg-teal-100 hover:text-teal-600">{campaign.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}</button><button onClick={() => toggle(campaign)} className="btn-secondary flex items-center gap-1.5 px-3 py-2 text-xs"><Power size={14} />{campaign.is_active ? 'Disable' : 'Enable'}</button></div></div></article>)}</div>}
    </div>
  </div>

  {editing && <div className="fixed inset-0 z-[80] overflow-y-auto bg-scrim/55 p-3 sm:p-6">
    <form onSubmit={saveEdit} className="mx-auto max-w-lg rounded-2xl bg-surface p-5 shadow-2xl sm:p-7">
      <div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold flex items-center gap-2"><Tag size={20} className="text-teal-700" />Edit campaign</h2><button type="button" onClick={() => setEditing(null)}><X /></button></div>
      <div className="mt-4 space-y-4">
        <label className="block text-sm font-medium text-ink/65">Campaign name<input required maxLength="120" className="input-field mt-1" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
        <label className="block text-sm font-medium text-ink/65">Description<textarea maxLength="2000" rows="3" className="input-field mt-1 resize-none" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></label>
        <label className="block text-sm font-medium text-ink/65">Discount percentage<input required type="number" min="0.01" max="99" step="0.01" className="input-field mt-1" value={editing.discount_percent} onChange={(e) => setEditing({ ...editing, discount_percent: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-medium text-ink/65">Starts<input required type="datetime-local" className="input-field mt-1 text-sm" value={editing.starts_at} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })} /></label>
          <label className="text-sm font-medium text-ink/65">Ends<input required type="datetime-local" className="input-field mt-1 text-sm" value={editing.ends_at} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value })} /></label>
        </div>
        <div className="rounded-xl border border-black/[0.06] p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-ink/45">Product submission rules</p>
          <label className="mt-2 flex items-center gap-2 text-sm text-ink/65"><input type="checkbox" checked={editing.requires_approval} onChange={(e) => setEditing({ ...editing, requires_approval: e.target.checked })} className="h-4 w-4 rounded" />Require admin approval for product submissions</label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-ink/55">Min discount %<input type="number" min="0" max="99" step="0.01" placeholder="No floor" className="input-field mt-1 text-sm" value={editing.min_discount_percent} onChange={(e) => setEditing({ ...editing, min_discount_percent: e.target.value })} /></label>
            <label className="text-xs font-medium text-ink/55">Max discount %<input type="number" min="0" max="99" step="0.01" placeholder="No ceiling" className="input-field mt-1 text-sm" value={editing.max_discount_percent} onChange={(e) => setEditing({ ...editing, max_discount_percent: e.target.value })} /></label>
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button></div>
    </form>
  </div>}
  </div>
}
