const pad = (value) => String(value).padStart(2, '0')

export function localDateValue(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const addDays = (date, days) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export const REPORT_PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'last7', label: 'Last 7 days' },
  { value: 'last30', label: 'Last 30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'thisQuarter', label: 'This quarter' },
  { value: 'thisYear', label: 'This year' },
  { value: 'custom', label: 'Custom dates' }
]

export function reportPeriodRange(period, now = new Date()) {
  const end = localDateValue(now)
  if (period === 'today') return { start: end, end }
  if (period === 'last7') return { start: localDateValue(addDays(now, -6)), end }
  if (period === 'last30') return { start: localDateValue(addDays(now, -29)), end }
  if (period === 'thisYear') return { start: `${now.getFullYear()}-01-01`, end }
  if (period === 'thisQuarter') {
    const month = Math.floor(now.getMonth() / 3) * 3
    return { start: localDateValue(new Date(now.getFullYear(), month, 1)), end }
  }
  if (period === 'lastMonth') {
    return {
      start: localDateValue(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      end: localDateValue(new Date(now.getFullYear(), now.getMonth(), 0))
    }
  }
  return { start: localDateValue(new Date(now.getFullYear(), now.getMonth(), 1)), end }
}

export function nextDateStart(dateValue) {
  const [year, month, day] = dateValue.split('-').map(Number)
  return new Date(year, month - 1, day + 1).toISOString()
}

export function dateStart(dateValue) {
  const [year, month, day] = dateValue.split('-').map(Number)
  return new Date(year, month - 1, day).toISOString()
}

export function reportPeriodLabel(start, end) {
  const format = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
  return start === end ? format(start) : `${format(start)} to ${format(end)}`
}
