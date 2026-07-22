import test from 'node:test'
import assert from 'node:assert/strict'
import { getResellerUnitPrice, getUnitPrice } from '../src/utils/pricing.js'

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
