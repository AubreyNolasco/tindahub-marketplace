export const REGISTRATION_TIMES = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00']

export function manilaDateTimeParts(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(value)
  const get = (type) => parts.find((part) => part.type === type)?.value
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

export function isRegistrationSlotPast(date, time, now = new Date()) {
  const current = manilaDateTimeParts(now)
  return date < current.date || (date === current.date && time <= current.time)
}
