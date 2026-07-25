import { useEffect, useState } from 'react'
import { Truck, RefreshCw, Loader2, Eye, EyeOff, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function DeliverySettings() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [form, setForm] = useState({
    api_key: '',
    api_secret: '',
    market: 'PH_MNL',
    is_enabled: false
  })

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('get_lalamove_settings')
    if (error && error.message !== 'NOT_AUTHENTICATED') toast.error(error.message)
    if (data) {
      setForm({
        api_key: data.api_key || '',
        api_secret: data.api_secret || '',
        market: data.market || 'PH_MNL',
        is_enabled: data.is_enabled || false
      })
    }
    setLoading(false)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (form.is_enabled && (!form.api_key || !form.api_secret)) {
      return toast.error('Enter your API key and secret before enabling Lalamove.')
    }
    setSaving(true)
    const { error } = await supabase.rpc('save_lalamove_settings', {
      p_api_key: form.api_key || null,
      p_api_secret: form.api_secret || null,
      p_market: form.market,
      p_is_enabled: form.is_enabled
    })
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(form.is_enabled ? 'Lalamove integration enabled!' : 'Settings saved.')
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <RefreshCw size={24} className="animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Delivery settings</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">Lalamove Integration</h1>
        <p className="mt-2 text-sm leading-6 text-ink/50">
          Connect your Lalamove account to get real-time shipping quotes and auto-book deliveries. If you don't have a Lalamove account, the standard shipping fee estimation will be used.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Enable Toggle */}
        <div className="card p-5">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Truck size={18} className="text-teal-600" />
                <span className="font-display font-bold text-ink">Enable Lalamove</span>
              </div>
              <p className="mt-1 text-sm text-ink/50">
                {form.is_enabled
                  ? 'Real-time quotes and auto-booking are active during checkout.'
                  : 'Standard shipping estimation will be used instead.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, is_enabled: !form.is_enabled })}
              className={`relative h-7 w-12 rounded-full transition-colors ${
                form.is_enabled ? 'bg-teal-600' : 'bg-ink/20'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  form.is_enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </label>
        </div>

        {/* API Credentials */}
        <div className={`space-y-4 transition-opacity ${!form.is_enabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="card p-5 space-y-4">
            <h2 className="font-display font-bold text-ink">API Credentials</h2>
            <p className="text-xs text-ink/45">
              Get your API key and secret from the{' '}
              <a
                href="https://www.lalamove.com/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-teal-600 font-semibold underline inline-flex items-center gap-1"
              >
                Lalamove Developer Console <ExternalLink size={12} />
              </a>
            </p>

            <div>
              <label className="text-sm font-semibold text-ink/70">API Key</label>
              <input
                type="text"
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                className="input-field mt-1"
                placeholder="lalamove_api_key_..."
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-ink/70">API Secret</label>
              <div className="relative mt-1">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={form.api_secret}
                  onChange={(e) => setForm({ ...form, api_secret: e.target.value })}
                  className="input-field w-full pr-10"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink"
                >
                  {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-ink/70">Market</label>
              <select
                value={form.market}
                onChange={(e) => setForm({ ...form, market: e.target.value })}
                className="input-field mt-1"
              >
                <option value="PH_MNL">Metro Manila (PH_MNL)</option>
                <option value="PH_CEB">Cebu (PH_CEB)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="rounded-2xl border border-teal-100 bg-teal-50 p-5">
          <div className="flex items-start gap-3">
            <Truck size={20} className="shrink-0 text-teal-600 mt-0.5" />
            <div>
              <p className="font-semibold text-teal-900">How Lalamove integration works</p>
              <ul className="mt-2 space-y-1.5 text-sm leading-5 text-teal-800/70">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                  During checkout, Lalamove vehicle options and prices are shown
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                  When the merchant dispatches, a Lalamove delivery is auto-created
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                  If Lalamove is disabled, the standard shipping estimation is used
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                  The shipping fee is paid directly to the rider upon delivery
                </li>
              </ul>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary flex w-full items-center justify-center gap-2 py-3"
        >
          {saving && <Loader2 size={16} className="animate-spin" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
