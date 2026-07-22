import { useEffect, useState } from 'react'
import { Banknote, PhilippinePeso, Hourglass, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { peso, formatDate, today, firstDayOfMonth, TOPUP_STATUS_STYLES, TOPUP_STATUS_LABELS } from '../../utils/format'
import { exportExcel } from '../../utils/excel'
import EmptyState from '../ui/EmptyState'
import Spinner from '../ui/Spinner'
import ReportToolbar from './ReportToolbar'
import SummaryCards from './SummaryCards'
import { dateStart, nextDateStart, reportPeriodLabel } from '../../utils/reportDates'

function downloadExcel(requests, startDate, endDate, role) {
  const headers = [...(role === 'admin' ? ['Account Owner'] : []), 'Date', 'Amount', 'Method', 'Reference No.', 'Status', 'Admin Notes', 'Reviewed At']
  const rows = requests.map((r) => [
    ...(role === 'admin' ? [r.profiles?.full_name || r.owner_id] : []),
    formatDate(r.created_at), r.amount, r.method?.toUpperCase() || '', r.reference_number || '', TOPUP_STATUS_LABELS[r.status] || r.status,
    r.admin_notes || '', r.reviewed_at ? formatDate(r.reviewed_at) : ''
  ])
  exportExcel(`jom-hub-${role}-topups-${startDate}-to-${endDate}.xls`, 'Top-Up Report', headers, rows, { title: 'Top-Up Report', period: reportPeriodLabel(startDate, endDate), scope: role })
}

export default function TopupReportView({ role }) {
  const { user } = useAuth()
  const [startDate, setStartDate] = useState(firstDayOfMonth)
  const [endDate, setEndDate] = useState(today)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [appliedRange, setAppliedRange] = useState({ start: firstDayOfMonth(), end: today() })

  useEffect(() => { load() }, [])

  const load = async (rangeStart = startDate, rangeEnd = endDate) => {
    if (rangeStart > rangeEnd) return toast.error('The start date must be before or the same as the end date.')
    setLoading(true)
    let query = supabase
      .from('topup_requests')
      .select(role === 'admin' ? '*, profiles!topup_requests_owner_id_fkey(full_name, role)' : '*')
      .gte('created_at', dateStart(rangeStart))
      .lt('created_at', nextDateStart(rangeEnd))
      .order('created_at', { ascending: false })
    if (role !== 'admin') query = query.eq('owner_id', user.id)
    const { data, error } = await query
    if (error) toast.error(error.message)
    setRequests(data || [])
    if (!error) setAppliedRange({ start: rangeStart, end: rangeEnd })
    setLoading(false)
  }

  const totalRequested = requests.reduce((sum, r) => sum + Number(r.amount), 0)
  const approvedAmount = requests.filter((r) => r.status === 'approved').reduce((sum, r) => sum + Number(r.amount), 0)
  const pendingCount = requests.filter((r) => r.status === 'pending').length
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length

  const cards = [
    { label: 'Total Requested', value: peso(totalRequested), icon: PhilippinePeso },
    { label: 'Approved Amount', value: peso(approvedAmount), icon: Banknote },
    { label: 'Pending Requests', value: pendingCount, icon: Hourglass },
    { label: 'Rejected Requests', value: rejectedCount, icon: XCircle }
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <ReportToolbar
        title="Top-Up Report"
        subtitle={role === 'admin' ? 'Platform-wide wallet top-up requests by request date.' : 'Wallet top-up requests by request date.'}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onApply={() => load(startDate, endDate)}
        onDownload={() => downloadExcel(requests, appliedRange.start, appliedRange.end, role)}
        downloadDisabled={!requests.length}
        appliedStartDate={appliedRange.start}
        appliedEndDate={appliedRange.end}
        recordCount={requests.length}
      />

      {loading ? <div className="flex justify-center py-24"><Spinner /></div> : <>
        <SummaryCards cards={cards} />
        <h2 className="font-semibold text-ink mb-3">Top-Up Requests</h2>
        {requests.length === 0 ? (
          <EmptyState icon={Banknote} title="No top-up requests in this date range" />
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="card p-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="font-semibold text-ink">{peso(r.amount)}</p>
                  {role === 'admin' && <p className="text-sm text-ink/70">{r.profiles?.full_name || r.owner_id}</p>}
                  <p className="text-xs text-ink/50">{r.method?.toUpperCase()} · {formatDate(r.created_at)}</p>
                  {r.status === 'rejected' && r.admin_notes && <p className="text-xs text-coral-600 mt-1">{r.admin_notes}</p>}
                </div>
                <span className={`badge ${TOPUP_STATUS_STYLES[r.status]}`}>{TOPUP_STATUS_LABELS[r.status]}</span>
              </div>
            ))}
          </div>
        )}
      </>}
    </div>
  )
}
