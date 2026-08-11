import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { Resend } from 'resend'
import { getStripe } from '@/lib/stripe'
import { getServiceSupabase } from '@/lib/supabase'
import { classifyFulfillment, type FulfillmentType } from '@/lib/fulfillment'
import {
  renderCustomerEmail,
  renderOwnerEmail,
  type OrderEmailData,
  type OrderItem,
  type ShippingAddress,
} from '@/lib/order-emails'

/**
 * Stripe webhook — merch payment completion.
 *
 * Flips a merch_orders row from 'pending' to 'paid', records the REAL amount
 * Stripe collected (including shipping), the fulfillment choice, the customer
 * email and the shipping address, then sends the confirmation emails.
 *
 * Runtime notes:
 *  - `nodejs` runtime + `force-dynamic`: signature verification needs Node
 *    crypto, and this must never be statically optimized or cached.
 *  - Signature verification requires the RAW request body. `req.text()` gives
 *    the untouched bytes; calling `req.json()` first would reformat the
 *    payload and every signature check would fail.
 *
 * Gift cards are deliberately ignored here — that flow moved to Square's
 * hosted page. Any non-merch session is acknowledged and dropped.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FROM = process.env.RESEND_FROM_EMAIL || 'howdy@okcorralsaloon.com'
const OWNER_TO = process.env.RESEND_TO_EMAIL || 'howdy@okcorralsaloon.com'

export async function POST(req: NextRequest) {
  const stripe = getStripe()
  if (!stripe) {
    console.error('[stripe-webhook] STRIPE_SECRET_KEY unset — cannot verify events')
    return NextResponse.json({ error: 'Stripe not configured.' }, { status: 500 })
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET unset — refusing to trust payload')
    return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 500 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 })
  }

  // RAW body — must be read as text, before any JSON parsing.
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret)
  } catch (err: any) {
    // Bad/forged signature, or a body that was mangled in transit. 400 tells
    // Stripe not to bother retrying — a replay won't verify either.
    console.error('[stripe-webhook] signature verification failed:', err?.message)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true, ignored: event.type })
  }

  const session = event.data.object as Stripe.Checkout.Session

  if (session.metadata?.kind !== 'merch') {
    return NextResponse.json({ received: true, ignored: 'non-merch session' })
  }

  // `completed` can fire before funds settle for async payment methods. We
  // only accept cards, but guard anyway so nothing is marked paid early.
  if (session.payment_status !== 'paid') {
    return NextResponse.json({ received: true, ignored: `payment_status=${session.payment_status}` })
  }

  try {
    const result = await handleMerchCompletion(stripe, session)
    return NextResponse.json({ received: true, ...result })
  } catch (err: any) {
    // A genuine failure (DB unreachable, Stripe retrieve failed). Non-2xx so
    // Stripe retries — the handler is idempotent, so a retry is safe.
    console.error('[stripe-webhook] processing failed', err)
    return NextResponse.json(
      { error: err?.message || 'Webhook processing failed.' },
      { status: 500 }
    )
  }
}

// ── Core ──────────────────────────────────────────────────────────
async function handleMerchCompletion(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
  session: Stripe.Checkout.Session
): Promise<{ status: string }> {
  const sb = getServiceSupabase()
  if (!sb) {
    // Service-role key bypasses RLS; without it we cannot update the order.
    // Throw so the caller returns 500 and Stripe retries once it's set.
    throw new Error('SUPABASE_SERVICE_ROLE_KEY unset — cannot update merch_orders')
  }

  // Re-fetch with expansions: the event payload doesn't include line items,
  // and the shipping rate arrives as a bare ID unless expanded.
  const full = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ['line_items', 'shipping_cost.shipping_rate'],
  })

  const shippingRate = full.shipping_cost?.shipping_rate
  const fulfillment: FulfillmentType = classifyFulfillment({
    shippingRateDisplayName:
      shippingRate && typeof shippingRate !== 'string' ? shippingRate.display_name : null,
    shippingAmountTotal: full.shipping_cost?.amount_total ?? null,
  })

  const totalPaid = (full.amount_total ?? 0) / 100
  const shippingCost = (full.shipping_cost?.amount_total ?? 0) / 100
  const customerEmail = full.customer_details?.email ?? null
  const customerName = resolveCustomerName(full)
  const shippingAddress = resolveShippingAddress(full)
  const paymentIntentId =
    typeof full.payment_intent === 'string'
      ? full.payment_intent
      : (full.payment_intent?.id ?? null)

  const paidPatch = {
    status: 'paid',
    total: totalPaid,
    customer_email: customerEmail,
    fulfillment_type: fulfillment,
    shipping_address: shippingAddress,
    stripe_payment_intent_id: paymentIntentId,
    paid_at: new Date().toISOString(),
  }

  // ── Idempotency ────────────────────────────────────────────────
  // The conditional UPDATE is the lock. Postgres applies it atomically, so
  // if Stripe delivers this event twice (or two deliveries race), exactly
  // one call matches a not-yet-paid row and gets a row back. Everyone else
  // gets zero rows and skips the emails.
  const { data: claimed, error: updateErr } = await sb
    .from('merch_orders')
    .update(paidPatch)
    .eq('stripe_session_id', session.id)
    .neq('status', 'paid')
    .select('id, items')

  if (updateErr) throw new Error(`merch_orders update failed: ${updateErr.message}`)

  let items: OrderItem[] | null = null

  if (claimed && claimed.length > 0) {
    items = normalizeItems(claimed[0].items)
  } else {
    // No row claimed: either already processed, or the best-effort insert at
    // session-creation time never landed.
    const { data: existing, error: selErr } = await sb
      .from('merch_orders')
      .select('id, status')
      .eq('stripe_session_id', session.id)
      .maybeSingle()

    if (selErr) throw new Error(`merch_orders lookup failed: ${selErr.message}`)

    if (existing) {
      console.info(`[stripe-webhook] ${session.id} already processed — skipping`)
      return { status: 'already-processed' }
    }

    // Recovery: rebuild the order from Stripe so a dropped insert doesn't
    // lose a paid order.
    const recovered = itemsFromStripe(full)
    const { error: insErr } = await sb.from('merch_orders').insert({
      stripe_session_id: session.id,
      items: recovered,
      subtotal: (full.amount_subtotal ?? 0) / 100,
      ...paidPatch,
    })

    if (insErr) {
      // Unique violation = another delivery inserted it first. Idempotent win.
      if (isUniqueViolation(insErr)) {
        console.info(`[stripe-webhook] ${session.id} inserted concurrently — skipping`)
        return { status: 'already-processed' }
      }
      throw new Error(`merch_orders recovery insert failed: ${insErr.message}`)
    }

    console.warn(`[stripe-webhook] ${session.id} had no pending row — recovered from Stripe`)
    items = recovered
  }

  if (!items || items.length === 0) items = itemsFromStripe(full)

  // ── Emails (never fatal) ───────────────────────────────────────
  // The order is already marked paid. If email fails we log and still return
  // 200 — a retry would re-run this whole event, and the idempotency lock
  // would skip the send anyway, so a non-2xx here buys nothing and risks
  // Stripe hammering a healthy endpoint.
  await sendOrderEmails({
    items,
    totalPaid,
    shippingCost,
    fulfillment,
    customerName,
    customerEmail,
    shippingAddress,
    sessionId: session.id,
  })

  return { status: 'paid' }
}

// ── Email dispatch ────────────────────────────────────────────────
async function sendOrderEmails(data: OrderEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[stripe-webhook] RESEND_API_KEY unset — order emails skipped')
    return
  }

  const resend = new Resend(apiKey)

  const jobs: Array<{ label: string; run: () => Promise<unknown> }> = []

  if (data.customerEmail) {
    const mail = renderCustomerEmail(data)
    jobs.push({
      label: 'customer',
      run: () =>
        resend.emails.send({
          from: `The OK Corral <${FROM}>`,
          to: [data.customerEmail as string],
          replyTo: OWNER_TO,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        }),
    })
  } else {
    console.warn(`[stripe-webhook] ${data.sessionId} has no customer email — confirmation skipped`)
  }

  const owner = renderOwnerEmail(data)
  jobs.push({
    label: 'owner',
    run: () =>
      resend.emails.send({
        from: `The OK Corral <${FROM}>`,
        to: [OWNER_TO],
        ...(data.customerEmail ? { replyTo: data.customerEmail } : {}),
        subject: owner.subject,
        html: owner.html,
        text: owner.text,
      }),
  })

  const results = await Promise.allSettled(
    jobs.map(async j => {
      const res = (await j.run()) as { error?: unknown } | undefined
      // Resend resolves with an `error` field rather than throwing.
      if (res && res.error) throw res.error
      return j.label
    })
  )

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[stripe-webhook] ${jobs[i].label} email failed for ${data.sessionId}`, r.reason)
    }
  })
}

// ── Helpers ───────────────────────────────────────────────────────
function resolveCustomerName(s: Stripe.Checkout.Session): string | null {
  const collected = s.collected_information?.shipping_details?.name
  if (collected) return collected
  // Older API versions expose shipping_details at the top level.
  const legacy = (s as unknown as { shipping_details?: { name?: string } }).shipping_details?.name
  return legacy ?? s.customer_details?.name ?? null
}

function resolveShippingAddress(s: Stripe.Checkout.Session): ShippingAddress | null {
  const collected = s.collected_information?.shipping_details?.address
  if (collected) return toAddress(collected)
  const legacy = (s as unknown as { shipping_details?: { address?: Stripe.Address } })
    .shipping_details?.address
  if (legacy) return toAddress(legacy)
  // Fall back to the billing address Stripe captured on the payment.
  const billing = s.customer_details?.address
  return billing ? toAddress(billing) : null
}

function toAddress(a: Stripe.Address): ShippingAddress {
  return {
    line1: a.line1 ?? null,
    line2: a.line2 ?? null,
    city: a.city ?? null,
    state: a.state ?? null,
    postal_code: a.postal_code ?? null,
    country: a.country ?? null,
  }
}

/** Coerces the jsonb `items` column into the email template's shape. */
function normalizeItems(raw: unknown): OrderItem[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((it: any) => ({
      name: String(it?.name ?? 'Item'),
      qty: Number(it?.qty) > 0 ? Number(it.qty) : 1,
      price: Number(it?.price) || 0,
      size: it?.size ?? null,
      color: it?.color ?? null,
    }))
    .filter(it => it.name)
}

/** Rebuilds a line-item list from Stripe when our own row is unavailable. */
function itemsFromStripe(s: Stripe.Checkout.Session): OrderItem[] {
  const lines = s.line_items?.data ?? []
  return lines.map(li => {
    const qty = li.quantity ?? 1
    const total = (li.amount_total ?? 0) / 100
    return {
      name: li.description ?? 'Item',
      qty,
      price: qty > 0 ? total / qty : total,
    }
  })
}

function isUniqueViolation(err: { code?: string; message?: string }): boolean {
  return err?.code === '23505' || /duplicate key value/i.test(err?.message ?? '')
}
