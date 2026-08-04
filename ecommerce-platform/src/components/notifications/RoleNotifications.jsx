import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, CalendarClock, LifeBuoy, PackageCheck, ShieldAlert, ShoppingBag, WalletCards, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDate, peso } from '../../utils/format'

const LOW_BALANCE_LIMIT = 500

export default function RoleNotifications() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const panelRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const seenKey = user ? `jom-hub-notifications-seen:${user.id}` : ''
  const [seen, setSeen] = useState(() => {
    try { return JSON.parse(localStorage.getItem(seenKey) || '[]') } catch { return [] }
  })

  const load = useCallback(async () => {
    if (!user || !['merchant', 'reseller'].includes(role)) return
    const items = []
    await supabase.rpc('run_operational_maintenance')
    const [{ data: wallet },{data:withdrawals}]=await Promise.all([supabase.from('wallets').select('id,balance,updated_at').eq('owner_id', user.id).maybeSingle(),supabase.from('withdrawal_requests').select('id,status,amount,scheduled_for,sent_at,updated_at').eq('owner_id',user.id).in('status',['pending','approved']).order('created_at',{ascending:false}).limit(5)])
    if (wallet) items.push({ id:`wallet:${wallet.id}:${wallet.updated_at}`, title:Number(wallet.balance) <= LOW_BALANCE_LIMIT ? 'Low wallet balance' : 'Current wallet balance', message:`Your available balance is ${peso(wallet.balance)}.`, to:`/${role}/wallet`, action:'Open wallet', icon:WalletCards, tone:Number(wallet.balance) <= LOW_BALANCE_LIMIT ? 'coral' : 'teal' })
    withdrawals?.forEach(row=>items.unshift({id:`withdrawal:${row.id}:${row.sent_at||row.updated_at}`,title:row.sent_at?'Withdrawal sent':row.status==='approved'?'Withdrawal scheduled':'Withdrawal under review',message:row.sent_at?`${peso(row.amount)} was marked Sent.`:row.scheduled_for?`${peso(row.amount)} planned for ${new Date(row.scheduled_for).toLocaleString('en-PH')}.`:`${peso(row.amount)} is waiting for Admin review.`,to:`/${role}/wallet`,action:'View withdrawal',icon:WalletCards,tone:row.sent_at?'teal':'mango'}))

    const { data: supportMessages } = await supabase.from('support_messages').select('id,message,created_at').eq('user_id',user.id).eq('is_read',false).in('sender_role',['admin','staff']).order('created_at',{ascending:false}).limit(10)
    supportMessages?.forEach(row=>items.unshift({id:`support:${row.id}`,title:'New message from Admin',message:row.message,to:`/${role}/support`,action:'Open Chat Support',icon:LifeBuoy,tone:'teal'}))

    if (role === 'merchant') {
      const [{ data: orders }, { data: subscription }] = await Promise.all([
        supabase.from('orders').select('id,order_number,status,updated_at,proposed_shipping_fee,shipping_fee_confirmation_status,shipping_fee_reseller_note,order_cases(id,case_type,status,updated_at)').eq('merchant_id', user.id).in('status', ['confirmed','processing','shipped']).order('created_at', { ascending:false }).limit(10),
        supabase.from('subscriptions').select('id,status,expires_at,updated_at').eq('owner_id', user.id).maybeSingle()
      ])
      orders?.forEach(order => items.unshift({ id:`order:${order.id}:${order.status}:${order.shipping_fee_confirmation_status||''}`, title:order.shipping_fee_confirmation_status==='accepted'?'Shipping fee accepted':order.shipping_fee_confirmation_status==='declined'?'Shipping fee declined':order.shipping_fee_confirmation_status==='pending'?'Waiting for shipping confirmation':'Order needs your attention', message:order.shipping_fee_confirmation_status==='declined'?`Order ${order.order_number}: ${order.shipping_fee_reseller_note}`:order.shipping_fee_confirmation_status==='accepted'?`Order ${order.order_number} can now be dispatched.`:`Order ${order.order_number} is ${order.status}.`, to:'/merchant/orders', action:'Review order', icon:ShoppingBag, tone:order.shipping_fee_confirmation_status==='declined'?'coral':order.shipping_fee_confirmation_status==='accepted'?'teal':'mango' }))
      orders?.flatMap(order=>(order.order_cases||[]).map(caseItem=>({order,caseItem}))).filter(({caseItem})=>['open','merchant_review','admin_review'].includes(caseItem.status)).forEach(({order,caseItem})=>items.unshift({id:`case:${caseItem.id}:${caseItem.updated_at}`,title:'Order case update',message:`${caseItem.case_type} request for ${order.order_number} is ${caseItem.status.replace('_',' ')}.`,to:'/merchant/orders',action:'Review case',icon:ShieldAlert,tone:'coral'}))
      if (subscription) {
        const days = Math.ceil((new Date(subscription.expires_at) - new Date()) / 86400000)
        items.unshift({ id:`subscription:${subscription.id}:${subscription.updated_at}`, title:days < 0 ? 'Subscription expired' : days <= 30 ? 'Subscription expiring soon' : 'Subscription active', message:days < 0 ? `Expired on ${formatDate(subscription.expires_at)}.` : `Active until ${formatDate(subscription.expires_at)}${days <= 30 ? ` (${days} days left)` : ''}.`, to:'/choose-subscription', action:'View subscription', icon:CalendarClock, tone:days <= 30 ? 'coral' : 'teal' })
      }
    } else {
      const { data: orders } = await supabase.from('orders').select('id,order_number,status,updated_at,proposed_shipping_fee,shipping_fee_confirmation_status,order_cases(id,case_type,status,updated_at)').eq('reseller_id', user.id).in('status', ['confirmed','processing','shipped']).order('updated_at', { ascending:false }).limit(10)
      orders?.forEach(order => items.unshift({ id:`order:${order.id}:${order.status}:${order.shipping_fee_confirmation_status||''}`, title:order.shipping_fee_confirmation_status==='pending'?'Confirm shipping fee':order.status === 'shipped' ? 'Order shipped—confirm after receipt' : 'Order status updated', message:order.shipping_fee_confirmation_status==='pending'?`Review the ${peso(order.proposed_shipping_fee)} shipping fee for ${order.order_number}.`:`Order ${order.order_number} is now ${order.status}.`, to:'/reseller/orders', action:order.shipping_fee_confirmation_status==='pending'?'Review fee':'Track order', icon:PackageCheck, tone:order.shipping_fee_confirmation_status==='pending'||order.status==='shipped'?'mango':'teal' }))
      orders?.flatMap(order=>(order.order_cases||[]).map(caseItem=>({order,caseItem}))).filter(({caseItem})=>['open','merchant_review','admin_review'].includes(caseItem.status)).forEach(({order,caseItem})=>items.unshift({id:`case:${caseItem.id}:${caseItem.updated_at}`,title:'Order case update',message:`${caseItem.case_type} request for ${order.order_number} is ${caseItem.status.replace('_',' ')}.`,to:'/reseller/orders',action:'View case',icon:ShieldAlert,tone:'coral'}))
    }
    setNotifications(items)
  }, [user, role])

  useEffect(() => {
    load()
    if (!user) return
    const channel = supabase.channel(`header-notifications-${user.id}`)
      .on('postgres_changes', { event:'*', schema:'public', table:'orders' }, load)
      .on('postgres_changes', { event:'*', schema:'public', table:'wallets', filter:`owner_id=eq.${user.id}` }, load)
      .on('postgres_changes',{event:'*',schema:'public',table:'withdrawal_requests',filter:`owner_id=eq.${user.id}`},load)
      .on('postgres_changes',{event:'*',schema:'public',table:'order_cases'},load)
      .on('postgres_changes',{event:'*',schema:'public',table:'support_messages',filter:`user_id=eq.${user.id}`},load)
    if (role === 'merchant') channel.on('postgres_changes', { event:'*', schema:'public', table:'subscriptions', filter:`owner_id=eq.${user.id}` }, load)
    channel.subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, role, load])

  useEffect(() => {
    const close = event => { if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const unread = notifications.filter(item => !seen.includes(item.id)).length
  const toggle = () => {
    setOpen(value => !value)
  }
  const act = item => { const ids=[...new Set([...seen,item.id])].slice(-100);setSeen(ids);try{localStorage.setItem(seenKey,JSON.stringify(ids))}catch{/* restricted storage */}setOpen(false);navigate(item.to) }

  return <div className="relative" ref={panelRef} data-guide-notifications>
    <button type="button" onClick={toggle} className="relative grid h-10 w-10 place-items-center rounded-xl border border-black/[.06] bg-surface text-teal-700 shadow-sm transition hover:bg-teal-50" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
      <Bell size={19}/>{unread > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-coral-500 px-1 text-[10px] font-bold text-white">{Math.min(unread, 9)}{unread > 9 ? '+' : ''}</span>}
    </button>
    {open && <div className="fixed inset-x-3 top-[7.6rem] z-[80] max-h-[70vh] overflow-hidden rounded-2xl border border-black/[.08] bg-surface shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[24rem]">
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-3"><div><p className="font-display font-bold text-ink">{role === 'merchant' ? 'Merchant' : 'Reseller'} notifications</p><p className="text-[11px] text-ink/45">Orders, wallet{role === 'merchant' ? ', and subscription' : ''}</p></div><button onClick={()=>setOpen(false)} className="rounded-lg p-1.5 text-ink/40 hover:bg-surface-inset" aria-label="Close notifications"><X size={17}/></button></div>
      <div className="max-h-[55vh] overflow-y-auto p-2">{notifications.length ? notifications.map(item => { const Icon=item.icon; return <button key={item.id} onClick={()=>act(item)} className="flex w-full gap-3 rounded-xl p-3 text-left transition hover:bg-surface-inset"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.tone === 'coral' ? 'bg-coral-100 text-coral-600' : item.tone === 'mango' ? 'bg-mango-100 text-mango-700' : 'bg-teal-50 text-teal-700'}`}><Icon size={18}/></span><span className="min-w-0"><span className="block text-sm font-bold text-ink">{item.title}</span><span className="mt-0.5 block text-xs leading-5 text-ink/55">{item.message}</span><span className="mt-1 block text-[11px] font-bold text-teal-700">{item.action}</span></span></button> }) : <p className="px-4 py-10 text-center text-sm text-ink/45">No notifications right now.</p>}</div>
    </div>}
  </div>
}
