import { useEffect, useState } from 'react'
import { ShieldAlert, UserRound, Store, RefreshCw, Loader2, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'

export default function TestAccounts() {
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState([])
  const [banStatus, setBanStatus] = useState({})
  const [busyEmail, setBusyEmail] = useState('')

  const load = async () => {
    setLoading(true)
    const [profilesResult, banResult] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, role, account_status, created_at').in('email', ['reseller@gmail.com', 'merchant@gmail.com']),
      supabase.rpc('get_test_accounts_ban_status')
    ])
    if (profilesResult.error) toast.error(profilesResult.error.message)
    if (banResult.error) toast.error(banResult.error.message)
    setProfiles(profilesResult.data || [])
    setBanStatus(Object.fromEntries((banResult.data || []).map((row) => [row.email, row.banned])))
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

  const setBanned = async (email, banned) => {
    setBusyEmail(email)
    const { error } = await supabase.rpc('set_test_account_banned', { p_email: email, p_banned: banned })
    if (error) {
      toast.error(error.message)
    } else {
      setBanStatus((prev) => ({ ...prev, [email]: banned }))
      toast.success(banned ? `${email} disabled.` : `${email} enabled — sign-in allowed.`)
    }
    setBusyEmail('')
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Test Accounts</h1>
        <p className="mt-1 text-sm text-ink/50">Enable or disable sign-in for the two legacy demo accounts.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-teal-600" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="p-6 sm:p-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display font-bold text-lg text-ink">Account Status</h2>
              <button onClick={load} className="btn-secondary p-2"><RefreshCw size={16} /></button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {testAccounts.map(({ email, role, icon: Icon, color }) => {
                const profile = profiles.find((p) => p.email === email)
                const banned = banStatus[email]
                return (
                  <div key={email} className={`rounded-2xl border p-5 ${banned ? 'border-black/5 bg-cream/50' : 'border-teal-200 bg-teal-50/50'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${color}`}><Icon size={20} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-ink">{role} Test Account</p>
                        <p className="text-xs text-ink/50">{email}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      <span className={`badge ${banned ? 'bg-coral-100 text-coral-700' : 'bg-teal-100 text-teal-700'}`}>
                        {banned ? 'Disabled' : 'Enabled'}
                      </span>
                      {profile && <span className={`badge ${profile.account_status === 'approved' ? 'bg-teal-100 text-teal-700' : 'bg-mango-100 text-mango-700'}`}>
                        {profile.account_status || 'no profile'}
                      </span>}
                      <button onClick={() => copyCredentials(email)} className="ml-auto p-1.5 text-ink/40 hover:text-teal-600" title="Copy email">
                        <Copy size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => setBanned(email, !banned)}
                      disabled={busyEmail === email}
                      className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all disabled:opacity-50 ${
                        banned ? 'bg-teal-600 text-white hover:bg-teal-500' : 'bg-coral-500 text-white hover:bg-coral-600'
                      }`}
                    >
                      {busyEmail === email && <Loader2 size={16} className="animate-spin" />}
                      {banned ? 'Enable sign-in' : 'Disable sign-in'}
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 rounded-xl border border-mango-300 bg-mango-100/60 p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert size={20} className="mt-0.5 shrink-0 text-mango-700" />
                <div>
                  <p className="font-bold text-mango-800 text-sm">Security note</p>
                  <p className="mt-1 text-xs leading-5 text-ink/60">
                    <strong>Enable</strong> only restores sign-in — it does not restore the old auto-approval or free wallet balance.
                    Enabled accounts still need approval and top-up review like any other account.
                    <strong className="text-coral-600"> Keep disabled unless actively testing or demoing.</strong>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
