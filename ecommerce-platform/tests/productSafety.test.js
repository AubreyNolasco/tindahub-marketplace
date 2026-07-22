import test from 'node:test'
import assert from 'node:assert/strict'
import { findProductSafetyViolation } from '../src/config/productSafety.js'

test('blocks an explicitly prohibited listing phrase', () => {
  assert.equal(findProductSafetyViolation({ name: 'Unlicensed firearm bundle' }), 'unlicensed firearm')
})

test('screens all relevant listing fields case-insensitively', () => {
  assert.equal(findProductSafetyViolation({ description: 'NO FDA APPROVAL' }), 'no fda approval')
})

test('does not block an ordinary household product', () => {
  assert.equal(findProductSafetyViolation({ name: 'Kitchen knife set', description: 'Stainless cooking tools' }), null)
})
