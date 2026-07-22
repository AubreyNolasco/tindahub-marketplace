import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

const times = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']
const emptyForm = { full_name: '', email: '', phone: '', interested_role: 'merchant', preferred_date: '', preferred_time: '', notes: '' }
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export default function RegistrationCalendar() {
  const today = useMemo(() => { const value = new Date(); value.setHours(0, 0, 0, 0); return value }, [])
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const selectedDate = form.preferred_date ? new Date(`${form.preferred_date}T00:00:00`) : null

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const last = new Date(month.getFullYear(), month.getMonth() + 1, 0)
    return [
      ...Array.from({ length: first.getDay() }, () => null),
      ...Array.from({ length: last.getDate() }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))
    ]
  }, [month])

  const previousDisabled = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth()
  const chooseDate = (date) => {
    if (!date || date < today) return
    setForm((current) => ({ ...current, preferred_date: dateKey(date), preferred_time: '' }))
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!form.preferred_date || !form.preferred_time) return toast.error('Choose a date and time first.')
    setSaving(true)
    const { error } = await supabase.from('registration_appointments').insert({
      ...form,
      full_name: form.full_name.trim(), email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(), notes: form.notes.trim()
    })
    setSaving(false)
    if (error) {
      toast.error(error.message.includes('registration_appointments') ? 'Registration calendar is not yet enabled. Please contact JOM HUB.' : error.message)
      return
    }
    setSubmitted(true)
    setForm(emptyForm)
  }

  return <section id="registration-calendar" className="border-y border-black/5 bg-white py-14 sm:py-20">
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="mx-auto max-w-2xl text-center"><span className="inline-flex items-center gap-2 rounded-full bg-mango-100 px-3 py-1.5 text-xs font-bold text-mango-700"><CalendarDays size={14} /> Registration calendar</span><h2 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">Pick a date. Register in minutes.</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-ink/60 sm:text-base">Choose your preferred date below, select an available time, then leave your contact details for Admin confirmation.</p></div>

      <div className="mx-auto mt-8 max-w-5xl overflow-hidden rounded-3xl border border-black/[0.06] bg-cream shadow-xl shadow-teal-900/[0.06] lg:grid lg:grid-cols-[1fr_0.9fr]">
        <div className="bg-white p-4 sm:p-7">
          <div className="flex items-center justify-between"><button type="button" disabled={previousDisabled} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 text-ink/55 hover:bg-teal-50 disabled:opacity-25" aria-label="Previous month"><ChevronLeft size={20} /></button><div className="text-center"><p className="font-display text-lg font-bold text-ink">{month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</p><p className="text-[11px] text-ink/40">Select an available date</p></div><button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 text-ink/55 hover:bg-teal-50" aria-label="Next month"><ChevronRight size={20} /></button></div>
          <div className="mt-5 grid grid-cols-7 gap-1 text-center">{weekdays.map((day) => <span key={day} className="py-2 text-[10px] font-bold uppercase text-ink/35 sm:text-xs">{day}</span>)}{days.map((date, index) => {
            if (!date) return <span key={`empty-${index}`} />
            const key = dateKey(date); const disabled = date < today; const selected = form.preferred_date === key; const current = key === dateKey(today)
            return <button key={key} type="button" disabled={disabled} onClick={() => chooseDate(date)} className={`relative aspect-square min-h-10 rounded-xl text-sm font-bold transition sm:min-h-12 ${selected ? 'bg-teal-700 text-white shadow-md' : disabled ? 'cursor-not-allowed text-ink/20' : 'bg-cream text-ink/70 hover:bg-teal-50 hover:text-teal-700'} ${current && !selected ? 'ring-2 ring-mango-400' : ''}`}><span>{date.getDate()}</span>{!disabled && <span className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${selected ? 'bg-mango-300' : 'bg-teal-500'}`} />}</button>
          })}</div>
          <div className="mt-5 flex items-center justify-center gap-5 border-t border-black/5 pt-4 text-[11px] text-ink/45"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-teal-600" /> Available</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-mango-400" /> Today</span></div>
        </div>

        <div className="p-4 sm:p-7">
          {submitted ? <div className="flex h-full min-h-80 flex-col items-center justify-center text-center"><span className="grid h-16 w-16 place-items-center rounded-full bg-teal-100 text-teal-700"><CheckCircle2 size={30} /></span><h3 className="mt-5 font-display text-2xl font-bold text-ink">Registration received!</h3><p className="mt-2 max-w-sm text-sm leading-6 text-ink/60">Admin will review your preferred schedule and contact you.</p><button onClick={() => setSubmitted(false)} className="btn-secondary mt-6">Register another schedule</button></div> : !selectedDate ? <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-teal-100 bg-teal-50/40 p-8 text-center"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-teal-700 shadow-sm"><CalendarDays size={25} /></span><h3 className="mt-4 font-display text-xl font-bold text-ink">Choose your date</h3><p className="mt-2 max-w-xs text-sm leading-6 text-ink/50">Tap any available date on the calendar. The registration form will appear here.</p></div> : <form onSubmit={submit} className="space-y-3"><div className="rounded-xl bg-teal-700 p-3 text-white"><p className="text-[10px] font-bold uppercase tracking-wider text-white/55">Selected schedule</p><p className="mt-1 font-display font-bold">{selectedDate.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p></div><fieldset><legend className="flex items-center gap-2 text-xs font-bold text-ink/60"><Clock3 size={15} /> Choose a time</legend><div className="mt-2 grid grid-cols-3 gap-1.5">{times.map((time) => <label key={time} className={`cursor-pointer rounded-lg border px-1 py-2 text-center text-[11px] font-bold transition ${form.preferred_time === time ? 'border-teal-600 bg-teal-600 text-white' : 'border-black/10 bg-white text-ink/60 hover:border-teal-300'}`}><input required type="radio" name="preferred_time" value={time} checked={form.preferred_time === time} onChange={update('preferred_time')} className="sr-only" />{new Date(`2000-01-01T${time}`).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</label>)}</div></fieldset><div className="grid gap-2 sm:grid-cols-2"><input required maxLength="120" value={form.full_name} onChange={update('full_name')} className="input-field py-2.5" placeholder="Full name" /><input required maxLength="30" value={form.phone} onChange={update('phone')} className="input-field py-2.5" placeholder="Phone number" /></div><input required type="email" maxLength="254" value={form.email} onChange={update('email')} className="input-field py-2.5" placeholder="Email address" /><select value={form.interested_role} onChange={update('interested_role')} className="input-field py-2.5"><option value="merchant">Register as Merchant</option><option value="reseller">Register as Reseller</option><option value="not_sure">Not sure yet</option></select><textarea maxLength="1000" rows="2" value={form.notes} onChange={update('notes')} className="input-field resize-none py-2.5" placeholder="Message (optional)" /><button disabled={saving} className="btn-primary flex w-full items-center justify-center gap-2">{saving ? 'Submitting...' : <><Send size={16} /> Register this schedule</>}</button></form>}
        </div>
      </div>
    </div>
  </section>
}
