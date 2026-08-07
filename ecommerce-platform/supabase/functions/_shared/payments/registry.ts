// Adding a gateway means writing one adapters/<code>.ts file and
// registering it here — nothing else in the engine changes. Same
// convention as _shared/delivery/registry.ts.
//
// Registering an adapter here does NOT turn it on — integration_configs.enabled
// (checked by get_integration_credentials in the calling edge function) still
// gates whether it's ever reached. payments.gcash stays unregistered on
// purpose: PayMongo's Checkout Sessions already offers GCash as a payment
// method (payment_method_types includes 'gcash' in adapters/paymongo.ts), so
// a separate direct GCash adapter would duplicate rather than add coverage —
// see TASK1.md.

import type { PaymentProviderAdapter } from './types.ts'
import { paymongoAdapter } from './adapters/paymongo.ts'
import { mayaAdapter } from './adapters/maya.ts'
import { stripeAdapter } from './adapters/stripe.ts'
import { paypalAdapter } from './adapters/paypal.ts'

const registry = new Map<string, PaymentProviderAdapter>([
  [paymongoAdapter.code, paymongoAdapter],
  [mayaAdapter.code, mayaAdapter],
  [stripeAdapter.code, stripeAdapter],
  [paypalAdapter.code, paypalAdapter],
])

export function getAdapter(code: string): PaymentProviderAdapter {
  const adapter = registry.get(code)
  if (!adapter) throw new Error(`No payment adapter registered for provider "${code}"`)
  return adapter
}
