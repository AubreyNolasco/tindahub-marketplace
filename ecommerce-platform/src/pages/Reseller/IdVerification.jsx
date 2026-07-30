import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { BadgeCheck, IdCard, Loader2, ShieldAlert, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Spinner from '../../components/ui/Spinner'
import { compressImage, safeUploadPath, validateImage } from '../../utils/security'

export default function IdVerification() {
  const { user, role, profile, loading, refreshProfile, signOut } = useAuth()
  const [selfieFile, setSelfieFile] = useState(null)
  const [idFile, setIdFile] = useState(null)
  const [saving, setSaving] = useState(false)

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>
  if (!user) return <Navigate to="/login" replace />
  if (role !== 'reseller') return <Navigate to="/" replace />
  if (profile?.id_verification_status === 'approved') return <Navigate to="/pending-approval" replace />

  const status = profile?.id_verification_status || 'missing'

  const submit = async (event) => {
    event.preventDefault()
    const selfieError = validateImage(selfieFile)
    if (selfieError) return toast.error(`Selfie photo: ${selfieError}`)
    const idError = validateImage(idFile)
    if (idError) return toast.error(`Valid ID photo: ${idError}`)

    setSaving(true)
    try {
      const compressedSelfie = await compressImage(selfieFile)
      const selfiePath = safeUploadPath(user.id, 'reseller-selfie', compressedSelfie)
      const { error: selfieUploadError } = await supabase.storage
        .from('reseller-id-verification')
        .upload(selfiePath, compressedSelfie)
      if (selfieUploadError) throw selfieUploadError

      const compressedId = await compressImage(idFile)
      const idPath = safeUploadPath(user.id, 'reseller-id', compressedId)
      const { error: idUploadError } = await supabase.storage
        .from('reseller-id-verification')
        .upload(idPath, compressedId)
      if (idUploadError) throw idUploadError

      const { error } = await supabase
        .from('profiles')
        .update({
          id_verification_selfie_url: selfiePath,
          id_verification_document_url: idPath,
          id_verification_status: 'pending'
        })
        .eq('id', user.id)
      if (error) throw error

      await refreshProfile()
      setSelfieFile(null)
      setIdFile(null)
      toast.success('Documents submitted for Admin review.')
    } catch (error) {
      toast.error(error.message || 'Unable to submit your documents.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[radial-gradient(circle_at_top_right,rgba(22,121,75,.12),transparent_35%),#F7FAF7] px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-xl overflow-hidden rounded-3xl border border-black/[0.06] bg-surface shadow-2xl shadow-teal-900/10">
        <div className="bg-gradient-to-br from-teal-950 to-teal-700 p-6 text-white sm:p-8">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10">
            <IdCard size={27} className="text-mango-300" />
          </span>
          <h1 className="mt-5 font-display text-2xl font-bold sm:text-3xl">Verify your identity</h1>
          <p className="mt-2 text-sm leading-6 text-white/65">
            Your Reseller account stays locked until Admin confirms your selfie and valid ID.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {status === 'pending' ? (
            <div className="text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-mango-100 text-mango-700">
                <Loader2 size={25} className="animate-spin" />
              </span>
              <h2 className="mt-4 font-display text-xl font-bold text-ink">Documents under review</h2>
              <p className="mt-2 text-sm leading-6 text-ink/60">
                We received your selfie and ID. Please wait for Admin approval before using the
                Reseller workspace.
              </p>
            </div>
          ) : (
            <>
              <div className={`mb-5 flex items-start gap-3 rounded-2xl p-4 ${status === 'rejected' ? 'bg-coral-100 text-coral-700' : 'bg-mango-100 text-ink'}`}>
                {status === 'rejected' ? <ShieldAlert size={20} className="mt-0.5 shrink-0" /> : <BadgeCheck size={20} className="mt-0.5 shrink-0 text-mango-700" />}
                <div>
                  <p className="font-bold">{status === 'rejected' ? 'Verification needs resubmission' : 'ID verification required'}</p>
                  <p className="mt-1 text-xs leading-5 opacity-75">
                    {status === 'rejected'
                      ? profile?.id_verification_notes || 'Admin could not verify these documents. Upload a clear selfie and valid ID.'
                      : 'Upload a clear selfie and a photo of one valid government ID.'}
                  </p>
                </div>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <label className="block text-sm font-semibold text-ink/70">
                  Selfie photo
                  <span className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/50 p-5 font-normal hover:bg-teal-50">
                    <Upload size={20} className="text-teal-600" />
                    <span className="min-w-0 truncate text-sm text-ink/60">{selfieFile ? selfieFile.name : 'Upload a clear selfie'}</span>
                    <input required type="file" accept="image/*" className="hidden" onChange={(event) => setSelfieFile(event.target.files?.[0] || null)} />
                  </span>
                </label>
                <label className="block text-sm font-semibold text-ink/70">
                  Valid government ID
                  <span className="mt-1.5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-teal-200 bg-teal-50/50 p-5 font-normal hover:bg-teal-50">
                    <Upload size={20} className="text-teal-600" />
                    <span className="min-w-0 truncate text-sm text-ink/60">{idFile ? idFile.name : 'Upload a photo of your valid ID'}</span>
                    <input required type="file" accept="image/*" className="hidden" onChange={(event) => setIdFile(event.target.files?.[0] || null)} />
                  </span>
                </label>

                <button disabled={saving} className="btn-primary flex w-full items-center justify-center gap-2">
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving ? 'Uploading...' : status === 'rejected' ? 'Resubmit documents' : 'Submit for review'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="border-t border-black/5 px-6 py-4 text-center">
          <button onClick={signOut} className="text-sm font-semibold text-ink/50 hover:text-teal-700">Sign out</button>
        </div>
      </div>
    </div>
  )
}
