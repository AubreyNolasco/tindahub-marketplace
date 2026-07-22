import test from 'node:test'
import assert from 'node:assert/strict'
import { getResellerOperationFee, getResellerProfitEstimate, getResellerUnitPrice, getUnitPrice } from '../src/utils/pricing.js'

test('retail pricing applies valid quantity tiers', () => {
  assert.equal(getUnitPrice({ price: 1000, discount_tiers: [{ min_qty: 10, price: 900 }] }, 10), 900)
})

test('reseller uses wholesale price before retail price', () => {
  assert.equal(getResellerUnitPrice({ price: 1000, wholesale_price: 800 }, 1), 800)
})

test('reseller quantity tier can reduce but never increase buying price', () => {
  const product = { price: 1000, wholesale_price: 800, discount_tiers: [{ min_qty: 10, price: 720 }, { min_qty: 20, price: 850 }] }
  assert.equal(getResellerUnitPrice(product, 10), 720)
  assert.equal(getResellerUnitPrice(product, 20), 720)
})

test('campaign retail price remains bounded and numeric', () => {
  assert.equal(getUnitPrice({ price: 1000, campaign_discount_percent: 10 }, 1), 900)
})

test('calculates per-piece reseller profit after the minimum system fee', () => {
  const estimate = getResellerProfitEstimate({ price: 150, wholesale_price: 100, suggested_retail_price: 150 }, 1, 150)
  assert.equal(estimate.buyingSubtotal, 100)
  assert.equal(estimate.customerTotal, 150)
  assert.equal(estimate.systemFee, 3)
  assert.equal(estimate.estimatedProfit, 47)
})

test('recalculates bulk reseller profit using the eligible quantity tier', () => {
  const product = { price: 150, wholesale_price: 100, suggested_retail_price: 150, discount_tiers: [{ min_qty: 10, price: 90 }] }
  const estimate = getResellerProfitEstimate(product, 10, 140)
  assert.equal(estimate.buyingUnitPrice, 90)
  assert.equal(estimate.buyingSubtotal, 900)
  assert.equal(estimate.customerTotal, 1400)
  assert.equal(estimate.systemFee, 9)
  assert.equal(estimate.estimatedProfit, 491)
})

test('caps the reseller operation fee from three to fifty pesos', () => {
  assert.equal(getResellerOperationFee(100), 3)
  assert.equal(getResellerOperationFee(1000), 10)
  assert.equal(getResellerOperationFee(100000), 50)
})
