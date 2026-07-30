import { useState } from 'react'
import { Store, Stethoscope, RefreshCw, Building2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const TYPES = [
  { value: 'product', label: 'Product Store', icon: Store, desc: 'Sell physical products to resellers through the catalog.' },
  { value: 'clinic', label: 'Clinic Services', icon: Stethoscope, desc: 'Offer dental, optical, or medical services with reseller referral fees.' },
  { value: 'real_estate', label: 'Real Estate Services', icon: Building2, desc: 'List properties and let resellers refer buyers/tenants for a referral fee.' },
  { value: 'both', label: 'Product Store + Services', icon: null, desc: 'Run both product sales and service referrals (clinic/real estate).' }
]

export default function ServiceSettings() {
  const { user, profile, refreshProfile } = useAuth()
  const merchant = profile?.merchant_profiles
  const [serviceType, setServiceType] = useState(merchant?.service_type || 'product')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const { error } = await supabase.from('merchant_profiles').update({ service_type: serviceType }).eq('id', user.id)
    if (error) { toast.error(error.message); setSaving(false); return }
    await refreshProfile()
    toast.success('Service type updated successfully.')
    setSaving(false)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Store settings</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-ink">Service Type</h1>
        <p className="mt-2 text-sm leading-6 text-ink/50">Choose what type of services your business offers. This determines how Resellers interact with your store.</p>
      </div>
      <div className="space-y-4">
        {TYPES.map(({ value, label, icon: Icon, desc }) => (
          <label key={value} className={`flex cursor-pointer items-start gap-4 rounded-2xl border-2 p-5 transition ${serviceType === value ? 'border-teal-600 bg-teal-50 shadow-md' : 'border-black/[0.06] bg-surface hover:border-teal-200 hover:shadow-soft'}`}>
            <input type="radio" name="service_type" value={value} checked={serviceType === value} onChange={(e) => setServiceType(e.target.value)} className="mt-1 accent-teal-600" />
            <div className="flex-1">
              <div className="flex items-center gap-2">{Icon && <Icon size={18} className="text-teal-600" />}<span className="font-display font-bold text-ink">{label}</span></div>
              <p className="mt-1 text-sm leading-5 text-ink/55">{desc}</p>
            </div>
          </label>
        ))}
      </div>
      <button onClick={handleSave} disabled={saving || serviceType === merchant?.service_type} className="btn-primary mt-6 flex items-center gap-2">
        {saving && <RefreshCw size={16} className="animate-spin" />}{saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  )
}
