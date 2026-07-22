import { Download } from 'lucide-react'
import { REPORT_PERIODS, reportPeriodLabel, reportPeriodRange } from '../../utils/reportDates'

export default function ReportToolbar({
  title,
  subtitle,
  showDateRange = true,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onApply,
  onDownload,
  downloadDisabled,
  appliedStartDate,
  appliedEndDate,
  recordCount
}) {
  const hasPendingDates = showDateRange && (startDate !== appliedStartDate || endDate !== appliedEndDate)
  const choosePeriod = (event) => {
    const period = event.target.value
    if (period === 'custom') return
    const range = reportPeriodRange(period)
    onStartDateChange(range.start)
    onEndDateChange(range.end)
  }
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink">{title}</h1>
          {subtitle && <p className="text-ink/60">{subtitle}</p>}
        </div>
        <button onClick={onDownload} disabled={downloadDisabled || hasPendingDates} className="btn-secondary text-sm flex items-center gap-1.5">
          <Download size={16} /> Download Excel
        </button>
      </div>

      {showDateRange && (
        <div className="card p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.1fr_1fr_1fr_auto] gap-3 items-end">
          <label className="text-sm font-medium text-ink">Duration
            <select className="input-field mt-1" defaultValue="thisMonth" onChange={choosePeriod}>
              {REPORT_PERIODS.map((period) => <option key={period.value} value={period.value}>{period.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-ink">From
            <input type="date" className="input-field mt-1" value={startDate} onChange={(event) => onStartDateChange(event.target.value)} />
          </label>
          <label className="text-sm font-medium text-ink">To
            <input type="date" className="input-field mt-1" value={endDate} onChange={(event) => onEndDateChange(event.target.value)} />
          </label>
          <button onClick={onApply} className="btn-primary text-sm min-h-11">Apply period</button>
          <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-2 text-xs text-ink/60">
            <span>Loaded period: {appliedStartDate && appliedEndDate ? reportPeriodLabel(appliedStartDate, appliedEndDate) : 'Not loaded'}</span>
            {typeof recordCount === 'number' && <span>{recordCount.toLocaleString()} record(s)</span>}
            {hasPendingDates && <span className="font-semibold text-mango-600">Apply the new period before downloading.</span>}
          </div>
        </div>
      )}
    </>
  )
}
