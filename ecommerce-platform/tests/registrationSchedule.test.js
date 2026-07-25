import test from 'node:test'
import assert from 'node:assert/strict'
import { isRegistrationSlotPast, manilaDateTimeParts } from '../src/utils/registrationSchedule.js'

test('uses Asia Manila time for calendar decisions', () => {
  assert.deepEqual(manilaDateTimeParts(new Date('2026-07-23T16:30:00Z')), { date: '2026-07-24', time: '00:30' })
})

test('disables elapsed registration slots but keeps future slots', () => {
  const now = new Date('2026-07-23T02:30:00Z')
  assert.equal(isRegistrationSlotPast('2026-07-23', '10:00', now), true)
  assert.equal(isRegistrationSlotPast('2026-07-23', '11:00', now), false)
  assert.equal(isRegistrationSlotPast('2026-07-24', '09:00', now), false)
})
