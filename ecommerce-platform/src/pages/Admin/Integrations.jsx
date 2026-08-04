import { useEffect, useState } from 'react'
import { KeyRound, Plug, Plus, RefreshCw, ScrollText, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { listIntegrations, saveIntegration, listIntegrationLogs } from '../../lib/services/integrations'
import Spinner from '../../components/ui/Spinner'

// Settings -> Integrations. Every row here comes from integration_configs
// (seeded in 20260804000100_integration_scaffolding.sql) — nothing in
// this page is hardcoded per provider. Credentials are typed here and
// stored via save_integration_config(), which puts them in Supabase
// Vault and keeps only the secret id in the database. No API key or
// secret ever lives in source code.

export default function Integrations() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [logsFor, setLogsFor] = useState(null)
  const [logs, setLogs] = useState([])

  const load = async () => {
    setLoading(true)
    try { setRows(await listIntegrations()) } catch (error) { toast.error(error.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openForm = (row) => setForm({
    key: row.key,
    label: row.label,
    enabled: row.enabled,
    mode: row.mode,
    credentials: Object.fromEntries((row.credential_names || []).map((name) => [name, ''])),
    newCredentialName: '',
    webhookSecret: '',
    hasWebhookSecret: row.has_webhook_secret,
  })

  const addCredentialField = () => {
    const name = form.newCredentialName.trim()
    if (!name || form.credentials[name] !== undefined) return
    setForm({ ...form, credentials: { ...form.credentials, [name]: '' }, newCredentialName: '' })
  }
  const removeCredentialField = (name) => {
    const next = { ...form.credentials }
    delete next[name]
    setForm({ ...form, credentials: next })
  }

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    // Only send credential values that were actually typed this time —
    // blank means "leave the stored secret as-is", never "clear it".
    const credentialsToSend = Object.fromEntries(
      Object.entries(form.credentials).filter(([, value]) => value.trim().length > 0)
    )
    try {
      await saveIntegration(form.key, {
        enabled: form.enabled,
        mode: form.mode,
        credentials: credentialsToSend,
        webhookSecret: form.webhookSecret.trim(),
      })
      toast.success(`${form.label} saved.`)
      setForm(null)
      load()
    } catch (error) { toast.error(error.message) }
    setSaving(false)
  }

  const openLogs = async (row) => {
    setLogsFor(row)
    try { setLogs(await listIntegrationLogs(row.key)) } catch (error) { toast.error(error.message) }
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
    <div>
      <h1 className="font-display text-2xl font-bold">Integrations</h1>
      <p className="mt-1 text-sm text-ink/55">Enable a provider only once real API keys are entered below. Everything stays on the current manual workflow until then.</p>
    </div>

    <div className="mt-6 overflow-hidden rounded-2xl border border-black/[.06] bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-teal-50 text-xs uppercase text-teal-900">
            <tr>
              <th className="p-4">Integration</th>
              <th className="p-4">Status</th>
              <th className="p-4">Mode</th>
              <th className="p-4">Credentials</th>
              <th className="p-4">Updated</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => <tr key={row.key} className="border-t border-black/5">
              <td className="p-4 font-semibold">{row.label}<p className="text-xs font-normal text-ink/45">{row.key}</p></td>
              <td className="p-4">
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.enabled ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                  {row.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </td>
              <td className="p-4 capitalize">{row.mode}</td>
              <td className="p-4 text-xs text-ink/55">
                {row.credential_names?.length ? `${row.credential_names.length} field(s) set` : 'None yet'}
                {row.has_webhook_secret && <span className="ml-1">· webhook secret set</span>}
              </td>
              <td className="p-4 whitespace-nowrap text-xs text-ink/50">{row.updated_at ? new Date(row.updated_at).toLocaleDateString() : '—'}</td>
              <td className="p-4">
                <div className="flex justify-end gap-1">
                  <button title="Configure" onClick={() => openForm(row)} className="rounded-lg p-2 hover:bg-teal-50"><KeyRound size={16} /></button>
                  <button title="View logs" onClick={() => openLogs(row)} className="rounded-lg p-2 hover:bg-teal-50"><ScrollText size={16} /></button>
                </div>
              </td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>

    {form && <div className="fixed inset-0 z-[80] overflow-y-auto bg-scrim/55 p-3 sm:p-6">
      <form onSubmit={save} className="mx-auto max-w-xl rounded-2xl bg-surface p-5 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold flex items-center gap-2"><Plug size={20} className="text-teal-700" />{form.label}</h2>
          <button type="button" onClick={() => setForm(null)}><X /></button>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-xl bg-teal-50 px-4 py-3">
          <span className="text-sm font-semibold">Enabled</span>
          <label className="relative inline-flex cursor-pointer items-center">
            <input type="checkbox" className="peer sr-only" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            <div className="h-6 w-11 rounded-full bg-slate-300 peer-checked:bg-teal-700 transition" />
            <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
          </label>
        </div>

        <label className="mt-4 block text-sm font-semibold">Mode
          <select className="input-field mt-1" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
            <option value="sandbox">Sandbox</option>
            <option value="production">Production</option>
          </select>
        </label>

        <div className="mt-4">
          <p className="text-sm font-semibold">Credentials</p>
          <p className="text-xs text-ink/50">Field names come from the provider's own docs — add whatever they ask for (e.g. api_key, public_key). Leave a field blank to keep the value already saved.</p>
          <div className="mt-2 space-y-2">
            {Object.keys(form.credentials).map((name) => <div key={name} className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate text-xs font-mono text-ink/60">{name}</span>
              <input type="password" placeholder="••••••••" className="input-field flex-1" value={form.credentials[name]} onChange={(e) => setForm({ ...form, credentials: { ...form.credentials, [name]: e.target.value } })} />
              <button type="button" onClick={() => removeCredentialField(name)} className="rounded-lg p-2 text-ink/40 hover:bg-slate-100"><Trash2 size={15} /></button>
            </div>)}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <input placeholder="field name, e.g. api_key" className="input-field flex-1 text-sm" value={form.newCredentialName} onChange={(e) => setForm({ ...form, newCredentialName: e.target.value })} />
            <button type="button" onClick={addCredentialField} className="btn-secondary inline-flex items-center gap-1 !px-3 !py-2 text-sm"><Plus size={15} /> Add</button>
          </div>
        </div>

        <label className="mt-4 block text-sm font-semibold">Webhook secret {form.hasWebhookSecret && <span className="font-normal text-ink/45">(already set — leave blank to keep it)</span>}
          <input type="password" placeholder="••••••••" className="input-field mt-1" value={form.webhookSecret} onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })} />
        </label>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setForm(null)}>Cancel</button>
          <button disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>}

    {logsFor && <div className="fixed inset-0 z-[80] overflow-y-auto bg-scrim/55 p-3 sm:p-6">
      <div className="mx-auto max-w-2xl rounded-2xl bg-surface p-5 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">{logsFor.label} — logs</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => openLogs(logsFor)} className="rounded-lg p-2 hover:bg-teal-50"><RefreshCw size={16} /></button>
            <button type="button" onClick={() => setLogsFor(null)}><X /></button>
          </div>
        </div>
        <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto">
          {logs.length === 0 && <p className="py-8 text-center text-sm text-ink/45">No events logged yet. Nothing has called this integration.</p>}
          {logs.map((log) => <div key={log.id} className="rounded-xl border border-black/5 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-2 py-0.5 font-bold ${log.status === 'success' ? 'bg-green-100 text-green-800' : log.status === 'retry' ? 'bg-mango-100 text-mango-700' : 'bg-red-100 text-red-700'}`}>{log.status}</span>
              <span className="text-ink/40">{new Date(log.created_at).toLocaleString()}</span>
            </div>
            <p className="mt-1 font-mono">{log.direction} · {log.event_type}</p>
            {log.error_message && <p className="mt-1 text-red-700">{log.error_message}</p>}
          </div>)}
        </div>
      </div>
    </div>}
  </div>
}
