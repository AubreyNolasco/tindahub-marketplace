import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

const ERROR_MESSAGES = {
  INSUFFICIENT_BALANCE: 'Your wallet balance is insufficient for this withdrawal.',
  INVALID_AMOUNT: 'Maglagay ng valid na amount.'
}

export default function WithdrawModal({ open, onClose, onSubmitted }) {
  const { profile } = useAuth()
  const [amount, setAmount] = useState('')
  const [bankName, setBankName] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [submitting, setSubmitting] = useState(false)
  useEffect(()=>{if(open){setBankName(profile?.payout_provider||'');setAccountName(profile?.payout_account_name||profile?.full_name||'');setAccountNumber(profile?.payout_account_number||'')}},[open,profile])

  if (!open) return null

  const reset = () => {
    setAmount('')
    setBankName('')
    setAccountName('')
    setAccountNumber('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) {
      toast.error('Maglagay ng valid na amount.')
      return
    }

    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('request_withdrawal', {
        p_amount: numericAmount,
        p_bank_name: bankName,
        p_bank_account_name: accountName,
        p_bank_account_number: accountNumber
      })
      if (error) throw error

      toast.success('Withdrawal submitted. Admin will schedule the transfer, then mark it Sent after payment.')
      reset()
      onSubmitted?.()
      onClose()
    } catch (err) {
      toast.error(ERROR_MESSAGES[err.message] || err.message || 'An error occurred while submitting the withdrawal.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-ink/40 backdrop-blur-sm">
      <div className="w-full max-w-md card p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl text-ink">Request a Withdrawal</h2>
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
            <label className="text-sm font-medium text-ink/70">Bank or e-wallet destination</label>
            <input
              required
              className="input-field mt-1"
              placeholder="BPI, BDO, GCash, Maya"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-ink/70">Account Name</label>
            <input
              required
              className="input-field mt-1"
              placeholder="Full name on the bank account"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-ink/70">Account Number</label>
            <input
              required
              className="input-field mt-1"
              placeholder="Account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full flex items-center justify-center gap-2">
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? 'Sinusubmit...' : 'Isumite ang Withdrawal'}
          </button>
          <p className="rounded-xl bg-mango-100/60 p-3 text-xs leading-5 text-ink/55">The amount is held immediately. Admin will show the planned processing time based on availability. Funds are transferred only when marked <strong>Sent</strong>.</p>
        </form>
      </div>
    </div>
  )
}
