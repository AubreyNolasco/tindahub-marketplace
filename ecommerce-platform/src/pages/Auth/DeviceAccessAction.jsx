import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, ShieldX } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function DeviceAccessAction() {
  const [params] = useSearchParams()
  const action = params.get('action')
  const token = params.get('token')
  const [status, setStatus] = useState('confirm')

  useEffect(() => {
    if (!['approve', 'block'].includes(action) || !/^[a-f0-9]{64}$/.test(token || '')) setStatus('expired')
  }, [action, token])

  const confirm = async () => {
    setStatus('loading')
    const { data, error } = await supabase.rpc('resolve_device_access', { p_action: action, p_token: token })
    setStatus(error ? 'expired' : data?.status || 'expired')
  }

  const complete = ['approved', 'blocked'].includes(status)
  return (
    <div className="grid min-h-[70vh] place-items-center p-4">
      <section className="card w-full max-w-md p-7 text-center">
        {status === 'loading'
          ? <Loader2 className="mx-auto animate-spin text-teal-600" />
          : complete && status === 'approved'
            ? <CheckCircle2 className="mx-auto text-teal-600" size={42} />
            : <ShieldX className={`mx-auto ${status === 'blocked' ? 'text-coral-600' : 'text-ink/40'}`} size={42} />}
        <h1 className="mt-4 font-display text-2xl font-bold">
          {status === 'confirm'
            ? action === 'approve' ? 'Logout the old gadget?' : 'Block the new gadget?'
            : status === 'approved' ? 'Old gadget logged out'
              : status === 'blocked' ? 'New gadget blocked'
                : status === 'loading' ? 'Applying your choice'
                  : 'Link expired'}
        </h1>
        <p className="mt-2 text-sm text-ink/55">
          {status === 'confirm'
            ? 'Confirm below. Opening this email link did not perform the action automatically.'
            : status === 'approved' ? 'The approved gadget can now use the account.'
              : status === 'blocked' ? 'Your current gadget remains active.'
                : status === 'expired' ? 'This security link is invalid or older than 20 minutes.'
                  : 'Please wait.'}
        </p>
        {status === 'confirm'
          ? <button onClick={confirm} className={`mt-6 ${action === 'approve' ? 'btn-primary' : 'btn-secondary text-coral-600'}`}>Confirm {action === 'approve' ? 'logout' : 'block'}</button>
          : <Link to="/login" className="btn-primary mt-6 inline-flex">Return to JOM HUB</Link>}
      </section>
    </div>
  )
}
