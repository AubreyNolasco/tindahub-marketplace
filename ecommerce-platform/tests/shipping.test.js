import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateShipping } from '../src/utils/shipping.js'

const merchantAddress = '12 Sample Street, Barangay One, Pasig City, Metro Manila'
const resellerAddress = '88 Market Road, Barangay Two, Quezon City, Metro Manila'
const packageItem = { quantity: 1, weight_kg: 2, length_cm: 30, width_cm: 20, height_cm: 15, motorcycle_safe: true }

test('calculates and rounds a motorcycle shipping estimate', () => {
  const result = calculateShipping({ merchantAddress, resellerAddress, packages: [packageItem], distanceKm: 6.2 })
  assert.equal(result.shipping_status, 'CALCULATED')
  assert.equal(result.selected_vehicle, 'Motorcycle')
  assert.equal(result.billing_distance_km, 7)
  assert.equal(result.calculated_shipping_fee, 89)
  assert.equal(result.rounded_shipping_fee, 90)
})

test('uses a sedan for fragile products', () => {
  const result = calculateShipping({ merchantAddress, resellerAddress, packages: [{ ...packageItem, fragile: true }], distanceKm: 6.2 })
  assert.equal(result.selected_vehicle, 'Sedan')
  assert.equal(result.rounded_shipping_fee, 220)
})

test('rejects negative, zero, fractional quantities, and invalid dimensions', () => {
  for (const invalid of [
    { ...packageItem, quantity: -1 },
    { ...packageItem, quantity: 0 },
    { ...packageItem, quantity: 1.5 },
    { ...packageItem, weight_kg: -2 },
    { ...packageItem, length_cm: 0 }
  ]) {
    assert.equal(calculateShipping({ merchantAddress, resellerAddress, packages: [invalid], distanceKm: 5 }).shipping_status, 'MANUAL_QUOTATION_REQUIRED')
  }
})

test('requires manual quotation for an oversized package', () => {
  const result = calculateShipping({ merchantAddress, resellerAddress, packages: [{ ...packageItem, weight_kg: 201 }], distanceKm: 5 })
  assert.equal(result.shipping_status, 'MANUAL_QUOTATION_REQUIRED')
  assert.match(result.customer_message, /larger delivery vehicle/i)
})
