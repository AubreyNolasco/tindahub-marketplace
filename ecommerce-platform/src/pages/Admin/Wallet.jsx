import { useEffect, useState } from 'react'
import { ArrowUpCircle, Wallet as WalletIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { formatDate, peso } from '../../utils/format'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'

export default function Wallet() {
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: walletData, error: walletError }, { data: transactionData, error: transactionError }] = await Promise.all([
      supabase.from('platform_wallet').select('*').eq('id', true).maybeSingle(),
      supabase.from('platform_wallet_transactions').select('*, orders(order_number)').order('created_at', { ascending: false })
    ])
    if (walletError) toast.error(walletError.message)
    if (transactionError) toast.error(transactionError.message)
    setWallet(walletData)
    setTransactions(transactionData || [])
    setLoading(false)
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="font-display font-bold text-2xl text-ink mb-1">Admin Wallet</h1>
      <p className="text-ink/60 mb-6">5% deductions collected from reseller checkouts and merchant processing fees.</p>

      <div className="card p-6 bg-teal-500 text-white mb-6">
        <div className="flex items-center gap-2 text-teal-100 mb-2"><WalletIcon size={18} /> <span className="text-sm">Available Platform Balance</span></div>
        <p className="font-display font-bold text-3xl">{peso(wallet?.balance || 0)}</p>
      </div>

      <h2 className="font-semibold text-ink mb-3">Fee Transaction History</h2>
      {transactions.length === 0 ? (
        <EmptyState icon={WalletIcon} title="No fee transactions yet" message="Reseller and merchant 5% deductions will appear here." />
      ) : (
        <div className="space-y-2">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <ArrowUpCircle className="text-teal-500 shrink-0" size={20} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink break-words">{transaction.description}</p>
                  <p className="text-xs text-ink/50">{transaction.orders?.order_number ? `${transaction.orders.order_number} - ` : ''}{formatDate(transaction.created_at)}</p>
                </div>
              </div>
              <span className="font-semibold text-teal-600 shrink-0">+{peso(transaction.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
