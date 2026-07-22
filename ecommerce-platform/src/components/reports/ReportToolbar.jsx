import { Download } from 'lucide-react'

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
  downloadDisabled
}) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-ink">{title}</h1>
          {subtitle && <p className="text-ink/60">{subtitle}</p>}
        </div>
        <button onClick={onDownload} disabled={downloadDisabled} className="btn-secondary text-sm flex items-center gap-1.5">
          <Download size={16} /> Download Excel
        </button>
      </div>

      {showDateRange && (
        <div className="card p-4 mb-6 flex flex-wrap gap-3 items-end">
          <label className="text-sm font-medium text-ink">From
            <input type="date" className="input-field mt-1" value={startDate} onChange={(event) => onStartDateChange(event.target.value)} />
          </label>
          <label className="text-sm font-medium text-ink">To
            <input type="date" className="input-field mt-1" value={endDate} onChange={(event) => onEndDateChange(event.target.value)} />
          </label>
          <button onClick={onApply} className="btn-primary text-sm">Apply date</button>
        </div>
      )}
    </>
  )
}
