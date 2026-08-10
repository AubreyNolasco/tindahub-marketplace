import test from 'node:test'
import assert from 'node:assert/strict'
import { partsFromResult, reverseOpenStreetMap } from '../src/lib/openstreetmap.js'

test('maps a Philippine province ahead of its broader region', () => {
  const parts = partsFromResult({
    lat: '10.3157', lon: '123.8854', display_name: 'Cebu City',
    address: { road: 'Osmeña Boulevard', city: 'Cebu City', province: 'Cebu', state: 'Central Visayas', postcode: '6000' },
  })
  assert.equal(parts.province, 'Cebu')
  assert.equal(parts.city, 'Cebu City')
  assert.equal(parts.latitude, 10.3157)
})

test('rejects invalid map coordinates without issuing a request', async () => {
  assert.equal(await reverseOpenStreetMap('invalid', 121), null)
  assert.equal(await reverseOpenStreetMap(91, 121), null)
})
