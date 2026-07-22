import test from 'node:test'
import assert from 'node:assert/strict'
import { autoCompleteDate, customerPaymentStatus, realizedResellerMargin, validateWithdrawal } from '../src/utils/orderProcess.js'

test('customer collections distinguish unpaid, partial, and realized payment',()=>{assert.equal(customerPaymentStatus(1000,0),'unpaid');assert.equal(customerPaymentStatus(1000,400),'partially_paid');assert.equal(customerPaymentStatus(1000,1000),'paid')})
test('realized reseller margin uses collected money less wallet order cost',()=>assert.equal(realizedResellerMargin(1500,1123.45),376.55))
test('withdrawal controls enforce minimum, daily limit, and payout cooldown',()=>{assert.equal(validateWithdrawal(499),'MINIMUM_WITHDRAWAL_500');assert.equal(validateWithdrawal(5000,96000),'DAILY_WITHDRAWAL_LIMIT_100000');assert.equal(validateWithdrawal(500,0,new Date()),'ACCOUNT_CHANGE_COOLDOWN');assert.equal(validateWithdrawal(500,0,new Date(Date.now()-90000000)),null)})
test('delivery auto-completion waits seven days after the later delivery milestone',()=>assert.equal(autoCompleteDate('2026-07-25T00:00:00Z','2026-07-23T00:00:00Z').toISOString(),'2026-08-01T00:00:00.000Z'))
