export function isStoreOpen(merchant, now = new Date()) {
  if (!merchant?.auto_pause_outside_hours || !merchant.store_open_time || !merchant.store_close_time) return true
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: merchant.store_timezone || 'Asia/Manila', hour:'2-digit', minute:'2-digit', hour12:false }).format(now).split(':')
  const current = Number(parts[0]) * 60 + Number(parts[1])
  const minutes = value => { const [hour, minute] = value.slice(0,5).split(':').map(Number); return hour * 60 + minute }
  const open = minutes(merchant.store_open_time), close = minutes(merchant.store_close_time)
  if (open === close) return true
  return open < close ? current >= open && current < close : current >= open || current < close
}
