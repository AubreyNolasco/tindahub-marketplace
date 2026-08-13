import test from 'node:test'
import assert from 'node:assert/strict'
import { previewShippingFee } from '../src/utils/shippingPreview.js'

// Mirrors the seeded v1 motorcycle rule (20260813000200_shipping_pricing_engine.sql):
// base ₱49, 5km included at ₱6/km, ₱5/km beyond, round up to nearest ₱5, no multiplier.
const motorcycleRule = {
  base_fee: 49, included_distance_km: 5, rate_per_km: 6, additional_distance_rate: 5,
  minimum_fee: null, maximum_fee: null, surcharge_percent: 0, rounding_increment: 5, road_directness_multiplier: 1
}

test('charges base fee plus per-km rate within the included distance', () => {
  const { fee, billingDistanceKm } = previewShippingFee(motorcycleRule, 3)
  assert.equal(billingDistanceKm, 3)
  assert.equal(fee, 70) // (49 + 3*6) = 67, rounded up to nearest 5 = 70
})

test('charges the additional-distance rate beyond the included distance', () => {
  // Matches the brief's own worked example: 7.8km distance, ₱49 base,
  // 5km included, billed as 8km (ceil) -> 3km beyond at ₱5/km.
  const { fee, billingDistanceKm } = previewShippingFee(motorcycleRule, 7.8)
  assert.equal(billingDistanceKm, 8)
  assert.equal(fee, 95) // (49 + 5*6 + 3*5) = 94, rounded up to nearest 5 = 95
})

test('rounds the final fee up to the configured increment', () => {
  const { fee } = previewShippingFee({ ...motorcycleRule, rounding_increment: 10 }, 3)
  assert.equal(fee, 70) // 67 rounds up to nearest 10 = 70
})

test('is exact at the included-distance boundary', () => {
  const { fee, billingDistanceKm } = previewShippingFee(motorcycleRule, 5)
  assert.equal(billingDistanceKm, 5)
  assert.equal(fee, 80) // (49 + 5*6) = 79, rounded up to nearest 5 = 80
})

test('clamps to the minimum fee', () => {
  const { fee } = previewShippingFee({ ...motorcycleRule, minimum_fee: 100 }, 1)
  assert.equal(fee, 100)
})

test('clamps to the maximum fee', () => {
  const { fee } = previewShippingFee({ ...motorcycleRule, maximum_fee: 60 }, 20)
  assert.equal(fee, 60)
})

test('applies a peak/high-demand surcharge before rounding', () => {
  const { fee } = previewShippingFee({ ...motorcycleRule, surcharge_percent: 20 }, 3)
  assert.equal(fee, 85) // 67 * 1.2 = 80.4, rounded up to nearest 5 = 85
})

test('scales distance by the road-directness multiplier before billing', () => {
  const { billingDistanceKm } = previewShippingFee({ ...motorcycleRule, road_directness_multiplier: 1.3 }, 6)
  assert.equal(billingDistanceKm, 8) // ceil(6 * 1.3) = ceil(7.8) = 8
})

test('a very small order still charges at least the base fee', () => {
  const { fee } = previewShippingFee(motorcycleRule, 0.1)
  assert.ok(fee >= motorcycleRule.base_fee)
})
