import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Megaphone, PackageCheck, ShoppingBag, WalletCards, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso } from '../../utils/format'

const LOW_BALANCE_LIMIT = 500

const notificationKey = (userId, notification) =>
  `rmhub-notification:${userId}:${notification.type}:${notification.id || 'current'}`

export default function RoleNotifications() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const [queue, setQueue] = useState([])
  const queuedKeys = useRef(new Set())

  const enqueue = useCallback((notification, force = false) => {
    if (!user) return
    const key = notificationKey(user.id, notification)
    if (queuedKeys.current.has(key) || (!force && sessionStorage.getItem(key))) return
    queuedKeys.current.add(key)
    setQueue((current) => [...current, { ...notification, key }])
  }, [user])

  const dismiss = () => {
    const current = queue[0]
    if (!current) return
    sessionStorage.setItem(current.key, 'dismissed')
    queuedKeys.current.delete(current.key)
    setQueue((items) => items.slice(1))
  }

  const act = () => {
    const current = queue[0]
    if (!current) return
    dismiss()
    navigate(current.to)
  }

  useEffect(() => {
    if (!user || !['merchant', 'reseller'].includes(role)) return
    let active = true

    const loadNotifications = async () => {
      // Best effort: databases with the calendar-campaign migration generate
      // this month's and upcoming campaigns before notifications are loaded.
      await supabase.rpc('ensure_recurring_campaigns')
      const now = new Date()
      const nowIso = now.toISOString()
      const awarenessUntil = new Date(now.getTime() + 7 * 86400000).toISOString()
      if (role === 'merchant') {
        const [{ data: orders }, { data: campaigns }] = await Promise.all([
          supabase.from('orders').select('id, order_number, status').eq('merchant_id', user.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
          supabase.from('campaigns').select('id, name, discount_percent, starts_at, ends_at').eq('is_active', true).lte('starts_at', awarenessUntil).gte('ends_at', nowIso).order('starts_at').limit(5)
        ])
        if (!active) return
        orders?.forEach((order) => enqueue({ type: 'new-order', id: order.id, title: 'May bago kang order!', message: `Order ${order.order_number} ay naghihintay ng review mo.`, to: '/merchant/orders', action: 'Tingnan ang order', icon: ShoppingBag, tone: 'teal' }))
        campaigns?.forEach((campaign) => enqueue({ type: 'campaign', id: campaign.id, title: 'Puwede kang sumali sa campaign!', message: `${campaign.name} — ${Number(campaign.discount_percent)}% discount. Join para awtomatikong ma-discount ang products mo habang live ang campaign.`, to: '/merchant/campaigns', action: 'Sumali sa campaign', icon: Megaphone, tone: 'mango' }))
      } else {
        const [{ data: orders }, { data: wallet }, { data: campaigns }] = await Promise.all([
          supabase.from('orders').select('id, order_number, status').eq('reseller_id', user.id).eq('status', 'shipped').order('updated_at', { ascending: false }).limit(5),
          supabase.from('wallets').select('id, balance').eq('owner_id', user.id).maybeSingle(),
          supabase.from('campaigns').select('id, name, discount_percent, starts_at, ends_at').eq('is_active', true).lte('starts_at', awarenessUntil).gte('ends_at', nowIso).order('starts_at').limit(5)
        ])
        if (!active) return
        orders?.forEach((order) => enqueue({ type: 'delivery', id: order.id, title: 'Delivered na ang item mo!', message: `Order ${order.order_number} ay na-deliver na. Paki-confirm muna na natanggap mo ang item para makumpleto ang order.`, to: '/reseller/orders', action: 'I-confirm ang natanggap', icon: PackageCheck, tone: 'teal' }))
        if (wallet && Number(wallet.balance) <= LOW_BALANCE_LIMIT) enqueue({ type: 'low-wallet', id: wallet.id, title: 'Mababa na ang wallet balance mo', message: `${peso(wallet.balance)} na lang ang balance mo. Mag-top up para hindi maantala ang susunod mong order.`, to: '/reseller/wallet', action: 'Mag-top up', icon: WalletCards, tone: 'coral' })
        campaigns?.forEach((campaign) => {
          const upcoming = new Date(campaign.starts_at) > now
          const schedule = upcoming ? `Magsisimula sa ${new Date(campaign.starts_at).toLocaleDateString('en-PH')}.` : 'Live na ngayon!'
          enqueue({ type: 'reseller-campaign', id: campaign.id, title: `${campaign.name}: ${Number(campaign.discount_percent)}% OFF`, message: `${schedule} Abangan ang discounted products ng mga participating merchant.`, to: '/catalog', action: 'Tingnan ang discounted products', icon: Megaphone, tone: 'mango' })
        })
      }
    }

    loadNotifications()

    const channel = supabase.channel(`role-notifications-${user.id}`)
    if (role === 'merchant') {
      channel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `merchant_id=eq.${user.id}` }, ({ new: order }) => {
          enqueue({ type: 'new-order', id: order.id, title: 'May bago kang order!', message: `Order ${order.order_number} ay naghihintay ng review mo.`, to: '/merchant/orders', action: 'Tingnan ang order', icon: ShoppingBag, tone: 'teal' }, true)
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaigns' }, ({ new: campaign }) => {
          if (!campaign.is_active) return
          enqueue({ type: 'campaign', id: campaign.id, title: 'May bagong campaign!', message: `${campaign.name} — ${Number(campaign.discount_percent)}% discount. Tingnan ito at sumali para mapalago ang sales.`, to: '/merchant/campaigns', action: 'Tingnan ang campaign', icon: Megaphone, tone: 'mango' }, true)
        })
    } else {
      channel
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `reseller_id=eq.${user.id}` }, ({ new: order, old }) => {
          if (order.status !== 'shipped' || old.status === 'shipped') return
          enqueue({ type: 'delivery', id: order.id, title: 'Delivered na ang item mo!', message: `Order ${order.order_number} ay na-deliver na. Paki-confirm muna na natanggap mo ang item para makumpleto ang order.`, to: '/reseller/orders', action: 'I-confirm ang natanggap', icon: PackageCheck, tone: 'teal' }, true)
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `owner_id=eq.${user.id}` }, ({ new: wallet, old }) => {
          if (Number(wallet.balance) > LOW_BALANCE_LIMIT || Number(old.balance) <= LOW_BALANCE_LIMIT) return
          enqueue({ type: 'low-wallet', id: wallet.id, title: 'Mababa na ang wallet balance mo', message: `${peso(wallet.balance)} na lang ang balance mo. Mag-top up para hindi maantala ang susunod mong order.`, to: '/reseller/wallet', action: 'Mag-top up', icon: WalletCards, tone: 'coral' }, true)
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaigns' }, ({ new: campaign }) => {
          if (!campaign.is_active) return
          enqueue({ type: 'reseller-campaign', id: campaign.id, title: `${campaign.name}: ${Number(campaign.discount_percent)}% OFF`, message: 'May bagong marketplace campaign! Abangan ang discounted products ng mga participating merchant.', to: '/catalog', action: 'Tingnan ang campaign products', icon: Megaphone, tone: 'mango' }, true)
        })
    }
    channel.subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
      queuedKeys.current.clear()
      setQueue([])
    }
  }, [user?.id, role, enqueue])

  const notification = queue[0]
  if (!notification) return null
  const Icon = notification.icon || AlertTriangle
  const tones = {
    teal: 'bg-teal-100 text-teal-700',
    mango: 'bg-mango-100 text-mango-700',
    coral: 'bg-coral-100 text-coral-600'
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/45 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="role-notification-title">
      <div className="card relative w-full max-w-sm p-6 text-center shadow-xl">
        <button onClick={dismiss} aria-label="Isara ang notification" className="absolute right-3 top-3 rounded-lg p-1.5 text-ink/40 transition hover:bg-black/5 hover:text-ink"><X size={18} /></button>
        <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${tones[notification.tone]}`}><Icon size={27} /></div>
        <h2 id="role-notification-title" className="font-display text-xl font-bold text-ink">{notification.title}</h2>
        <p className="mt-2 text-sm leading-6 text-ink/60">{notification.message}</p>
        <button onClick={act} className="btn-primary mt-5 w-full">{notification.action}</button>
        {queue.length > 1 && <p className="mt-3 text-xs text-ink/40">May {queue.length - 1} pang notification</p>}
      </div>
    </div>
  )
}
