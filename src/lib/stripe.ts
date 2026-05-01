import Stripe from 'stripe'

let _stripe: Stripe | null = null

/**
 * Server-side Stripe client. Returns null if STRIPE_SECRET_KEY isn't set so
 * callers can fail gracefully rather than crashing at module load.
 */
export function getStripe(): Stripe | null {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  // No explicit apiVersion: SDK uses the account's pinned default, which is
  // what we want — pinning here would tie the codebase to a specific date.
  _stripe = new Stripe(key, { typescript: true })
  return _stripe
}

export const STRIPE_CONFIGURED = Boolean(process.env.STRIPE_SECRET_KEY)
