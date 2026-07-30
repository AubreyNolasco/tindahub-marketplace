import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, Ban, Clock3, ShieldCheck, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDate } from '../../utils/format'

export default function RestrictedAccountBanner() {
  const { role, profile } = useAuth()
  const [followup, setFollowup] = useState(null)
  const [loadingFollowup, setLoadingFollowup] = useState(role === 'merchant')
  const [hasTopupRequest, setHasTopupRequest] = useState(null)
  const [reason, setReason] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const merchantProfile = profile?.merchant_profiles
  const hasGrace = merchantProfile?.operate_grace_until && new Date(merchantProfile.operate_grace_until) > new Date()
  const permitApproved = merchantProfile?.business_permit_status === 'approved'
  const merchantSuspended = merchantProfile?.status === 'suspended'
  const merchantRestricted = role === 'merchant' && (merchantSuspended || (!permitApproved && !hasGrace))
  const resellerSuspended = profile?.account_status === 'suspended'
  const resellerRestricted = role === 'reseller' && profile?.account_status !== 'approved'

  useEffect(() => {
    if (role !== 'merchant') return
    let active = true
    supabase
      .from('merchant_followup_requests')
      .select('*')
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => { if (active) { setFollowup(data); setLoadingFollowup(false) } })
    return () => { active = false }
  }, [role])

  useEffect(() => {
    if (role !== 'reseller') return
    let active = true
    supabase
      .from('topup_requests')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => { if (active) setHasTopupRequest((count || 0) > 0) })
    return () => { active = false }
  }, [role])

  if (!merchantRestricted && !resellerRestricted) return null
  const suspended = resellerSuspended || merchantSuspended

  const submitFollowup = async () => {
    setSubmitting(true)
    const { data, error } = await supabase.rpc('request_merchant_followup', { p_reason: reason.trim() })
    setSubmitting(false)
    if (error) return toast.error(/FOLLOWUP_ALREADY_PENDING/.test(error.message) ? 'You already have a pending follow-up request.' : error.message)
    toast.success('Follow-up request sent to Admin.')
    setShowForm(false)
    setReason('')
    setFollowup(data)
  }

  return (
    <div className={`mx-4 mt-4 rounded-2xl border p-4 text-sm sm:mx-6 lg:mx-8 ${suspended ? 'border-coral-300 bg-coral-100/70 dark:border-coral-700 dark:bg-coral-500/10' : 'border-mango-300 bg-mango-100/70 dark:border-mango-700 dark:bg-mango-500/10'}`}>
      <div className="flex items-start gap-3">
        {suspended ? <Ban size={19} className="mt-0.5 shrink-0 text-coral-600" /> : <AlertCircle size={19} className="mt-0.5 shrink-0 text-mango-600" />}
        <div className="min-w-0 flex-1">
          {resellerRestricted ? (
            <>
              <p className="font-semibold text-fg">
                {resellerSuspended ? 'Your reseller account is suspended' : profile?.account_status === 'rejected' ? 'Your reseller application needs attention' : 'Complete your reseller requirements'}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-fg-muted">
                {resellerSuspended
                  ? 'Placing orders and managing customers is locked while your account is suspended. Contact Admin for details.'
                  : profile?.account_status === 'rejected'
                    ? 'Your application was not approved. Contact Admin for details.'
                    : 'You can browse your workspace now, but placing orders and adding customers stays locked until Admin approves your ID verification and initial wallet top-up.'}
              </p>
              {!resellerSuspended && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile?.id_verification_status !== 'approved' && (
                    <Link to="/verify-id" className="btn-secondary px-4 py-2 text-xs">
                      {profile?.id_verification_status === 'pending' ? 'View verification status' : 'Verify your identity'}
                    </Link>
                  )}
                  {hasTopupRequest === false && (
                    <Link to="/reseller/wallet" className="btn-primary px-4 py-2 text-xs">Top up your wallet</Link>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="font-semibold text-fg">
                {merchantSuspended ? 'Your merchant account is suspended' : merchantProfile?.business_permit_status === 'rejected' ? 'Your business permit needs resubmission' : 'Complete your business permit to operate'}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-fg-muted">
                {merchantSuspended
                  ? 'Posting and managing products is locked while your account is suspended. Contact Admin for details.'
                  : 'You can browse your workspace now, but posting products stays locked until Admin approves your business permit, or you request temporary access below while it is under review.'}
              </p>
              {!merchantSuspended && (
                <>
                  {!loadingFollowup && followup?.status === 'pending' && (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-mango-700"><Clock3 size={14} /> Follow-up request pending Admin review.</p>
                  )}
                  {!loadingFollowup && followup?.status === 'approved' && hasGrace && (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-teal-700"><ShieldCheck size={14} /> Temporary access granted until {formatDate(merchantProfile.operate_grace_until)}.</p>
                  )}
                  {!loadingFollowup && followup?.status === 'approved' && !hasGrace && (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-coral-600"><XCircle size={14} /> Your temporary access expired on {formatDate(merchantProfile.operate_grace_until)}. You can request another follow-up below.</p>
                  )}
                  {!loadingFollowup && followup?.status === 'rejected' && (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-coral-600"><XCircle size={14} /> Your last follow-up request was declined{followup.admin_notes ? `: ${followup.admin_notes}` : '.'}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-start gap-2">
                    <Link to="/merchant-permit" className="btn-secondary px-4 py-2 text-xs">
                      {merchantProfile?.business_permit_status === 'rejected' ? 'Resubmit permit' : 'Submit business permit'}
                    </Link>
                    {!loadingFollowup && (!followup || followup.status === 'rejected' || (followup.status === 'approved' && !hasGrace)) && (
                      showForm ? (
                        <div className="w-full">
                          <textarea
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            maxLength={500}
                            rows={2}
                            placeholder="Briefly explain why you need temporary access (optional)"
                            className="input-field w-full resize-none text-xs"
                          />
                          <div className="mt-2 flex gap-2">
                            <button type="button" disabled={submitting} onClick={submitFollowup} className="btn-primary px-4 py-2 text-xs">
                              {submitting ? 'Sending...' : 'Send request'}
                            </button>
                            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary px-4 py-2 text-xs">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setShowForm(true)} className="btn-primary px-4 py-2 text-xs">Request follow-up</button>
                      )
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
