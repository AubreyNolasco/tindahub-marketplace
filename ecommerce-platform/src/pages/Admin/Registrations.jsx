import { useEffect, useState } from 'react'
import { Ban, CalendarDays, Clock3, Edit3, Loader2, Mail, Phone, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { manilaDateTimeParts, REGISTRATION_TIMES } from '../../utils/registrationSchedule'

const labels = { pending: 'Pending', contacted: 'Contacted', confirmed: 'Confirmed', cancelled: 'Cancelled' }
const styles = { pending: 'bg-mango-100 text-mango-700', contacted: 'bg-teal-50 text-teal-700', confirmed: 'bg-teal-100 text-teal-800', cancelled: 'bg-coral-100 text-coral-600' }
const roleLabels = { merchant: 'Merchant', reseller: 'Reseller', not_sure: 'Not sure yet' }
const emptyBlock = { unavailable_date: '', unavailable_time: '', reason: 'Registration unavailable' }
const timeLabel = (time) => new Date(`2000-01-01T${time}`).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })

export default function Registrations() {
  const [items, setItems] = useState([])
  const [unavailable, setUnavailable] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState(null)
  const [schedule, setSchedule] = useState({ preferred_date: '', preferred_time: '' })
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [blockForm, setBlockForm] = useState(emptyBlock)
  const [savingBlock, setSavingBlock] = useState(false)
  const minDate = manilaDateTimeParts().date

  const load = async () => {
    setLoading(true)
    const [appointments, blocks] = await Promise.all([
      supabase.from('registration_appointments').select('*').order('preferred_date').order('preferred_time'),
      supabase.from('registration_unavailable_slots').select('*').gte('unavailable_date', minDate).order('unavailable_date').order('unavailable_time')
    ])
    if (appointments.error || blocks.error) toast.error(appointments.error?.message || blocks.error?.message)
    setItems(appointments.data || [])
    setUnavailable(blocks.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const updateStatus = async (id, status) => {
    const { error } = await supabase.from('registration_appointments').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return toast.error(error.message)
    setItems((current) => current.map((item) => item.id === id ? { ...item, status } : item))
    toast.success('Registration updated.')
  }

  const startReschedule = (item) => {
    setEditingId(item.id)
    setSchedule({ preferred_date: item.preferred_date, preferred_time: item.preferred_time.slice(0, 5) })
  }

  const saveSchedule = async (item) => {
    if (!schedule.preferred_date || !schedule.preferred_time) return toast.error('Choose both a new date and time.')
    setSavingSchedule(true)
    const { error } = await supabase.from('registration_appointments').update({ ...schedule, updated_at: new Date().toISOString() }).eq('id', item.id)
    setSavingSchedule(false)
    if (error) return toast.error(/REGISTRATION_/.test(error.message) ? 'That schedule is unavailable or already reserved.' : error.message)
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...schedule } : entry).sort((a, b) => `${a.preferred_date}${a.preferred_time}`.localeCompare(`${b.preferred_date}${b.preferred_time}`)))
    setEditingId(null)
    toast.success('Appointment rescheduled successfully.')
  }

  const addUnavailable = async (event) => {
    event.preventDefault()
    setSavingBlock(true)
    const { data, error } = await supabase.from('registration_unavailable_slots').insert({
      unavailable_date: blockForm.unavailable_date,
      unavailable_time: blockForm.unavailable_time || null,
      reason: blockForm.reason.trim()
    }).select().single()
    setSavingBlock(false)
    if (error) return toast.error(error.code === '23505' ? 'That unavailable schedule already exists.' : error.message)
    setUnavailable((current) => [...current, data].sort((a, b) => `${a.unavailable_date}${a.unavailable_time || ''}`.localeCompare(`${b.unavailable_date}${b.unavailable_time || ''}`)))
    setBlockForm(emptyBlock)
    toast.success('Unavailable schedule added.')
  }

  const removeUnavailable = async (slot) => {
    const { error } = await supabase.from('registration_unavailable_slots').delete().eq('id', slot.id)
    if (error) return toast.error(error.message)
    setUnavailable((current) => current.filter((entry) => entry.id !== slot.id))
    toast.success('Schedule is available again.')
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Front-page appointments</p><h1 className="mt-1 font-display text-2xl font-bold text-ink">Registration Calendar</h1><p className="mt-1 text-sm text-ink/50">Review appointments and control unavailable schedules.</p></div>
        <button onClick={load} className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"><RefreshCw size={16} /> Refresh</button>
      </div>

      <section className="mb-7 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <form onSubmit={addUnavailable} className="card p-5">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-coral-100 text-coral-600"><Ban size={19} /></span><div><h2 className="font-display font-bold">Mark registration unavailable</h2><p className="text-xs text-ink/45">Block a whole date or one specific time.</p></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-ink/60">Date<input required type="date" min={minDate} value={blockForm.unavailable_date} onChange={(event) => setBlockForm((current) => ({ ...current, unavailable_date: event.target.value }))} className="input-field mt-1.5" /></label>
            <label className="text-xs font-bold text-ink/60">Time<select value={blockForm.unavailable_time} onChange={(event) => setBlockForm((current) => ({ ...current, unavailable_time: event.target.value }))} className="input-field mt-1.5"><option value="">Whole day</option>{REGISTRATION_TIMES.map((time) => <option key={time} value={time}>{timeLabel(time)}</option>)}</select></label>
          </div>
          <label className="mt-3 block text-xs font-bold text-ink/60">Reason<input required minLength="3" maxLength="200" value={blockForm.reason} onChange={(event) => setBlockForm((current) => ({ ...current, reason: event.target.value }))} className="input-field mt-1.5" /></label>
          <button disabled={savingBlock} className="btn-primary mt-4 flex w-full items-center justify-center gap-2">{savingBlock ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add unavailable schedule</button>
        </form>
        <div className="card p-5"><h2 className="font-display font-bold">Upcoming unavailable schedules</h2><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{unavailable.length === 0 ? <p className="rounded-xl bg-cream p-4 text-sm text-ink/45">No blocked schedules.</p> : unavailable.map((slot) => <div key={slot.id} className="flex items-center justify-between gap-3 rounded-xl border border-black/5 p-3"><div><p className="text-sm font-bold">{new Date(`${slot.unavailable_date}T00:00:00`).toLocaleDateString('en-PH', { dateStyle: 'medium' })} · {slot.unavailable_time ? timeLabel(slot.unavailable_time) : 'Whole day'}</p><p className="mt-0.5 text-xs text-ink/45">{slot.reason}</p></div><button onClick={() => removeUnavailable(slot)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-coral-600 hover:bg-coral-100" title="Make available again"><Trash2 size={17} /></button></div>)}</div></div>
      </section>

      {loading ? <div className="flex justify-center py-24"><Spinner /></div> : items.length === 0 ? <EmptyState icon={CalendarDays} title="No registrations yet" message="Front-page schedule registrations will appear here." /> : <div className="grid gap-4 lg:grid-cols-2">{items.map((item) => <article key={item.id} className="card p-5">
        <div className="flex items-start justify-between gap-3"><div><p className="font-display text-lg font-bold text-ink">{item.full_name}</p><p className="mt-1 text-xs font-semibold text-teal-700">Interested as {roleLabels[item.interested_role]}</p></div><span className={`badge ${styles[item.status]}`}>{labels[item.status]}</span></div>
        {editingId === item.id ? <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/60 p-4"><p className="flex items-center gap-2 text-sm font-bold text-teal-900"><Edit3 size={16} /> Reschedule appointment</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-semibold text-ink/60">New date<input type="date" min={minDate} required value={schedule.preferred_date} onChange={(event) => setSchedule((current) => ({ ...current, preferred_date: event.target.value }))} className="input-field mt-1.5 py-2.5" /></label><label className="text-xs font-semibold text-ink/60">New time<select required value={schedule.preferred_time} onChange={(event) => setSchedule((current) => ({ ...current, preferred_time: event.target.value }))} className="input-field mt-1.5 py-2.5">{REGISTRATION_TIMES.map((time) => <option key={time} value={time}>{timeLabel(time)}</option>)}</select></label></div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><button type="button" disabled={savingSchedule} onClick={() => saveSchedule(item)} className="btn-primary flex flex-1 items-center justify-center gap-2 py-2.5 text-sm">{savingSchedule ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save schedule</button><button type="button" onClick={() => setEditingId(null)} className="btn-secondary flex items-center justify-center gap-2 py-2.5 text-sm"><X size={15} /> Cancel</button></div></div> : <div className="mt-4 rounded-xl bg-cream p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="flex items-start gap-2 font-semibold text-ink"><CalendarDays size={17} className="mt-0.5 shrink-0 text-teal-600" />{new Date(`${item.preferred_date}T${item.preferred_time}`).toLocaleString('en-PH', { dateStyle: 'full', timeStyle: 'short' })}</p><button type="button" onClick={() => startReschedule(item)} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-teal-100 bg-surface px-3 py-2 text-xs font-bold text-teal-700"><Clock3 size={14} /> Change date</button></div></div>}
        <div className="mt-4 space-y-2 text-sm text-ink/60"><a href={`mailto:${item.email}`} className="flex items-center gap-2 hover:text-teal-700"><Mail size={15} />{item.email}</a><a href={`tel:${item.phone}`} className="flex items-center gap-2 hover:text-teal-700"><Phone size={15} />{item.phone}</a>{item.notes && <p className="rounded-xl border border-black/5 p-3 text-xs leading-5">{item.notes}</p>}</div>
        <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-ink/40">Status<select value={item.status} onChange={(event) => updateStatus(item.id, event.target.value)} className="input-field mt-1.5 py-2.5 text-sm"><option value="pending">Pending</option><option value="contacted">Contacted</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option></select></label>
      </article>)}</div>}
    </div>
  )
}
