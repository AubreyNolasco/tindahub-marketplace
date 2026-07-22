import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { BadgeCheck, FileCheck2, Loader2, ShieldAlert, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'

const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const validatePermit = (file) => !file ? 'Please attach your business permit.' : !allowed.includes(file.type) ? 'Use a PDF, JPG, PNG, or WebP file.' : file.size > 8 * 1024 * 1024 ? 'Business permit must be 8 MB or smaller.' : ''

export default function BusinessPermit() {
  const { user, role, profile, loading, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [file, setFile] = useState(null)
  const [saving, setSaving] = useState(false)
  const permit = profile?.merchant_profiles
  useEffect(() => { if (permit?.business_permit_status === 'approved') navigate('/merchant', { replace: true }) }, [permit?.business_permit_status, navigate])
  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>
  if (!user) return <Navigate to="/login" replace />
  if (role !== 'merchant') return <Navigate to="/" replace />

  const upload = async (event) => {
    event.preventDefault(); const validation = validatePermit(file); if (validation) return toast.error(validation)
    setSaving(true)
    const extension = file.name.split('.').pop()?.toLowerCase() || 'file'
    const path = `${user.id}/permit-${Date.now()}.${extension}`
    const { error: uploadError } = await supabase.storage.from('business-permits').upload(path, file)
    if (uploadError) { setSaving(false); return toast.error(uploadError.message) }
    const { error } = await supabase.from('merchant_profiles').update({ business_permit_url: path, business_permit_status: 'pending', business_permit_notes: '', business_permit_reviewed_at: null, business_permit_reviewed_by: null }).eq('id', user.id)
    setSaving(false); if (error) return toast.error(error.message)
    await refreshProfile(); setFile(null); toast.success('Business permit submitted for Admin review.')
  }

  const status = permit?.business_permit_status || 'missing'
  return <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,rgba(22,121,75,.12),transparent_35%),#F7FAF7] px-4 py-10 sm:py-16"><div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-black/[0.06] bg-white shadow-2xl shadow-teal-900/10"><div className="bg-gradient-to-br from-teal-950 to-teal-700 p-6 text-white sm:p-8"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10"><FileCheck2 size={27} className="text-mango-300" /></span><h1 className="mt-5 font-display text-2xl font-bold sm:text-3xl">Verify your business permit</h1><p className="mt-2 text-sm leading-6 text-white/65">Merchant tools and purchasing remain locked until Admin confirms that your permit is valid.</p></div><div className="p-6 sm:p-8">{status === 'pending' ? <div className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-mango-100 text-mango-700"><Loader2 size={25} className="animate-spin" /></span><h2 className="mt-4 font-display text-xl font-bold text-ink">Permit under review</h2><p className="mt-2 text-sm leading-6 text-ink/60">Your file was received. Please wait for Admin approval before using the Merchant workspace.</p></div> : <><div className={`mb-5 flex items-start gap-3 rounded-2xl p-4 ${status === 'rejected' ? 'bg-coral-100 text-coral-700' : 'bg-mango-100 text-ink'}`}>{status === 'rejected' ? <ShieldAlert size={20} className="mt-0.5 shrink-0" /> : <BadgeCheck size={20} className="mt-0.5 shrink-0 text-mango-700" />}<div><p className="font-bold">{status === 'rejected' ? 'Permit needs resubmission' : 'Business permit required'}</p><p className="mt-1 text-xs leading-5 opacity-75">{status === 'rejected' ? permit?.business_permit_notes || 'Admin could not verify this document. Upload a clear and valid permit.' : 'Attach a clear image or PDF showing your registered business details.'}</p></div></div><form onSubmit={upload}><label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/50 px-4 py-8 text-center transition hover:bg-teal-50"><Upload size={26} className="text-teal-600" /><span className="mt-3 text-sm font-semibold text-ink">{file ? file.name : 'Choose business permit'}</span><span className="mt-1 text-xs text-ink/45">PDF, JPG, PNG, or WebP · maximum 8 MB</span><input type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label><button disabled={saving} className="btn-primary mt-5 flex w-full items-center justify-center gap-2">{saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Uploading...' : status === 'rejected' ? 'Resubmit permit' : 'Submit for review'}</button></form></>}</div><div className="border-t border-black/5 px-6 py-4 text-center"><button onClick={signOut} className="text-sm font-semibold text-ink/50 hover:text-teal-700">Sign out</button></div></div></div>
}
