import test from 'node:test'
import assert from 'node:assert/strict'
import { dateStart, nextDateStart, reportPeriodLabel, reportPeriodRange } from '../src/utils/reportDates.js'

test('last seven days includes today and six previous calendar days', () => {
  assert.deepEqual(reportPeriodRange('last7', new Date(2026, 6, 22, 12)), { start: '2026-07-16', end: '2026-07-22' })
})

test('last month handles year boundaries', () => {
  assert.deepEqual(reportPeriodRange('lastMonth', new Date(2026, 0, 10, 12)), { start: '2025-12-01', end: '2025-12-31' })
})

test('inclusive report end is represented by the next date exclusive', () => {
  assert.equal(dateStart('2026-07-22'), new Date(2026, 6, 22).toISOString())
  assert.equal(nextDateStart('2026-07-22'), new Date(2026, 6, 23).toISOString())
})

test('report period label identifies a single day or range', () => {
  assert.match(reportPeriodLabel('2026-07-01', '2026-07-22'), /to/)
  assert.doesNotMatch(reportPeriodLabel('2026-07-22', '2026-07-22'), /to/)
})
