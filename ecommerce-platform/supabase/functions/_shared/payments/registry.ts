// Adding a gateway means writing one adapters/<code>.ts file and
// registering it here — nothing else in the engine changes. Same
// convention as _shared/delivery/registry.ts.
//
// Empty until the first real API key exists (payments.paymongo,
// payments.maya, payments.gcash, payments.stripe, payments.paypal in
// integration_configs) — no placeholder/fake adapter is registered here
// so there's nothing to accidentally call before credentials are real.

import type { PaymentProviderAdapter } from './types.ts'

const registry = new Map<string, PaymentProviderAdapter>([
  // [paymongoAdapter.code, paymongoAdapter],
])

export function getAdapter(code: string): PaymentProviderAdapter {
  const adapter = registry.get(code)
  if (!adapter) throw new Error(`No payment adapter registered for provider "${code}"`)
  return adapter
}
