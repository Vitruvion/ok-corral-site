/**
 * Shared fulfillment + shipping vocabulary for merch orders.
 *
 * THE single source of truth for shipping prices. The cart drawer renders
 * from it and /api/checkout builds Stripe's shipping options from it, so the
 * price a customer sees in the cart is the price Stripe charges. These were
 * previously two hardcoded sets of numbers that had already drifted (the cart
 * promised free shipping over $75 that Stripe never honored).
 *
 * /api/stripe/webhook reads the labels back to classify the order.
 */

export type FulfillmentType = 'ship' | 'pickup'

// ── Shipping tiers, by cart subtotal (items only, pre-shipping/tax) ──
//   under $15.00      →  $4.00
//   $15.00 – $69.99   →  $8.00
//   $70.00 and over   →  free
export const SHIPPING_TIERS = [
  { minCents: 0,    rateCents: 400 },
  { minCents: 1500, rateCents: 800 },
  { minCents: 7000, rateCents: 0 },
] as const

/** Subtotal at or above which shipping is free. Drives the cart's nudge copy. */
export const FREE_SHIPPING_THRESHOLD_CENTS = 7000
export const FREE_SHIPPING_THRESHOLD = FREE_SHIPPING_THRESHOLD_CENTS / 100

export const SHIP_LABEL = 'Shipping'
export const FREE_SHIP_LABEL = 'Free Shipping'
export const PICKUP_LABEL = 'Pickup at The OK Corral'

/** Dollars → integer cents, so tier comparisons never trip on float drift. */
export const toCents = (dollars: number): number =>
  Math.round((Number.isFinite(dollars) ? dollars : 0) * 100)

/**
 * Shipping charge (in cents) for a given cart subtotal in dollars.
 * An empty cart ships for nothing — there's nothing to send.
 */
export function shippingCentsForSubtotal(subtotalDollars: number): number {
  const cents = toCents(subtotalDollars)
  if (cents <= 0) return 0
  // Tiers are ascending; the last one whose floor we've reached wins.
  let rate: number = SHIPPING_TIERS[0].rateCents
  for (const tier of SHIPPING_TIERS) {
    if (cents >= tier.minCents) rate = tier.rateCents
  }
  return rate
}

/** Convenience wrapper for UI code that thinks in dollars. */
export const shippingForSubtotal = (subtotalDollars: number): number =>
  shippingCentsForSubtotal(subtotalDollars) / 100

/** Remaining spend to unlock free shipping, in dollars. Zero once qualified. */
export function amountUntilFreeShipping(subtotalDollars: number): number {
  const remaining = FREE_SHIPPING_THRESHOLD_CENTS - toCents(subtotalDollars)
  return remaining > 0 ? remaining / 100 : 0
}

/** The label Stripe shows for the shipping option at this subtotal. */
export const shipLabelForSubtotal = (subtotalDollars: number): string =>
  shippingCentsForSubtotal(subtotalDollars) === 0 ? FREE_SHIP_LABEL : SHIP_LABEL

/**
 * Classifies a completed Checkout Session's fulfillment choice.
 *
 * Name-based, because the amount alone is ambiguous now that free shipping
 * exists: a $0 shipping cost means either "picked up" or "shipped free". The
 * webhook expands (and if need be retrieves) the shipping rate so the display
 * name is essentially always available.
 *
 * If we somehow have neither a name nor a positive amount, we fall back to
 * 'ship'. That's the safer wrong answer — a pickup mis-filed as a shipment
 * costs postage, while a shipment mis-filed as pickup strands a customer
 * waiting for a package that never left.
 */
export function classifyFulfillment(opts: {
  shippingRateDisplayName?: string | null
  shippingAmountTotal?: number | null
}): FulfillmentType {
  const name = opts.shippingRateDisplayName?.trim()
  if (name) {
    if (/pick\s?-?up/i.test(name)) return 'pickup'
    if (/ship/i.test(name)) return 'ship'
  }
  if (typeof opts.shippingAmountTotal === 'number' && opts.shippingAmountTotal > 0) {
    return 'ship'
  }
  return 'ship'
}
