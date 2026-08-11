import { useEffect, useState } from 'react'
import { Archive, Download, Eye, FileCode2, Plus, RotateCcw, Save, Send, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import DataTable from '../../components/ui/DataTable'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { sanitizePolicyHtml } from '../../utils/sanitizeHtml'

const types = {
  terms: 'Terms of Service',
  privacy: 'Privacy Policy',
  merchant: 'Merchant Agreement',
  reseller: 'Reseller Agreement',
  commission: 'Commission Policy',
  refund: 'Refund and Dispute Policy',
  cookie: 'Cookie Policy',
  acceptable_use: 'Acceptable Use Policy',
  termination: 'Suspension and Termination'
}

const blank = {
  policy_type: 'terms',
  version: '1.0',
  title: types.terms,
  content: '<h2>1. Section title</h2><p>Policy content...</p>',
  effective_date: new Date().toISOString().slice(0, 10),
  status: 'draft'
}

const safeHtml = (value = '') => {
  const doc = new DOMParser().parseFromString(value, 'text/html')
  doc.querySelectorAll('script,style,iframe,object,embed,form,link,meta').forEach((node) => node.remove())
  doc.querySelectorAll('*').forEach((node) => [...node.attributes].forEach((attr) => {
    if (attr.name.startsWith('on') || /javascript:/i.test(attr.value)) node.removeAttribute(attr.name)
  }))
  return doc.body.innerHTML
}

export default function LegalSettings() {
  const { profile } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [preview, setPreviewState] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // { type: 'publish'|'archive', row }
  const [confirming, setConfirming] = useState(false)

  const setPreview = (value) => setPreviewState(value ? { ...value, content: safeHtml(value.content), title: safeHtml(value.title), version: safeHtml(value.version) } : null)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('system_policies').select('*').order('policy_type').order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      policy_type: form.policy_type,
      version: form.version.trim(),
      title: form.title.trim(),
      content: form.content,
      effective_date: form.effective_date,
      status: form.status || 'draft',
      created_by: form.created_by || profile?.id,
      updated_at: new Date().toISOString()
    }
    const result = form.id ? await supabase.from('system_policies').update(payload).eq('id', form.id) : await supabase.from('system_policies').insert(payload)
    setSaving(false)
    if (result.error) return toast.error(result.error.message)
    toast.success('Policy saved.')
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
      ? await supabase.rpc('publish_system_policy', { target_id: row.id })
      : await supabase.from('system_policies').update({ status: 'archived', updated_at: new Date().toISOString() }).eq('id', row.id)
    setConfirming(false)
    if (error) return toast.error(error.message)
    toast.success(type === 'publish' ? 'Policy published.' : 'Version archived.')
    setConfirmAction(null)
    load()
  }

  const restore = (row) => setForm({ ...row, id: undefined, version: `${row.version}-restored-${new Date().toISOString().slice(0, 10)}`, status: 'draft', created_by: profile?.id })

  const html = (row) => `<!doctype html><html><head><meta charset="utf-8"><title>JOM HUB Policy</title><style>body{font:16px/1.65 Arial;max-width:850px;margin:40px auto;padding:20px;color:#16211e}h1,h2{color:#0b5b46}</style></head><body><h1>${safeHtml(row.title)}</h1><p>Version ${safeHtml(row.version)} · Effective ${safeHtml(row.effective_date)}</p>${safeHtml(row.content)}<hr><small>© ${new Date().getFullYear()} JOM HUB</small></body></html>`

  const exportHtml = (row) => {
    const url = URL.createObjectURL(new Blob([html(row)], { type: 'text/html' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${row.policy_type}-v${row.version}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = (row) => {
    const w = window.open('', '_blank')
    if (!w) return toast.error('Allow pop-ups to export PDF.')
    w.document.write(html(row))
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 250)
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Legal Settings</h1>
          <p className="mt-1 text-sm text-ink/55">Manage published policies and complete version history.</p>
        </div>
        <button className="btn-primary inline-flex items-center justify-center gap-2" onClick={() => setForm({ ...blank })}><Plus size={17} /> Add Policy</button>
      </div>

      <div className="mt-6">
        <DataTable
          columns={[
            { header: 'Policy', accessor: 'title', render: (row) => <>{row.title}<p className="text-xs font-normal text-ink/45">{types[row.policy_type]}</p></> },
            { header: 'Version', accessor: 'version' },
            { header: 'Effective', accessor: 'effective_date', render: (row) => <span className="whitespace-nowrap">{row.effective_date}</span> },
            { header: 'Status', accessor: 'status', render: (row) => <Badge tone={row.status === 'published' ? 'success' : row.status === 'archived' ? 'neutral' : 'warning'}>{row.status}</Badge> }
          ]}
          data={rows}
          searchable={false}
          emptyTitle="No policies yet"
          emptyMessage="Add a policy to get started."
          actions={[
            { label: 'Edit', icon: <Save size={16} />, onClick: setForm },
            { label: 'Preview', icon: <Eye size={16} />, onClick: setPreview },
            { label: 'Publish', icon: <Send size={16} />, onClick: publish, className: 'text-teal-700 hover:bg-teal-50', hidden: (row) => row.status === 'published' },
            { label: 'Archive', icon: <Archive size={16} />, onClick: archive, hidden: (row) => row.status === 'archived' },
            { label: 'Restore as draft', icon: <RotateCcw size={16} />, onClick: restore },
            { label: 'Export HTML', icon: <FileCode2 size={16} />, onClick: exportHtml },
            { label: 'Print / Save PDF', icon: <Download size={16} />, onClick: exportPdf }
          ]}
        />
      </div>

      {/* onClose is guarded so Escape while the Preview modal is also open (opened from the
          form below) only closes Preview, not this form underneath it — otherwise a single
          Escape press while previewing would silently discard in-progress edits. */}
      <Modal open={!!form} onClose={() => { if (!preview) setForm(null) }} hideHeader bodyClassName="" size="xl" ariaLabel={form ? (form.id ? 'Edit Policy' : 'New Policy Version') : undefined}>
        {form && (
          <form onSubmit={save} className="p-5 sm:p-7">
            <div className="flex justify-between">
              <h2 className="font-display text-xl font-bold">{form.id ? 'Edit Policy' : 'New Policy Version'}</h2>
              <button type="button" onClick={() => setForm(null)} aria-label="Close"><X /></button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Policy type
                <select className="input-field mt-1" value={form.policy_type} onChange={(e) => setForm({ ...form, policy_type: e.target.value, title: form.id ? form.title : types[e.target.value] })}>
                  {Object.entries(types).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="text-sm font-semibold">Version
                <input required className="input-field mt-1" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
              </label>
              <label className="text-sm font-semibold sm:col-span-2">Title
                <input required className="input-field mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <label className="text-sm font-semibold">Effective date
                <input required type="date" className="input-field mt-1" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
              </label>
              <label className="text-sm font-semibold">Status
                <select className="input-field mt-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="text-sm font-semibold sm:col-span-2">Content (HTML)
                <textarea required rows="16" className="input-field mt-1 font-mono text-xs" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setPreview(form)}>Preview</button>
              <button disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save Policy'}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!preview} onClose={() => setPreview(null)} hideHeader bodyClassName="p-5 sm:p-8" size="xl" ariaLabel={preview ? preview.title : undefined}>
        {preview && (
          <>
            <div className="flex justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold">{preview.title}</h2>
                <p className="text-xs text-ink/50">Version {preview.version} · Effective {preview.effective_date}</p>
              </div>
              <button onClick={() => setPreview(null)} aria-label="Close"><X /></button>
            </div>
            <article className="legal-content mt-7" dangerouslySetInnerHTML={{ __html: sanitizePolicyHtml(preview.content) }} />
          </>
        )}
      </Modal>
      <ConfirmDialog
        open={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={runConfirmedAction}
        loading={confirming}
        variant={confirmAction?.type === 'publish' ? 'primary' : 'danger'}
        title={confirmAction?.type === 'publish' ? 'Publish this policy?' : 'Archive this version?'}
        message={confirmAction?.type === 'publish' ? `Publish ${confirmAction?.row?.title} version ${confirmAction?.row?.version}?` : 'Archive this version?'}
        confirmText={confirmAction?.type === 'publish' ? 'Publish' : 'Archive'}
      />
    </div>
  )
}
