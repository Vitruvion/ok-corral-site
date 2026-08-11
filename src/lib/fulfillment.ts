/**
 * Shared fulfillment vocabulary for merch orders.
 *
 * /api/checkout writes these labels into Stripe Checkout's shipping options;
 * /api/stripe/webhook reads them back to classify the order. Keeping both
 * sides on one constant means a label edit can't silently desync the two
 * and start mis-filing pickups as shipments.
 */

export type FulfillmentType = 'ship' | 'pickup'

/** Flat-rate shipping, in cents. Stripe wants integer cents. */
export const SHIPPING_FLAT_RATE_CENTS = 800

export const SHIP_LABEL = 'Shipping'
export const PICKUP_LABEL = 'Pickup at The OK Corral'

/**
 * Classifies a completed Checkout Session's fulfillment choice.
 *
 * Primary signal is the shipping rate's display name (exact intent, set by
 * us at session creation). Falls back to the shipping cost amount — a $0
 * rate is the pickup option — and finally to 'ship' when Stripe reports no
 * shipping cost at all, since a shipped order mis-filed as pickup would
 * silently strand a customer's package.
 */
export function classifyFulfillment(opts: {
  shippingRateDisplayName?: string | null
  shippingAmountTotal?: number | null
}): FulfillmentType {
  const name = opts.shippingRateDisplayName?.trim()
  if (name) {
    if (name === PICKUP_LABEL || /pick\s?-?up/i.test(name)) return 'pickup'
    if (name === SHIP_LABEL) return 'ship'
  }
  const amount = opts.shippingAmountTotal
  if (typeof amount === 'number') return amount > 0 ? 'ship' : 'pickup'
  return 'ship'
}
