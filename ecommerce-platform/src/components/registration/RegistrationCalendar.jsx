import { useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock3, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

const times = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']
const emptyForm = { full_name: '', email: '', phone: '', interested_role: 'merchant', preferred_date: '', preferred_time: '', notes: '' }

export default function RegistrationCalendar() {
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const minDate = useMemo(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10), [])
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('registration_appointments').insert({
      ...form,
      full_name: form.full_name.trim(), email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(), notes: form.notes.trim()
    })
    setSaving(false)
    if (error) {
      toast.error(error.message.includes('registration_appointments') ? 'Registration calendar is not yet enabled. Please contact RM Hub.' : error.message)
      return
    }
    setSubmitted(true)
    setForm(emptyForm)
  }

  return <section id="registration-calendar" className="border-y border-black/5 bg-white py-16 sm:py-20">
    <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
      <div><span className="inline-flex items-center gap-2 rounded-full bg-mango-100 px-3 py-1.5 text-xs font-bold text-mango-700"><CalendarDays size={14} /> Registration calendar</span><h2 className="mt-4 font-display text-3xl font-bold text-ink sm:text-4xl">Choose when you’re available.</h2><p className="mt-4 max-w-xl leading-7 text-ink/60">Interested in joining RM Hub? Pick your preferred schedule and our admin team will review your registration and contact you.</p><div className="mt-6 space-y-3 text-sm text-ink/60"><p className="flex items-center gap-3"><CheckCircle2 size={18} className="text-teal-600" /> Select a future date and available time.</p><p className="flex items-center gap-3"><CheckCircle2 size={18} className="text-teal-600" /> Tell us whether you’re joining as Merchant or Reseller.</p><p className="flex items-center gap-3"><CheckCircle2 size={18} className="text-teal-600" /> Admin can confirm your schedule from the dashboard.</p></div></div>
      <div className="rounded-3xl border border-black/[0.06] bg-cream p-5 shadow-xl shadow-teal-900/[0.06] sm:p-7">
        {submitted ? <div className="py-10 text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-teal-100 text-teal-700"><CheckCircle2 size={30} /></span><h3 className="mt-5 font-display text-2xl font-bold text-ink">Registration received!</h3><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-ink/60">Thank you. The RM Hub admin can now see your preferred schedule and will contact you.</p><button onClick={() => setSubmitted(false)} className="btn-secondary mt-6">Submit another schedule</button></div> : <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-ink/70">Full name<input required maxLength="120" value={form.full_name} onChange={update('full_name')} className="input-field mt-1.5" placeholder="Juan Dela Cruz" /></label><label className="text-sm font-semibold text-ink/70">Phone number<input required maxLength="30" value={form.phone} onChange={update('phone')} className="input-field mt-1.5" placeholder="09xx xxx xxxx" /></label><label className="text-sm font-semibold text-ink/70 sm:col-span-2">Email address<input required type="email" maxLength="254" value={form.email} onChange={update('email')} className="input-field mt-1.5" placeholder="you@example.com" /></label><label className="text-sm font-semibold text-ink/70">Interested as<select value={form.interested_role} onChange={update('interested_role')} className="input-field mt-1.5"><option value="merchant">Merchant</option><option value="reseller">Reseller</option><option value="not_sure">Not sure yet</option></select></label><label className="text-sm font-semibold text-ink/70">Preferred date<input required type="date" min={minDate} value={form.preferred_date} onChange={update('preferred_date')} className="input-field mt-1.5" /></label><fieldset className="sm:col-span-2"><legend className="flex items-center gap-2 text-sm font-semibold text-ink/70"><Clock3 size={16} /> Preferred time</legend><div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">{times.map((time) => <label key={time} className={`cursor-pointer rounded-xl border px-2 py-2.5 text-center text-xs font-bold transition ${form.preferred_time === time ? 'border-teal-600 bg-teal-600 text-white' : 'border-black/10 bg-white text-ink/60 hover:border-teal-300'}`}><input required type="radio" name="preferred_time" value={time} checked={form.preferred_time === time} onChange={update('preferred_time')} className="sr-only" />{new Date(`2000-01-01T${time}`).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</label>)}</div></fieldset><label className="text-sm font-semibold text-ink/70 sm:col-span-2">Message or questions <span className="font-normal text-ink/40">(optional)</span><textarea maxLength="1000" rows="3" value={form.notes} onChange={update('notes')} className="input-field mt-1.5 resize-none" placeholder="Tell us what you want to discuss..." /></label><button disabled={saving} className="btn-primary flex items-center justify-center gap-2 sm:col-span-2">{saving ? 'Submitting...' : <><Send size={16} /> Register my schedule</>}</button></form>}
      </div>
    </div>
  </section>
}
