import { useEffect, useState } from 'react'
import { Wallet, ArrowDownCircle, ArrowUpCircle, Plus, Banknote } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso, formatDate } from '../../utils/format'
import EmptyState from '../ui/EmptyState'
import Spinner from '../ui/Spinner'
import TopupModal from './TopupModal'
import TopupRequestList from './TopupRequestList'
import WithdrawModal from './WithdrawModal'
import WithdrawalRequestList from './WithdrawalRequestList'

export default function WalletView({ allowWithdraw = false }) {
  const { user } = useAuth()
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [topupRequests, setTopupRequests] = useState([])
  const [withdrawalRequests, setWithdrawalRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showTopup, setShowTopup] = useState(false)
  const [showWithdraw, setShowWithdraw] = useState(false)

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    setLoading(true)
    const [
      { data: walletData, error: walletErr },
      { data: requests, error: topupErr },
      { data: withdrawals, error: withdrawErr }
    ] = await Promise.all([
      supabase.from('wallets').select('*').eq('owner_id', user.id).maybeSingle(),
      supabase.from('topup_requests').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
      allowWithdraw
        ? supabase.from('withdrawal_requests').select('*').eq('owner_id', user.id).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] })
    ])
    if (walletErr) toast.error(walletErr.message)
    if (topupErr) toast.error(topupErr.message)
    if (withdrawErr) toast.error(withdrawErr.message)
    setWallet(walletData)
    setTopupRequests(requests || [])
    setWithdrawalRequests(withdrawals || [])

    if (walletData) {
      const { data: tx, error: txErr } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', walletData.id)
        .order('created_at', { ascending: false })
      if (txErr) toast.error(txErr.message)
      setTransactions(tx || [])
    }
    setLoading(false)
  }

  if (loading) return <div className="flex justify-center py-24"><Spinner /></div>

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="font-display font-bold text-2xl text-ink">Wallet</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowTopup(true)} className="btn-primary text-sm flex items-center gap-1.5">
            <Plus size={16} /> Top Up
          </button>
          {allowWithdraw && (
            <button onClick={() => setShowWithdraw(true)} className="btn-secondary text-sm flex items-center gap-1.5">
              <Banknote size={16} /> Withdraw
            </button>
          )}
        </div>
      </div>

      <div className="card p-6 bg-teal-500 text-white mb-6">
        <div className="flex items-center gap-2 text-teal-100 mb-2">
          <Wallet size={18} /> <span className="text-sm">Available Balance</span>
        </div>
        <p className="font-display font-bold text-3xl">{peso(wallet?.balance || 0)}</p>
      </div>

      <h2 className="font-semibold text-ink mb-3">Top-Up Requests</h2>
      <div className="mb-6">
        <TopupRequestList requests={topupRequests} />
      </div>

      {allowWithdraw && (
        <>
          <h2 className="font-semibold text-ink mb-3">Withdrawal Requests</h2>
          <div className="mb-6">
            <WithdrawalRequestList requests={withdrawalRequests} />
          </div>
        </>
      )}

      <h2 className="font-semibold text-ink mb-3">Transaction History</h2>
      {transactions.length === 0 ? (
        <EmptyState icon={Wallet} title="No transactions yet" message="Your wallet credits and debits will appear here." />
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <div key={t.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {t.type === 'credit' ? (
                  <ArrowUpCircle className="text-teal-500" size={20} />
                ) : (
                  <ArrowDownCircle className="text-coral-500" size={20} />
                )}
                <div>
                  <p className="text-sm font-medium text-ink break-words">{t.description}</p>
                  <p className="text-xs text-ink/50">{formatDate(t.created_at)}</p>
                </div>
              </div>
              <span className={`font-semibold ${t.type === 'credit' ? 'text-teal-600' : 'text-coral-600'}`}>
                {t.type === 'credit' ? '+' : '-'}{peso(t.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <TopupModal open={showTopup} onClose={() => setShowTopup(false)} onSubmitted={load} />
      {allowWithdraw && (
        <WithdrawModal open={showWithdraw} onClose={() => setShowWithdraw(false)} onSubmitted={load} />
      )}
    </div>
  )
}
