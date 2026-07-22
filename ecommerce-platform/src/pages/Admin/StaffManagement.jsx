import { useEffect, useState } from 'react'
import { Loader2, MailPlus, Save, ShieldCheck, UserCog, UserX } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ADMIN_PERMISSIONS } from '../../config/adminPermissions'
import Spinner from '../../components/ui/Spinner'

const emptyForm = { full_name: '', email: '', permissions: [] }

function PermissionGrid({ value, onChange, disabled }) {
  const toggle = (key) => onChange(value.includes(key) ? value.filter((item) => item !== key) : [...value, key])
  return <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{ADMIN_PERMISSIONS.map(([key, label]) => <label key={key} className={`flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold ${value.includes(key) ? 'border-teal-300 bg-teal-50 text-teal-900' : 'border-black/[0.07] bg-white text-ink/55'}`}><input type="checkbox" disabled={disabled} checked={value.includes(key)} onChange={() => toggle(key)} className="h-4 w-4 accent-teal-600" />{label}</label>)}</div>
}

export default function StaffManagement() {
  const { user } = useAuth()
  const [form, setForm] = useState(emptyForm)
  const [invitations, setInvitations] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    const [inviteResult, staffResult] = await Promise.all([
      supabase.from('staff_invitations').select('*').order('created_at', { ascending: false }),
      supabase.from('staff_access').select('*, profiles!staff_access_user_id_fkey(full_name, email)').order('created_at', { ascending: false })
    ])
    if (inviteResult.error || staffResult.error) toast.error(inviteResult.error?.message || staffResult.error?.message)
    setInvitations(inviteResult.data || [])
    setStaff(staffResult.data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const invite = async (event) => {
    event.preventDefault()
    if (!form.permissions.length) return toast.error('Select at least one staff permission.')
    setSaving(true)
    const payload = { email: form.email.trim().toLowerCase(), full_name: form.full_name.trim(), permissions: form.permissions, status: 'pending', invited_by: user.id, accepted_at: null }
    const { error } = await supabase.from('staff_invitations').upsert(payload, { onConflict: 'email' })
    setSaving(false)
    if (error) return toast.error(error.message)
    setForm(emptyForm)
    toast.success('Staff access created. Ask them to sign in using this email.')
    load()
  }

  const updateStaff = async (entry, changes) => {
    const { error } = await supabase.from('staff_access').update({ ...changes, updated_at: new Date().toISOString() }).eq('user_id', entry.user_id)
    if (error) return toast.error(error.message)
    toast.success('Staff permissions updated.')
    load()
  }

  return <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-600">Security & access</p><h1 className="mt-1 font-display text-2xl font-bold text-ink">Staff Accounts</h1><p className="mt-1 max-w-2xl text-sm leading-6 text-ink/50">Invite staff using their email and control exactly which Admin Center modules they can open.</p></div>
    <form onSubmit={invite} className="mt-6 rounded-3xl border border-black/[0.06] bg-white p-5 shadow-card sm:p-7"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-teal-700 text-white"><MailPlus size={21} /></span><div><h2 className="font-display text-lg font-bold text-ink">Create staff access</h2><p className="text-xs text-ink/45">Staff will use the regular secure email sign-in link.</p></div></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-ink/65">Full name<input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="input-field mt-1.5" /></label><label className="text-sm font-semibold text-ink/65">Staff email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-field mt-1.5" /></label></div><p className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-ink/40">Allowed modules</p><PermissionGrid value={form.permissions} onChange={(permissions) => setForm({ ...form, permissions })} /><button disabled={saving} className="btn-primary mt-5 flex items-center gap-2">{saving ? <Loader2 size={16} className="animate-spin" /> : <UserCog size={16} />} Create staff access</button></form>
    {loading ? <div className="flex justify-center py-16"><Spinner /></div> : <><section className="mt-8"><h2 className="font-display text-lg font-bold text-ink">Active staff</h2><div className="mt-3 space-y-4">{staff.length === 0 && <p className="rounded-2xl bg-white p-5 text-sm text-ink/45">No staff has accepted an invitation yet.</p>}{staff.map((entry) => <StaffCard key={entry.user_id} entry={entry} onSave={updateStaff} />)}</div></section><section className="mt-8"><h2 className="font-display text-lg font-bold text-ink">Invitations</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{invitations.map((invite) => <div key={invite.id} className="card p-4"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-ink">{invite.full_name}</p><p className="text-xs text-ink/45">{invite.email}</p></div><span className={`badge ${invite.status === 'accepted' ? 'bg-teal-100 text-teal-700' : invite.status === 'revoked' ? 'bg-coral-100 text-coral-600' : 'bg-mango-100 text-mango-700'}`}>{invite.status}</span></div></div>)}</div></section></>}
  </div>
}

function StaffCard({ entry, onSave }) {
  const [permissions, setPermissions] = useState(entry.permissions || [])
  return <article className="card p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700"><ShieldCheck size={19} /></span><div><p className="font-semibold text-ink">{entry.profiles?.full_name}</p><p className="text-xs text-ink/45">{entry.profiles?.email}</p></div></div><span className={`badge ${entry.active ? 'bg-teal-100 text-teal-700' : 'bg-coral-100 text-coral-600'}`}>{entry.active ? 'Active' : 'Disabled'}</span></div><div className="mt-4"><PermissionGrid value={permissions} onChange={setPermissions} disabled={!entry.active} /></div><div className="mt-4 flex flex-col gap-2 sm:flex-row"><button onClick={() => onSave(entry, { permissions })} disabled={!entry.active} className="btn-primary flex items-center justify-center gap-2 text-sm"><Save size={15} /> Save permissions</button><button onClick={() => onSave(entry, { active: !entry.active })} className="btn-secondary flex items-center justify-center gap-2 text-sm"><UserX size={15} />{entry.active ? 'Disable staff' : 'Enable staff'}</button></div></article>
}

