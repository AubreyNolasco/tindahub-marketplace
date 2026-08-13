import test from 'node:test'
import assert from 'node:assert/strict'
import { haversineKm } from '../src/utils/geo.js'

test('distance between identical points is zero', () => {
  assert.equal(haversineKm(14.6091, 121.0223, 14.6091, 121.0223), 0)
})

test('matches a known short Metro Manila straight-line distance', () => {
  // Quezon City Hall to UP Diliman's Katipunan gate — straight-line ~2.08km.
  const distance = haversineKm(14.6507, 121.0494, 14.6537, 121.0685)
  assert.ok(distance > 1.9 && distance < 2.2, `expected ~2.08km, got ${distance}`)
})

test('is symmetric regardless of point order', () => {
  const a = haversineKm(14.5995, 120.9842, 10.3157, 123.8854)
  const b = haversineKm(10.3157, 123.8854, 14.5995, 120.9842)
  assert.ok(Math.abs(a - b) < 1e-9)
})

test('Manila to Cebu is roughly 570-580km straight-line', () => {
  const distance = haversineKm(14.5995, 120.9842, 10.3157, 123.8854)
  assert.ok(distance > 560 && distance < 590, `expected ~570km, got ${distance}`)
})
