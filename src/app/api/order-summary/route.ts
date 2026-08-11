import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { classifyFulfillment, type FulfillmentType } from '@/lib/fulfillment'

/**
 * Read-only order summary for the post-checkout confirmation modal.
 *
 * Sourced from the Stripe Checkout Session rather than the client-side merch
 * catalog, for two reasons: the catalog isn't shipped to the browser when
 * SHOW_MERCH is off, and Stripe is the authoritative record of what was
 * actually bought and charged anyway. It also works before the webhook has
 * landed — customers routinely get back here first — which a merch_orders
 * lookup would not.
 *
 * Deliberately minimal: fulfillment type, totals, and item names/quantities.
 * No email, no shipping address. The session id acts as a capability token
 * (it's unguessable and Stripe hands it to the buyer), so the payload is kept
 * to what the buyer already knows and nothing more.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type OrderSummary = {
  fulfillment: FulfillmentType
  total: number
  shippingCost: number
  items: Array<{ name: string; qty: number }>
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')?.trim()

  // Cheap shape check before spending a Stripe call on obvious junk.
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId) || sessionId.length > 200) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({ error: 'Unavailable.' }, { status: 503 })
  }

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'shipping_cost.shipping_rate'],
    })
  } catch {
    // Unknown/foreign session id — same answer as a malformed one.
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  // Only our own paid merch sessions get a summary.
  if (session.metadata?.kind !== 'merch' || session.payment_status !== 'paid') {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const rate = session.shipping_cost?.shipping_rate
  const fulfillment = classifyFulfillment({
    shippingRateDisplayName: rate && typeof rate !== 'string' ? rate.display_name : null,
    shippingAmountTotal: session.shipping_cost?.amount_total ?? null,
  })

  const summary: OrderSummary = {
    fulfillment,
    total: (session.amount_total ?? 0) / 100,
    shippingCost: (session.shipping_cost?.amount_total ?? 0) / 100,
    items: (session.line_items?.data ?? []).map(li => ({
      name: li.description ?? 'Item',
      qty: li.quantity ?? 1,
    })),
  }

  return NextResponse.json(summary, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
