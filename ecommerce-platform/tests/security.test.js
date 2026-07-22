import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_IMAGE_BYTES, cleanText, containsAddressInfo, containsContactInfo, normalizePaymentReference, safeUploadPath, validateImage, validatePaymentReference } from '../src/utils/security.js'
import { isCompleteAddress } from '../src/utils/address.js'
import { PAYMENT_DESTINATION } from '../src/config/payment.js'

test('validates product image type and file size', () => {
  assert.equal(validateImage({ type: 'image/png', size: 1024 }), null)
  assert.match(validateImage({ type: 'image/svg+xml', size: 1024 }), /only JPG/i)
  assert.match(validateImage({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1 }), /smaller than 5 MB/i)
})

test('creates an owner-scoped upload path with the validated extension', () => {
  assert.match(safeUploadPath('user-123', 'product', { type: 'image/webp' }), /^user-123\/product-.+\.webp$/)
  assert.throws(() => safeUploadPath('', 'product', { type: 'image/png' }), /invalid upload/i)
})

test('detects contact and address information while allowing ordinary chat', () => {
  assert.equal(containsContactInfo('Message me at sample@gmail.com'), true)
  assert.equal(containsContactInfo('Available po ba ang item?'), false)
  assert.equal(containsAddressInfo('Unit 12, Sample Building, Pasig City'), true)
  assert.equal(containsAddressInfo('Please pack this carefully'), false)
})

test('requires a structured complete address', () => {
  assert.equal(isCompleteAddress('12 Sample St, Brgy One, Pasig City, Metro Manila'), true)
  assert.equal(isCompleteAddress('Pasig City'), false)
})

test('keeps the reusable InstaPay destination intact', () => {
  assert.equal(PAYMENT_DESTINATION.accountName, 'AUBREY NOLASCO')
  assert.equal(PAYMENT_DESTINATION.rail, 'InstaPay')
  assert.match(PAYMENT_DESTINATION.emvcoPayload, /^000201/)
  assert.match(PAYMENT_DESTINATION.emvcoPayload, /6304[0-9A-F]{4}$/)
  assert.equal(cleanText('  JOM HUB  ', 20), 'JOM HUB')
})

test('normalizes payment references to prevent formatting-based reuse', () => {
  assert.equal(normalizePaymentReference('  ABC-123 456 '), 'abc123456')
  assert.equal(normalizePaymentReference('abc 123-456'), 'abc123456')
  assert.match(validatePaymentReference('123'), /at least 6/i)
  assert.equal(validatePaymentReference('ABC-123456'), null)
})
