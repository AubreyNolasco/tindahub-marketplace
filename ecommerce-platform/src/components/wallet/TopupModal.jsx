import { useState } from 'react'
import { Loader2, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { cleanText, safeUploadPath, validateImage, validatePaymentReference } from '../../utils/security'
import BankTransferQr from '../payment/BankTransferQr'
import { ensurePaymentReferenceAvailable, paymentReferenceErrorMessage } from '../../lib/paymentReference'

export default function TopupModal({ open, onClose, onSubmitted }) {
  const { user } = useAuth()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('gcash')
  const [refNumber, setRefNumber] = useState('')
  const [proofFile, setProofFile] = useState(null)
  const [proofPreview, setProofPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const reset = () => {
    setAmount('')
    setRefNumber('')
    setProofFile(null)
    setProofPreview(null)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProofFile(file)
    setProofPreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) {
      toast.error('Maglagay ng valid na amount.')
      return
    }
    const fileError = validateImage(proofFile)
    if (fileError) return toast.error(fileError)
    const referenceError = validatePaymentReference(refNumber)
    if (referenceError) return toast.error(referenceError)

    setSubmitting(true)
    try {
      await ensurePaymentReferenceAvailable(refNumber)
      const path = safeUploadPath(user.id, 'topup', proofFile)
      const { error: uploadErr } = await supabase.storage
        .from('payment-proofs')
        .upload(path, proofFile, { upsert: true })
      if (uploadErr) throw uploadErr

      const { error: insertErr } = await supabase.from('topup_requests').insert({
        owner_id: user.id,
        amount: numericAmount,
        method,
        reference_number: cleanText(refNumber, 120),
        proof_url: path,
        status: 'pending'
      })
      if (insertErr) throw insertErr

      toast.success('Top-up request submitted! Awaiting admin approval.')
      reset()
      onSubmitted?.()
      onClose()
    } catch (err) {
      toast.error(paymentReferenceErrorMessage(err) || 'An error occurred while submitting the top-up.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink/40 backdrop-blur-sm">
      <div className="w-full max-w-md card p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl text-ink">Request a Top-Up</h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-teal-50 text-ink/50 hover:text-ink/80 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-ink/70">Amount (₱)</label>
            <input
              required
              type="number"
              step="0.01"
              min="1"
              className="input-field mt-1"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-ink/70">Paraan ng Pagbayad</label>
            <div className="flex gap-2 mt-1">
              <button type="button" onClick={() => setMethod('gcash')} className={`flex-1 py-2.5 rounded-xl border-2 font-semibold text-sm ${method === 'gcash' ? 'border-teal-500 bg-teal-50' : 'border-black/10'}`}>GCash</button>
              <button type="button" onClick={() => setMethod('maya')} className={`flex-1 py-2.5 rounded-xl border-2 font-semibold text-sm ${method === 'maya' ? 'border-teal-500 bg-teal-50' : 'border-black/10'}`}>Maya</button>
              <button type="button" onClick={() => setMethod('bank_transfer')} className={`flex-1 py-2.5 rounded-xl border-2 font-semibold text-sm ${method === 'bank_transfer' ? 'border-teal-500 bg-teal-50' : 'border-black/10'}`}>Bank</button>
            </div>
          </div>

          <BankTransferQr compact />

          <div>
            <label className="text-sm font-medium text-ink/70">Reference Number</label>
            <input
              required
              minLength={6}
              maxLength={120}
              className="input-field mt-1"
              placeholder="Reference number ng transaction"
              value={refNumber}
              onChange={(e) => setRefNumber(e.target.value)}
            />
            <p className="mt-1 text-[11px] leading-4 text-ink/45">For security, every transaction reference can only be submitted once—even with different spaces or dashes.</p>
          </div>

          <div>
            <label className="text-sm font-medium text-ink/70">Proof of Payment</label>
            <label className="mt-1 flex flex-col items-center justify-center border-2 border-dashed border-teal-200 rounded-xl p-6 cursor-pointer hover:bg-teal-50 transition-colors">
              {proofPreview ? (
                <img src={proofPreview} alt="proof" className="max-h-40 rounded-lg" />
              ) : (
                <>
                  <Upload className="text-teal-400 mb-2" size={24} />
                  <span className="text-sm text-ink/60">Click to upload a screenshot</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2">
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? 'Sinusubmit...' : 'Isumite ang Request'}
          </button>
        </form>
      </div>
    </div>
  )
}
