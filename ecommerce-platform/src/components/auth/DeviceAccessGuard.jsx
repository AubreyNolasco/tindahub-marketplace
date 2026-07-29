import { useCallback, useEffect, useMemo, useState } from 'react'
import { Laptop, Loader2, ShieldAlert, Smartphone } from 'lucide-react'
import toast from 'react-hot-toast'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { getDeviceId, getDeviceLabel } from '../../utils/deviceAccess'

export default function DeviceAccessGuard() {
  const { user, signOutLocal, setDeviceAccessStatus } = useAuth()
  const { pathname } = useLocation()
  const id = useMemo(getDeviceId, [])
  const [state, setState] = useState(user ? { status: 'checking' } : null)

  const check = useCallback(async () => {
    if (!user) {
      setDeviceAccessStatus('signed_out')
      return setState(null)
    }
    const { data, error } = await supabase.rpc('get_device_access', { p_device_id: id })
    if (error || !data) {
      setDeviceAccessStatus('error')
      return setState({ status: 'error' })
    }
    setState(data)
    setDeviceAccessStatus(data.status)
    if (['replaced', 'blocked'].includes(data.status)) {
      await signOutLocal()
      toast.error(data.status === 'blocked' ? 'This gadget was blocked.' : 'Your account is now active on another gadget.')
    }
  }, [id, setDeviceAccessStatus, signOutLocal, user])

  useEffect(() => {
    if (!user) {
      setState(null)
      setDeviceAccessStatus('signed_out')
      return undefined
    }
    let cancelled = false
    setState({ status: 'checking' })
    setDeviceAccessStatus('checking')
    const start = async () => {
      const { data, error } = await supabase.rpc('request_device_access', {
        p_device_id: id,
        p_device_label: getDeviceLabel()
      })
      if (cancelled) return
      if (error || !data) {
        setDeviceAccessStatus('error')
        return setState({ status: 'error' })
      }
      setState(data)
      setDeviceAccessStatus(data.status)
      if (data.status === 'notify') {
        const { error: mailError } = await supabase.functions.invoke('device-access-email', {
          body: { token: data.token, deviceLabel: getDeviceLabel() }
        })
        if (mailError) toast.error('Device email could not be sent. You can still approve it on the active gadget.')
        else toast.success('Security request sent to your Gmail.')
        setState({ status: 'pending', active_label: data.active_label })
        setDeviceAccessStatus('pending')
      }
    }
    start()
    const timer = setInterval(check, 4000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [check, id, setDeviceAccessStatus, user])

  const resolve = async (action) => {
    const { data, error } = await supabase.rpc('resolve_my_device_request', {
      p_device_id: id,
      p_action: action
    })
    if (error) return toast.error('Unable to apply the device decision.')
    if (data?.status === 'approved') await signOutLocal()
    else if (data?.status === 'blocked') {
      toast.success('New gadget blocked.')
      check()
    }
  }

  if (!user || pathname === '/device-access' || (state?.status === 'active' && !state.pending_label)) return null
  const activePrompt = state?.status === 'active' && state.pending_label
  const error = state?.status === 'error'
  const limited = state?.status === 'rate_limited'
  const checking = !state || state.status === 'checking'

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-scrim/70 p-4 backdrop-blur-sm">
      <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700">
          {activePrompt || error || limited ? <ShieldAlert /> : <Loader2 className="animate-spin" />}
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold">
          {activePrompt ? 'New gadget wants access' : error ? 'Unable to verify this gadget' : limited ? 'Recent request already pending' : checking ? 'Checking this gadget' : 'Waiting for device approval'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink/60">
          {activePrompt
            ? <><b>{state.pending_label}</b> is requesting this account. Choose what should happen.</>
            : error
              ? 'Access remains locked until the security check succeeds. Check your connection and retry.'
              : limited
                ? 'For your protection, wait two minutes before submitting another gadget request.'
                : checking
                  ? 'Verifying this gadget against your account security settings...'
                  : <>This account is currently open on <b>{state?.active_label}</b>. Check your Gmail or respond on the active gadget.</>}
        </p>
        {activePrompt ? (
          <div className="mt-6 grid gap-3">
            <button onClick={() => resolve('approve')} className="btn-primary flex items-center justify-center gap-2"><Laptop size={17} /> Logout this old gadget</button>
            <button onClick={() => resolve('block')} className="btn-secondary flex items-center justify-center gap-2 text-coral-600"><Smartphone size={17} /> Block new gadget</button>
          </div>
        ) : (
          <button onClick={check} className="btn-secondary mt-6 w-full">{error ? 'Retry security check' : 'Check approval status'}</button>
        )}
      </section>
    </div>
  )
}
