import { useEffect, useState } from 'react'
import { CalendarDays, Clock3, Edit3, Loader2, Mail, Phone, RefreshCw, Save, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

const labels = { pending: 'Pending', contacted: 'Contacted', confirmed: 'Confirmed', cancelled: 'Cancelled' }
const styles = { pending: 'bg-mango-100 text-mango-700', contacted: 'bg-teal-50 text-teal-700', confirmed: 'bg-teal-100 text-teal-800', cancelled: 'bg-coral-100 text-coral-600' }
const roleLabels = { merchant: 'Merchant', reseller: 'Reseller', not_sure: 'Not sure yet' }

export default function Registrations() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [schedule, setSchedule] = useState({ preferred_date: '', preferred_time: '' })
  const [savingSchedule, setSavingSchedule] = useState(false)
  const minDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  const load = async () => { setLoading(true); const { data, error } = await supabase.from('registration_appointments').select('*').order('preferred_date').order('preferred_time'); if (error) toast.error(error.message); setItems(data || []); setLoading(false) }
  useEffect(() => { load() }, [])
  const updateStatus = async (id, status) => { const { error } = await supabase.from('registration_appointments').update({ status, updated_at: new Date().toISOString() }).eq('id', id); if (error) return toast.error(error.message); toast.success('Registration updated.'); setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item)) }

  const startReschedule = (item) => {
    setEditingId(item.id)
    setSchedule({ preferred_date: item.preferred_date, preferred_time: item.preferred_time.slice(0, 5) })
  }

  const saveSchedule = async (item) => {
    if (!schedule.preferred_date || !schedule.preferred_time) return toast.error('Choose both a new date and time.')
    if (schedule.preferred_date < minDate) return toast.error('The appointment date cannot be in the past.')
    setSavingSchedule(true)
    const { error } = await supabase.from('registration_appointments').update({
      preferred_date: schedule.preferred_date,
      preferred_time: schedule.preferred_time,
      updated_at: new Date().toISOString()
    }).eq('id', item.id)
    setSavingSchedule(false)
    if (error) return toast.error(error.message)
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...schedule } : entry).sort((a, b) => `${a.preferred_date}${a.preferred_time}`.localeCompare(`${b.preferred_date}${b.preferred_time}`)))
    setEditingId(null)
    toast.success('Appointment rescheduled successfully.')
  }

  return <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8"><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Front-page appointments</p><h1 className="mt-1 font-display text-2xl font-bold text-ink">Registration Calendar</h1><p className="mt-1 text-sm text-ink/50">Review visitors’ preferred dates and contact them to confirm.</p></div><button onClick={load} className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"><RefreshCw size={16} /> Refresh</button></div>
    {loading ? <div className="flex justify-center py-24"><Spinner /></div> : items.length === 0 ? <EmptyState icon={CalendarDays} title="No registrations yet" message="Front-page schedule registrations will appear here." /> : <div className="grid gap-4 lg:grid-cols-2">{items.map((item) => <article key={item.id} className="card p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-display text-lg font-bold text-ink">{item.full_name}</p><p className="mt-1 text-xs font-semibold text-teal-700">Interested as {roleLabels[item.interested_role]}</p></div><span className={`badge ${styles[item.status]}`}>{labels[item.status]}</span></div>{editingId === item.id ? <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/60 p-4"><p className="flex items-center gap-2 text-sm font-bold text-teal-900"><Edit3 size={16} /> Reschedule appointment</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-ink/60">New date<input type="date" min={minDate} required value={schedule.preferred_date} onChange={(event) => setSchedule((current) => ({ ...current, preferred_date: event.target.value }))} className="input-field mt-1.5 py-2.5" /></label><label className="text-xs font-semibold text-ink/60">New time<input type="time" required value={schedule.preferred_time} onChange={(event) => setSchedule((current) => ({ ...current, preferred_time: event.target.value }))} className="input-field mt-1.5 py-2.5" /></label></div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><button type="button" disabled={savingSchedule} onClick={() => saveSchedule(item)} className="btn-primary flex flex-1 items-center justify-center gap-2 py-2.5 text-sm">{savingSchedule ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save schedule</button><button type="button" disabled={savingSchedule} onClick={() => setEditingId(null)} className="btn-secondary flex items-center justify-center gap-2 py-2.5 text-sm"><X size={15} /> Cancel</button></div></div> : <div className="mt-4 rounded-xl bg-cream p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-start gap-2 font-semibold text-ink"><CalendarDays size={17} className="mt-0.5 shrink-0 text-teal-600" />{new Date(`${item.preferred_date}T${item.preferred_time}`).toLocaleString('en-PH', { dateStyle: 'full', timeStyle: 'short' })}</p><button type="button" onClick={() => startReschedule(item)} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-teal-100 bg-white px-3 py-2 text-xs font-bold text-teal-700 shadow-sm hover:bg-teal-50"><Clock3 size={14} /> Change date</button></div></div>}<div className="mt-4 space-y-2 text-sm text-ink/60"><a href={`mailto:${item.email}`} className="flex items-center gap-2 hover:text-teal-700"><Mail size={15} />{item.email}</a><a href={`tel:${item.phone}`} className="flex items-center gap-2 hover:text-teal-700"><Phone size={15} />{item.phone}</a>{item.notes && <p className="rounded-xl border border-black/5 p-3 text-xs leading-5">{item.notes}</p>}</div><label className="mt-4 block text-xs font-bold uppercase tracking-wide text-ink/40">Status<select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value)} className="input-field mt-1.5 py-2.5 text-sm"><option value="pending">Pending</option><option value="contacted">Contacted</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select></label></article>)}</div>}
  </div>
}
