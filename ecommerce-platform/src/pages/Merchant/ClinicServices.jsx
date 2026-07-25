import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Stethoscope, X, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { cleanText } from '../../utils/security'

const emptyService = { name: '', description: '', service_fee: '', referral_fee: '', estimated_duration_minutes: 30 }

export default function ClinicServices() {
  const { user } = useAuth()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyService)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('clinic_services')
      .select('*')
      .eq('merchant_id', user.id)
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setServices(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const resetForm = () => {
    setForm(emptyService)
    setEditing(null)
    setShowForm(false)
  }

  const openEdit = (service) => {
    setForm({
      name: service.name,
      description: service.description || '',
      service_fee: service.service_fee,
      referral_fee: service.referral_fee,
      estimated_duration_minutes: service.estimated_duration_minutes || 30
    })
    setEditing(service.id)
    setShowForm(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    const fee = Number(form.service_fee)
    const refFee = Number(form.referral_fee)
    if (fee <= 0) { toast.error('Service fee must be greater than 0.'); setSaving(false); return }
    if (refFee <= 0 || refFee >= fee) { toast.error('Referral fee must be between ₱1 and the service fee.'); setSaving(false); return }
    const payload = {
      merchant_id: user.id,
      name: cleanText(form.name, 200),
      description: cleanText(form.description, 2000),
      service_fee: fee,
      referral_fee: refFee,
      estimated_duration_minutes: Math.max(5, Number(form.estimated_duration_minutes) || 30)
    }
    if (editing) {
      const { error } = await supabase.from('clinic_services').update(payload).eq('id', editing)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Service updated.')
    } else {
      const { error } = await supabase.from('clinic_services').insert(payload)
      if (error) { toast.error(error.message); setSaving(false); return }
      toast.success('Service added.')
    }
    resetForm()
    load()
    setSaving(false)
  }

  const toggleActive = async (service) => {
    const { error } = await supabase
      .from('clinic_services')
      .update({ is_active: !service.is_active })
      .eq('id', service.id)
    if (error) return toast.error(error.message)
    load()
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this service? Referrals linked to it will be unaffected.')) return
    const { error } = await supabase.from('clinic_services').delete().eq('id', id)
    if (error) return toast.error(error.message)
    toast.success('Service deleted.')
    load()
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Clinic services</p>
          <h1 className="mt-1 font-display text-2xl font-bold text-ink">My Services</h1>
          <p className="mt-1 text-sm text-ink/50">Manage the services Resellers can refer customers to.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus size={16} /> Add Service
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="card mb-6 space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold">{editing ? 'Edit Service' : 'New Service'}</h2>
            <button type="button" onClick={resetForm} className="p-1.5 text-ink/40 hover:text-coral-500"><X size={18} /></button>
          </div>
          <div>
            <label className="text-sm font-semibold text-ink/70">Service Name</label>
            <input required maxLength={200} className="input-field mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Dental Cleaning, Eye Checkup..." />
          </div>
          <div>
            <label className="text-sm font-semibold text-ink/70">Description (optional)</label>
            <textarea rows={2} maxLength={2000} className="input-field mt-1 resize-none" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description of what this service includes." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-ink/70">Service Fee (₱)</label>
              <input required type="number" min="1" step="0.01" className="input-field mt-1" value={form.service_fee} onChange={(e) => setForm({ ...form, service_fee: e.target.value })} placeholder="500" />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink/70">Referral Fee (₱)</label>
              <input required type="number" min="1" step="0.01" className="input-field mt-1" value={form.referral_fee} onChange={(e) => setForm({ ...form, referral_fee: e.target.value })} placeholder="100" />
              {Number(form.referral_fee) > 0 && Number(form.service_fee) > 0 && (
                <p className="mt-1 text-[11px] font-semibold text-teal-700">
                  Reseller gets {((Number(form.referral_fee) / Number(form.service_fee)) * 100).toFixed(1)}% of service fee
                </p>
              )}
            </div>
          </div>
          <div className="max-w-[200px]">
            <label className="text-sm font-semibold text-ink/70">Est. Duration (minutes)</label>
            <input required type="number" min="5" step="5" className="input-field mt-1" value={form.estimated_duration_minutes} onChange={(e) => setForm({ ...form, estimated_duration_minutes: e.target.value })} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving && <Loader2 size={15} className="animate-spin" />}
            {saving ? 'Saving...' : (editing ? 'Update Service' : 'Add Service')}
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : services.length === 0 ? (
        <EmptyState icon={Stethoscope} title="No clinic services yet" message="Add your first service so Resellers can refer customers." action={<button onClick={() => { resetForm(); setShowForm(true) }} className="btn-primary">Add Service</button>} />
      ) : (
        <div className="space-y-4">
          {services.map((service) => (
            <div key={service.id} className={`card overflow-hidden ${!service.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4 p-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-ink truncate">{service.name}</h3>
                    {!service.is_active && <span className="badge bg-ink/10 text-ink/50 text-[10px]">Inactive</span>}
                  </div>
                  {service.description && <p className="mt-1 text-sm text-ink/55 line-clamp-2">{service.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-4">
                    <span className="text-sm"><span className="text-ink/40">Service Fee:</span> <span className="font-bold text-teal-700">{peso(service.service_fee)}</span></span>
                    <span className="text-sm"><span className="text-ink/40">Referral Fee:</span> <span className="font-bold text-mango-600">{peso(service.referral_fee)}</span></span>
                    <span className="text-sm text-ink/50">~{service.estimated_duration_minutes} min</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => openEdit(service)} className="btn-secondary px-3 py-1.5 text-xs"><Pencil size={13} /> Edit</button>
                  <button onClick={() => toggleActive(service)} className="btn-secondary px-3 py-1.5 text-xs">{service.is_active ? 'Pause' : 'Activate'}</button>
                  <button onClick={() => handleDelete(service.id)} className="p-2 text-ink/40 hover:text-coral-500"><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

