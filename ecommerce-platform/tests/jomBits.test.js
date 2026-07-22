import test from 'node:test'
import assert from 'node:assert/strict'
import { answerJomBits, getJomBitsSuggestions } from '../src/config/jomBitsKnowledge.js'

test('gives role-specific profit guidance', () => {
  const reseller = answerJomBits('How much profit can I earn?', 'reseller')
  const merchant = answerJomBits('How is my profit calculated?', 'merchant')
  assert.match(reseller.answer, /capped 1% system fee/)
  assert.match(merchant.answer, /3% completed-order platform fee/)
})

test('keeps answers inside JOM HUB scope', () => {
  const response = answerJomBits('Who won the basketball game?', 'reseller')
  assert.equal(response.title, 'JOM HUB questions only')
  assert.match(response.answer, /only help with JOM HUB/)
})

test('returns a relevant role route and page awareness', () => {
  const response = answerJomBits('How do I upload a product?', 'merchant', '/merchant/products/new')
  assert.equal(response.route, '/merchant/products/new')
  assert.match(response.answer, /already on the relevant page/)
})

test('provides separate suggestion sets', () => {
  assert.notDeepEqual(getJomBitsSuggestions('merchant'), getJomBitsSuggestions('reseller'))
})

test('routes registration and schedule requests to immediate actions', () => {
  assert.equal(answerJomBits('I want to register', 'reseller').route, '/signup')
  assert.equal(answerJomBits('Can I schedule training?', 'merchant').route, '/#registration-calendar')
})
