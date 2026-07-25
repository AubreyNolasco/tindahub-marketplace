import { useEffect, useState } from 'react'
import { ShieldAlert, ShieldCheck, UserRound, Store, RefreshCw, Loader2, CheckCircle2, XCircle, ExternalLink, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

export default function TestAccounts() {
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [profiles, setProfiles] = useState([])
  const { signOut } = useAuth()

  const load = async () => {
    setLoading(true)
    const [statusResult, profilesResult] = await Promise.all([
      supabase.rpc('get_test_accounts_status'),
      supabase.from('profiles').select('id, full_name, email, role, account_status, created_at').in('email', ['reseller@gmail.com', 'merchant@gmail.com'])
    ])
    if (statusResult.error) toast.error(statusResult.error.message)
    if (profilesResult.error) toast.error(profilesResult.error.message)
    setEnabled(statusResult.data?.enabled || false)
    setProfiles(profilesResult.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const toggle = async () => {
    setToggling(true)
    const { error } = await supabase.rpc('toggle_test_accounts', { p_enabled: !enabled })
    if (error) { toast.error(error.message); setToggling(false); return }
    setEnabled(!enabled)
    toast.success(`Test accounts ${!enabled ? 'enabled' : 'disabled'}.`)
    setToggling(false)
  }

  const testAccounts = [
    { email: 'merchant@gmail.com', role: 'Merchant', icon: Store, color: 'bg-teal-100 text-teal-700' },
    { email: 'reseller@gmail.com', role: 'Reseller', icon: UserRound, color: 'bg-mango-100 text-mango-700' }
  ]

  const copyCredentials = (email) => {
    navigator.clipboard.writeText(email);
    toast.success(`Copied: ${email}`);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Test Accounts</h1>
        <p className="mt-1 text-sm text-ink/50">Enable or disable the built-in test accounts for development and testing purposes.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-teal-600" /></div>
      ) : (
        <>
          {/* Toggle Card */}
          <div className="card overflow-hidden">
            <div className={`p-6 sm:p-8 ${enabled ? 'bg-gradient-to-r from-teal-950 to-teal-700' : 'bg-gradient-to-r from-ink to-ink/80'}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4 text-white">
                  <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${enabled ? 'bg-teal-500/30' : 'bg-white/10'}`}>
                    {enabled ? <ShieldCheck size={28} className="text-mango-300" /> : <ShieldAlert size={28} className="text-coral-300" />}
                  </span>
                  <div>
                    <p className="font-display text-xl font-bold">{enabled ? 'Test Accounts Active' : 'Test Accounts Disabled'}</p>
                    <p className="mt-1 text-sm text-white/65">
                      {enabled
                        ? 'Reseller and Merchant test accounts can sign in with email OTP bypass.'
                        : 'Test account sign-in is blocked. Only real accounts can log in.'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggle}
                  disabled={toggling}
                  className={`shrink-0 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all ${
                    enabled
                      ? 'bg-coral-500 text-white hover:bg-coral-600'
                      : 'bg-teal-600 text-white hover:bg-teal-500'
                  } disabled:opacity-50`}
                >
                  {toggling && <Loader2 size={16} className="animate-spin" />}
                  {enabled ? 'Disable Test Accounts' : 'Enable Test Accounts'}
                </button>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display font-bold text-lg text-ink">Test Account Credentials</h2>
                <button onClick={load} className="btn-secondary p-2"><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {testAccounts.map(({ email, role, icon: Icon, color }) => {
                  const profile = profiles.find((p) => p.email === email)
                  return (
                    <div key={email} className={`rounded-2xl border p-5 ${enabled ? 'border-teal-200 bg-teal-50/50' : 'border-black/5 bg-cream/50'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${color}`}><Icon size={20} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-ink">{role} Test Account</p>
                          <p className="text-xs text-ink/50">{email}</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <span className={`badge ${enabled ? 'bg-teal-100 text-teal-700' : 'bg-coral-100 text-coral-700'}`}>
                          {enabled ? 'Active' : 'Disabled'}
                        </span>
                        {profile && <span className={`badge ${profile.account_status === 'approved' ? 'bg-teal-100 text-teal-700' : 'bg-mango-100 text-mango-700'}`}>
                          {profile.account_status || 'no profile'}
                        </span>}
                        <button onClick={() => copyCredentials(email)} className="ml-auto p-1.5 text-ink/40 hover:text-teal-600" title="Copy email">
                          <Copy size={14} />
                        </button>
                      </div>
                      {enabled && (
                        <div className="mt-3 rounded-xl bg-white p-3 text-xs text-ink/60">
                          <p className="font-semibold text-ink">Sign in:</p>
                          <ol className="mt-1 list-inside list-decimal space-y-1">
                            <li>Go to the <strong>Login</strong> page</li>
                            <li>Click the <strong>{role} Test Account</strong> button below the form</li>
                            <li>You'll be signed in instantly — no OTP needed</li>
                          </ol>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {enabled && (
                <div className="mt-4 rounded-xl border border-mango-300 bg-mango-100/60 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert size={20} className="mt-0.5 shrink-0 text-mango-700" />
                    <div>
                      <p className="font-bold text-mango-800 text-sm">⚠️ Security Notice</p>
                      <p className="mt-1 text-xs leading-5 text-ink/60">
                        Test accounts have <strong>₱10,000,000 wallet balance</strong> and are auto-approved.
                        <strong className="text-coral-600"> Disable test accounts in production</strong> to prevent unauthorized access.
                        Only enable them when you need to test or demo the system.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <a href="/login" target="_blank" rel="noopener noreferrer" className="card p-4 flex items-center justify-between group hover:border-teal-100">
              <div><p className="font-semibold text-ink text-sm">Go to Login</p><p className="text-xs text-ink/40">Sign in page</p></div>
              <ExternalLink size={16} className="text-ink/30 group-hover:text-teal-600" />
            </a>
            <a href="/reseller" target="_blank" rel="noopener noreferrer" className="card p-4 flex items-center justify-between group hover:border-mango-200">
              <div><p className="font-semibold text-ink text-sm">Reseller Dashboard</p><p className="text-xs text-ink/40">Test reseller workspace</p></div>
              <UserRound size={16} className="text-ink/30 group-hover:text-mango-600" />
            </a>
            <a href="/merchant" target="_blank" rel="noopener noreferrer" className="card p-4 flex items-center justify-between group hover:border-teal-100">
              <div><p className="font-semibold text-ink text-sm">Merchant Dashboard</p><p className="text-xs text-ink/40">Test merchant workspace</p></div>
              <Store size={16} className="text-ink/30 group-hover:text-teal-600" />
            </a>
          </div>
        </>
      )}
    </div>
  )
}
