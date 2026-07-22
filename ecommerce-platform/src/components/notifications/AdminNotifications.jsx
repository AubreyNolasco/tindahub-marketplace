import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, CalendarDays, CircleDollarSign, CreditCard, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { canAccessAdmin } from '../../config/adminPermissions'
import { peso } from '../../utils/format'

export default function AdminNotifications() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const panelRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const seenKey = user ? `jom-hub-admin-notifications-seen:${user.id}` : ''
  const [seen, setSeen] = useState(() => { try { return JSON.parse(localStorage.getItem(seenKey) || '[]') } catch { return [] } })
  const allowed = useCallback(permission => profile?.role === 'admin' || canAccessAdmin(profile, permission), [profile])

  const load = useCallback(async () => {
    if (!user || !['admin', 'staff'].includes(profile?.role)) return
    const requests = []
    if (allowed('subscriptions')) requests.push(supabase.from('subscription_requests').select('id,amount,plan_months,reference_number,created_at').eq('status','pending').order('created_at',{ascending:false}).limit(20).then(({data}) => (data || []).map(row => ({ id:`subscription:${row.id}`, title:'New subscription payment', message:`${row.plan_months}-month plan · ${peso(row.amount)} · Ref ${row.reference_number || 'not provided'}`, to:'/admin/subscriptions', icon:CreditCard, tone:'teal', created_at:row.created_at }))))
    if (allowed('topups')) requests.push(supabase.from('topup_requests').select('id,amount,reference_number,created_at').eq('status','pending').order('created_at',{ascending:false}).limit(20).then(({data}) => (data || []).map(row => ({ id:`topup:${row.id}`, title:'New wallet top-up', message:`${peso(row.amount)} · Ref ${row.reference_number || 'not provided'}`, to:'/admin/topups', icon:CircleDollarSign, tone:'mango', created_at:row.created_at }))))
    if (allowed('registrations')) requests.push(supabase.from('registration_appointments').select('id,full_name,interested_role,preferred_date,preferred_time,created_at').eq('status','pending').order('created_at',{ascending:false}).limit(20).then(({data}) => (data || []).map(row => ({ id:`registration:${row.id}`, title:'New onboarding schedule', message:`${row.full_name} · ${row.interested_role} · ${new Date(`${row.preferred_date}T${row.preferred_time}`).toLocaleString('en-PH',{dateStyle:'medium',timeStyle:'short'})}`, to:'/admin/registrations', icon:CalendarDays, tone:'coral', created_at:row.created_at }))))
    const groups = await Promise.all(requests)
    setItems(groups.flat().sort((a,b) => new Date(b.created_at) - new Date(a.created_at)))
  }, [user?.id, profile, allowed])

  useEffect(() => {
    load()
    if (!user) return
    const channel = supabase.channel(`admin-header-notifications-${user.id}`)
    if (allowed('subscriptions')) channel.on('postgres_changes',{event:'*',schema:'public',table:'subscription_requests'},load)
    if (allowed('topups')) channel.on('postgres_changes',{event:'*',schema:'public',table:'topup_requests'},load)
    if (allowed('registrations')) channel.on('postgres_changes',{event:'*',schema:'public',table:'registration_appointments'},load)
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, allowed, load])

  useEffect(() => {
    const close = event => { if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const unread = items.filter(item => !seen.includes(item.id)).length
  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) {
      const ids = items.map(item => item.id)
      setSeen(ids)
      try { localStorage.setItem(seenKey, JSON.stringify(ids.slice(0,100))) } catch { /* restricted storage */ }
    }
  }
  const act = item => { setOpen(false); navigate(item.to) }

  return <div className="relative" ref={panelRef} data-guide-notifications>
    <button type="button" onClick={toggle} className="relative grid h-10 w-10 place-items-center rounded-xl border border-black/[.06] bg-white text-teal-700 shadow-sm transition hover:bg-teal-50" aria-label={`Admin notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}><Bell size={19}/>{unread > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white">{Math.min(unread,9)}{unread > 9 ? '+' : ''}</span>}</button>
    {open && <div className="fixed inset-x-3 top-[7.6rem] z-[80] max-h-[70vh] overflow-hidden rounded-2xl border border-black/[.08] bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[25rem]"><div className="flex items-center justify-between border-b border-black/5 px-4 py-3"><div><p className="font-display font-bold text-ink">Admin notifications</p><p className="text-[11px] text-ink/45">Subscriptions, top-ups, and onboarding schedules</p></div><button onClick={()=>setOpen(false)} className="rounded-lg p-1.5 text-ink/40 hover:bg-cream" aria-label="Close notifications"><X size={17}/></button></div><div className="max-h-[55vh] overflow-y-auto p-2">{items.length ? items.map(item => { const Icon=item.icon; return <button key={item.id} onClick={()=>act(item)} className="flex w-full gap-3 rounded-xl p-3 text-left transition hover:bg-cream"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.tone === 'mango' ? 'bg-mango-100 text-mango-700' : item.tone === 'coral' ? 'bg-coral-100 text-coral-600' : 'bg-teal-50 text-teal-700'}`}><Icon size={18}/></span><span className="min-w-0"><span className="block text-sm font-bold text-ink">{item.title}</span><span className="mt-0.5 block text-xs leading-5 text-ink/55">{item.message}</span><span className="mt-1 block text-[11px] font-bold text-teal-700">Review request</span></span></button> }) : <p className="px-4 py-10 text-center text-sm text-ink/45">No pending requests right now.</p>}</div></div>}
  </div>
}
