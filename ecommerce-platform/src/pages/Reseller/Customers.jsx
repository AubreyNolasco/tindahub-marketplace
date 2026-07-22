import { useEffect, useState } from 'react'
import { Users, Plus, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { cleanText } from '../../utils/security'
import { COMPLETE_ADDRESS_HELP, isCompleteAddress } from '../../utils/address'

export default function Customers() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' })

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('reseller_id', user.id)
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    setCustomers(data || [])
    setLoading(false)
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!isCompleteAddress(form.address)) return toast.error('Please enter the customer’s complete delivery address.')
    const payload = { reseller_id: user.id, name: cleanText(form.name, 160), phone: cleanText(form.phone, 30), address: cleanText(form.address, 500), notes: cleanText(form.notes, 1000) }
    const { error } = await supabase.from('customers').insert(payload)
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('Naidagdag ang customer.')
    setForm({ name: '', phone: '', address: '', notes: '' })
    setShowForm(false)
    load()
  }

  const handleDelete = async (id) => {
    await supabase.from('customers').delete().eq('id', id)
    load()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl text-ink">Customer List</h1>
        <button onClick={() => setShowForm((s) => !s)} className="btn-primary text-sm flex items-center gap-1.5">
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? 'Cancel' : 'New Customer'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="card p-5 mb-6 space-y-3">
          <input required className="input-field" placeholder="Pangalan" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <input className="input-field" placeholder="Phone number" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <div><label className="text-sm font-semibold text-ink/70">Complete Delivery Address</label><textarea required maxLength="500" rows={4} className="input-field mt-1 resize-none" placeholder="House/Unit No., Street, Barangay, City, Province, Postal Code, Landmark" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /><p className="mt-1 text-[11px] leading-4 text-ink/45">{COMPLETE_ADDRESS_HELP}</p><div className={`mt-2 rounded-lg px-3 py-2 text-xs font-medium ${isCompleteAddress(form.address) ? 'bg-teal-50 text-teal-700' : 'bg-mango-100/60 text-ink/55'}`}>{isCompleteAddress(form.address) ? 'Complete delivery address' : 'Complete address required before saving'}</div></div>
          <textarea className="input-field" placeholder="Notes (optional)" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <button type="submit" disabled={!isCompleteAddress(form.address)} className="btn-primary w-full">Save Customer</button>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : customers.length === 0 ? (
        <EmptyState icon={Users} title="No saved customers yet" message="Add your regular customers for faster checkout." />
      ) : (
        <div className="space-y-3">
          {customers.map((c) => (
            <div key={c.id} className="card p-4 flex items-start justify-between">
              <div>
                <p className="font-semibold text-ink">{c.name}</p>
                <p className="text-sm text-ink/60">{c.phone}</p>
                <p className="text-sm text-ink/60">{c.address}</p>
                {c.notes && <p className="text-xs text-ink/40 mt-1">{c.notes}</p>}
              </div>
              <button onClick={() => handleDelete(c.id)} className="p-2 text-ink/40 hover:text-coral-500">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
