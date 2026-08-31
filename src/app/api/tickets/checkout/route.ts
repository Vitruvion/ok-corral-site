import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import {
  checkSaleable,
  MARKETING_FIELD_KEY,
  serviceClient,
  TENANT_ID,
} from '@/lib/tickets/repo'

/**
 * POST /api/tickets/checkout — buy tickets for an event.
 *
 * Follows /api/checkout's merch flow: the body says WHAT, the server
 * decides what it costs. The only accepted fields are an event
 * reference and a quantity. There is no price in the request shape at
 * all, and adding one would be a bug -- /api/checkout used to bill
 * whatever `price` the body claimed, and that is not repeating here.
 *
 * The ticket_orders row is written BEFORE the redirect, as 'pending'.
 * The webhook flips it to 'paid' and issues the tickets. Unlike the
 * merch insert -- which is best-effort with the anon client -- a failed
 * insert here aborts the checkout: without a row the webhook has
 * nothing to claim, and issuing tickets from a payment we never
 * recorded is worse than making someone press the button again.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Stripe wants whole cents. */
const dollarsToCents = (n: number) => Math.round(n * 100)

/** Checkout sessions die after this long, releasing nothing but noise. */
const SESSION_TTL_MINUTES = 30

/** Stripe's own floor for `expires_at` is 30 minutes out. */
const MIN_STRIPE_TTL_MINUTES = 30

type Body = {
  event_id?: unknown
  quantity?: unknown
}

function getOrigin(req: NextRequest): string {
  const origin = req.nextUrl.origin
  if (origin && origin !== 'null') return origin
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      { error: 'Ticket sales are not configured. Set STRIPE_SECRET_KEY.' },
      { status: 500 }
    )
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const eventKey = String(body.event_id ?? '').trim()
  if (!eventKey) {
    return NextResponse.json({ error: 'Missing event_id.' }, { status: 400 })
  }

  // Coerced, not trusted: "3" and 3 both mean three, 3.5 and "lots" mean
  // nothing and are rejected by checkSaleable.
  const quantity = Number(body.quantity)

  try {
    // Price, availability, on-sale state and the date check all resolve
    // server-side from the events row.
    const check = await checkSaleable(eventKey, quantity)
    if (!check.ok) {
      return NextResponse.json(
        { error: check.error, sold_out: check.soldOut ?? false },
        { status: check.soldOut ? 409 : 400 }
      )
    }

    const { event, price } = check
    const subtotal = Math.round(price * quantity * 100) / 100

    // No booking fee is added today. The column exists so that adding one
    // later does not need a migration, and so the admin view's revenue
    // split has somewhere to put it.
    const fees = 0
    const total = Math.round((subtotal + fees) * 100) / 100

    const sb = serviceClient()

    // The order row comes first. If this fails there is no checkout: a
    // paid session whose order row was never written would leave the
    // webhook recovering an order it cannot price or attribute.
    const { data: order, error: insertErr } = await sb
      .from('ticket_orders')
      .insert({
        tenant_id: TENANT_ID,
        event_id: event.id,
        channel: 'online',
        payment_method: 'stripe',
        quantity,
        unit_price: price,
        subtotal,
        fees,
        total,
        status: 'pending',
      })
      .select('id')
      .single()

    if (insertErr || !order) {
      throw new Error(`ticket_orders insert failed: ${insertErr?.message ?? 'no row returned'}`)
    }

    const origin = getOrigin(req)
    const eventLabel = [event.weekday, event.date].filter(Boolean).join(' ')

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: dollarsToCents(price),
            product_data: {
              name: `${event.name} — Ticket`,
              description:
                event.ticket_blurb?.trim() ||
                [eventLabel, event.time].filter(Boolean).join(' · ') ||
                undefined,
            },
          },
          quantity,
        },
      ],
      // Stripe always collects the email. Name and phone have to be asked
      // for -- they are what will-call runs on at the door until the
      // Phase 2 scanner ships.
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: true },
      custom_fields: [
        {
          key: MARKETING_FIELD_KEY,
          label: { type: 'custom', custom: 'Email me about future shows' },
          type: 'dropdown',
          optional: true,
          dropdown: {
            // Stripe has no checkbox field type. A two-option dropdown is
            // the honest equivalent: it defaults to nothing selected, so
            // the opt-in is unchecked unless someone actively picks Yes.
            options: [
              { label: 'No thanks', value: 'no' },
              { label: 'Yes, keep me posted', value: 'yes' },
            ],
          },
        },
      ],
      metadata: {
        kind: 'tickets',
        order_id: order.id,
        event_id: event.id,
        event_slug: event.slug,
        quantity: String(quantity),
      },
      // Stripe rejects anything under 30 minutes out.
      expires_at:
        Math.floor(Date.now() / 1000) +
        Math.max(SESSION_TTL_MINUTES, MIN_STRIPE_TTL_MINUTES) * 60,
      success_url: `${origin}/tickets/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?tickets=cancel`,
    })

    // Link the session back to the order so the webhook can claim it.
    const { error: linkErr } = await sb
      .from('ticket_orders')
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .eq('id', order.id)

    if (linkErr) {
      // The session exists and the customer could still pay it, but the
      // webhook would find no row to claim and would have to recover.
      // Log loudly; do not fail the checkout over it.
      console.error(
        `[/api/tickets/checkout] could not attach ${session.id} to order ${order.id}`,
        linkErr
      )
    }

    return NextResponse.json({ url: session.url, session_id: session.id, order_id: order.id })
  } catch (err: any) {
    console.error('[/api/tickets/checkout] error', err)
    return NextResponse.json(
      { error: err?.message || 'Could not start ticket checkout.' },
      { status: 500 }
    )
  }
}
