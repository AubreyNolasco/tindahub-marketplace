// Adding a gateway means writing one adapters/<code>.ts file and
// registering it here — nothing else in the engine changes. Same
// convention as _shared/delivery/registry.ts.
//
// Registering an adapter here does NOT turn it on — integration_configs.enabled
// (checked by get_integration_credentials in the calling edge function) still
// gates whether it's ever reached. Remaining providers (payments.maya,
// payments.gcash, payments.stripe, payments.paypal) stay unregistered until
// their own adapters/<code>.ts exists.

import type { PaymentProviderAdapter } from './types.ts'
import { paymongoAdapter } from './adapters/paymongo.ts'

const registry = new Map<string, PaymentProviderAdapter>([
  [paymongoAdapter.code, paymongoAdapter],
])

export function getAdapter(code: string): PaymentProviderAdapter {
  const adapter = registry.get(code)
  if (!adapter) throw new Error(`No payment adapter registered for provider "${code}"`)
  return adapter
}
