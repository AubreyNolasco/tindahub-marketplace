import { useEffect, useState } from 'react'
import { ShieldCheck, UserRound, Store, RefreshCw, Loader2, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

export default function TestAccounts() {
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState([])

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, account_status, created_at')
      .in('email', ['reseller@gmail.com', 'merchant@gmail.com'])
    if (error) toast.error(error.message)
    setProfiles(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const testAccounts = [
    { email: 'merchant@gmail.com', role: 'Merchant', icon: Store, color: 'bg-teal-100 text-teal-700' },
    { email: 'reseller@gmail.com', role: 'Reseller', icon: UserRound, color: 'bg-mango-100 text-mango-700' }
  ]

  const copyCredentials = (email) => {
    navigator.clipboard.writeText(email)
    toast.success(`Copied: ${email}`)
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Test Accounts</h1>
        <p className="mt-1 text-sm text-ink/50">Reference-only status for the legacy demo accounts.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-teal-600" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex flex-col gap-4 bg-gradient-to-r from-teal-950 to-teal-700 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-teal-500/30"><ShieldCheck size={28} className="text-mango-300" /></span>
              <div>
                <p className="font-display text-xl font-bold">Permanently Disabled</p>
                <p className="mt-1 text-sm text-white/65">Both accounts are banned at the Supabase Auth level and cannot sign in. There is no way to re-enable them from this app.</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-ink">Account Status</h2>
              <button onClick={load} className="btn-secondary p-2"><RefreshCw size={16} /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {testAccounts.map(({ email, role, icon: Icon, color }) => {
                const profile = profiles.find((p) => p.email === email)
                return (
                  <div key={email} className="rounded-2xl border border-black/5 bg-cream/50 p-5">
                    <div className="flex items-center gap-3">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${color}`}><Icon size={20} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-ink">{role} Test Account</p>
                        <p className="text-xs text-ink/50">{email}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="badge bg-coral-100 text-coral-700">Banned</span>
                      {profile && <span className={`badge ${profile.account_status === 'approved' ? 'bg-teal-100 text-teal-700' : 'bg-mango-100 text-mango-700'}`}>
                        {profile.account_status || 'no profile'}
                      </span>}
                      <button onClick={() => copyCredentials(email)} className="ml-auto p-1.5 text-ink/40 hover:text-teal-600" title="Copy email">
                        <Copy size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
