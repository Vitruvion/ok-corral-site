import type Stripe from 'stripe'
import { Resend } from 'resend'
import { getStripe } from '@/lib/stripe'
import { MARKETING_FIELD_KEY, serviceClient, TENANT_ID } from './repo'
import { getOccupancy } from './occupancy'
import { buildQrPayload, generateTicketCode } from './codes'
import {
  renderOversellEmail,
  renderTicketCustomerEmail,
  renderTicketOwnerEmail,
  type RenderedEmail,
  type TicketLine,
} from './emails'

/**
 * Ticket order completion — the webhook's ticket branch.
 *
 * ORDER OF OPERATIONS MATTERS, and it is not the obvious one:
 *
 *   1. issue any tickets this order is still missing
 *   2. THEN claim the order with a conditional UPDATE
 *
 * The claim is the idempotency lock, exactly as in the merch path: one
 * delivery matches a not-yet-paid row, everyone else gets zero rows and
 * returns without sending mail. But issuing AFTER the claim would leave
 * a hole -- if the insert failed, the order would already be marked
 * paid, and Stripe's retry would claim zero rows and never issue. A
 * customer who paid would have no tickets and no email, and nothing
 * would say so.
 *
 * Issuing first closes that, and is safe to do because issuance does not
 * rely on the claim's lock for its own correctness: (order_id, seq) is
 * UNIQUE and the insert is ON CONFLICT DO NOTHING, so duplicate and even
 * simultaneous deliveries are rejected by Postgres rather than by a
 * count in JS. The claim still decides, exactly once, whether email goes
 * out. See ensureTicketsIssued.
 */

const FROM = process.env.RESEND_FROM_EMAIL || 'howdy@okcorralsaloon.com'
const OWNER_TO = process.env.RESEND_TO_EMAIL || 'howdy@okcorralsaloon.com'

/** Retries on the (vanishingly unlikely) 60-bit code collision. */
const CODE_COLLISION_RETRIES = 5

export type OrderRow = {
  id: string
  event_id: string
  quantity: number
  unit_price: number
  status: string
}

export async function handleTicketCompletion(
  stripe: NonNullable<ReturnType<typeof getStripe>>,
  session: Stripe.Checkout.Session
): Promise<{ status: string }> {
  const sb = serviceClient()

  const orderId = session.metadata?.order_id
  if (!orderId) {
    // Our own checkout always sets this. If it is missing the session
    // did not come from /api/tickets/checkout, and guessing which order
    // to mark paid is worse than refusing.
    console.error(`[stripe-webhook] ticket session ${session.id} has no order_id metadata`)
    return { status: 'ignored-no-order-id' }
  }

  const { data: order, error: findErr } = await sb
    .from('ticket_orders')
    .select('id, event_id, quantity, unit_price, status')
    .eq('id', orderId)
    .maybeSingle()

  if (findErr) throw new Error(`ticket_orders lookup failed: ${findErr.message}`)
  if (!order) {
    // The row was written before the redirect, so this should be
    // impossible. Throwing lets Stripe retry in case of a read replica
    // lag rather than dropping a paid order on the floor.
    throw new Error(`ticket_orders row ${orderId} not found for session ${session.id}`)
  }

  const row = order as OrderRow

  // ── 1. Tickets ────────────────────────────────────────────────
  const tickets = await ensureTicketsIssued(row)

  // ── 2. Claim ──────────────────────────────────────────────────
  const details = extractPurchaser(session)
  const { data: claimed, error: claimErr } = await sb
    .from('ticket_orders')
    .update({
      status: 'paid',
      stripe_session_id: session.id,
      purchaser_name: details.name,
      purchaser_email: details.email,
      purchaser_phone: details.phone,
      marketing_opt_in: details.marketingOptIn,
      // Stripe's amount_total is what was actually collected.
      total: (session.amount_total ?? 0) / 100,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id)
    .neq('status', 'paid')
    .select('id')

  if (claimErr) throw new Error(`ticket_orders claim failed: ${claimErr.message}`)

  if (!claimed || claimed.length === 0) {
    console.info(`[stripe-webhook] ticket order ${row.id} already processed - skipping`)
    return { status: 'already-processed' }
  }

  // ── 3. Capacity re-check ──────────────────────────────────────
  // Checkout counted capacity before payment, but nothing reserves a
  // seat between then and now: several people can hold pending orders
  // for the same last few tickets and all pay. That race is why this
  // exists, and why the answer is an alert rather than a refusal --
  // this customer has already been charged.
  const oversell = await checkOversell(row.event_id)

  // ── 4. Email ──────────────────────────────────────────────────
  const event = await loadEventForEmail(row.event_id)
  await sendTicketEmails({
    tickets,
    order: row,
    details,
    event,
    total: (session.amount_total ?? 0) / 100,
    oversell,
  })

  return { status: oversell ? 'paid-oversold' : 'paid' }
}

// ── Issuance ──────────────────────────────────────────────────────
/**
 * Issues this order's tickets and returns all of them.
 *
 * CONCURRENCY. Stripe can deliver the same event twice AT ONCE -- a
 * retry can overlap a slow first delivery. This used to count existing
 * tickets and insert the shortfall, which is a check-then-insert: two
 * deliveries could both count zero and both insert `quantity` rows,
 * double-issuing against one payment. No JS can close that, because the
 * count is stale the moment it is read.
 *
 * So the database decides instead. Every ticket carries an ordinal
 * within its order, (order_id, seq) is UNIQUE (migration 0013), and all
 * `quantity` rows go in as ONE statement with ON CONFLICT DO NOTHING.
 * Whichever delivery reaches an ordinal first wins it; the loser's row
 * is discarded by Postgres. The invariant lives in the schema, so it
 * holds however the callers behave.
 *
 * The read-back afterwards is what makes this correct rather than just
 * safe: the winning codes may be the other delivery's, so the email has
 * to be built from what is actually in the table, never from what this
 * call happened to generate.
 */
export async function ensureTicketsIssued(order: OrderRow): Promise<TicketLine[]> {
  const sb = serviceClient()

  for (let attempt = 0; attempt < CODE_COLLISION_RETRIES; attempt++) {
    const rows = Array.from({ length: order.quantity }, (_, i) => ({
      tenant_id: TENANT_ID,
      order_id: order.id,
      event_id: order.event_id,
      seq: i + 1,
      code: generateTicketCode(),
      status: 'valid',
      source: 'online',
    }))

    const { error } = await sb
      .from('tickets')
      .upsert(rows, { onConflict: 'order_id,seq', ignoreDuplicates: true })

    if (!error) break

    // A collision on the ordinal is the concurrent-delivery case and is
    // absorbed by ON CONFLICT, so it never surfaces here. A collision on
    // `code` is the 60-bit birthday case, is NOT covered by that conflict
    // target, and does surface -- retry the batch with fresh codes.
    if (!isCodeCollision(error)) {
      throw new Error(`ticket insert failed: ${error.message}`)
    }
    console.warn(`[stripe-webhook] ticket code collision on order ${order.id} - retrying`)
    if (attempt === CODE_COLLISION_RETRIES - 1) {
      throw new Error('could not generate unique ticket codes')
    }
  }

  // Read back the winners, whoever wrote them.
  const { data, error } = await sb
    .from('tickets')
    .select('code, seq')
    .eq('order_id', order.id)
    .order('seq', { ascending: true })

  if (error) throw new Error(`tickets lookup failed: ${error.message}`)

  const tickets = (data ?? []).map(t => ({
    code: String(t.code),
    payload: buildQrPayload(String(t.code), order.event_id),
  }))

  if (tickets.length !== order.quantity) {
    // Not fatal: the customer's tickets exist and the email is worth
    // sending. But a mismatch means something wrote outside this path,
    // and it should be visible rather than quietly shipped.
    console.error(
      `[stripe-webhook] order ${order.id} has ${tickets.length} tickets, expected ${order.quantity}`
    )
  }

  return tickets
}

/** Unique violation on tickets.code, as opposed to on (order_id, seq). */
function isCodeCollision(error: { code?: string; message?: string }): boolean {
  const isUnique = error?.code === '23505' || /duplicate key value/i.test(error?.message ?? '')
  return isUnique && /code/i.test(error?.message ?? '')
}

// ── Capacity ──────────────────────────────────────────────────────
export type Oversell = { capacity: number; issued: number } | null

async function checkOversell(eventId: string): Promise<Oversell> {
  // Shared count -- online tickets AND door admissions. A show can be
  // pushed over by someone paying at the door just as easily as online,
  // and this used to only see half of that.
  const occupancy = await getOccupancy(eventId)
  if (occupancy.capacity === null) return null
  return occupancy.admitted > occupancy.capacity
    ? { capacity: occupancy.capacity, issued: occupancy.admitted }
    : null
}

// ── Session parsing ───────────────────────────────────────────────
export type Purchaser = {
  name: string | null
  email: string | null
  phone: string | null
  marketingOptIn: boolean
}

export function extractPurchaser(session: Stripe.Checkout.Session): Purchaser {
  const details = session.customer_details
  const field = session.custom_fields?.find(f => f.key === MARKETING_FIELD_KEY)

  return {
    name: details?.name ?? null,
    email: details?.email ?? null,
    phone: details?.phone ?? null,
    // Unselected comes back as null/undefined, which is a no. Only an
    // explicit 'yes' counts as consent.
    marketingOptIn: field?.dropdown?.value === 'yes',
  }
}

// ── Email ─────────────────────────────────────────────────────────
type EventForEmail = {
  name: string
  date: string
  weekday: string | null
  time: string | null
  doors: string | null
}

async function loadEventForEmail(eventId: string): Promise<EventForEmail> {
  const sb = serviceClient()
  const { data, error } = await sb
    .from('events')
    .select('name, date, weekday, time, doors')
    .eq('id', eventId)
    .maybeSingle()

  if (error || !data) {
    // The confirmation is still worth sending with a thin header rather
    // than not at all -- the codes are the part that matters.
    console.warn(`[stripe-webhook] could not load event ${eventId} for email`, error)
    return { name: 'The OK Corral', date: '', weekday: null, time: null, doors: null }
  }

  return {
    name: String(data.name),
    date: typeof data.date === 'string' ? data.date : new Date(data.date).toISOString().slice(0, 10),
    weekday: data.weekday ?? null,
    time: data.time ?? null,
    doors: data.doors ?? null,
  }
}

/** "Saturday, June 25 2026" from an ISO date plus the stored weekday. */
export function displayEventDate(iso: string, weekday: string | null): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return [weekday, iso].filter(Boolean).join(', ')
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const pretty = `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`
  return weekday ? `${weekday}, ${pretty}` : pretty
}

async function sendTicketEmails(args: {
  tickets: TicketLine[]
  order: OrderRow
  details: Purchaser
  event: EventForEmail
  total: number
  oversell: Oversell
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[stripe-webhook] RESEND_API_KEY unset - ticket emails skipped')
    return
  }

  const resend = new Resend(apiKey)
  const eventDate = displayEventDate(args.event.date, args.event.weekday)

  const data = {
    eventName: args.event.name,
    eventDate,
    eventTime: args.event.time,
    doors: args.event.doors,
    quantity: args.order.quantity,
    unitPrice: Number(args.order.unit_price),
    total: args.total,
    purchaserName: args.details.name,
    purchaserEmail: args.details.email,
    orderId: args.order.id,
    tickets: args.tickets,
  }

  const jobs: Array<{ label: string; run: () => Promise<unknown> }> = []

  if (args.details.email) {
    const mail = await renderTicketCustomerEmail(data)
    jobs.push({
      label: 'ticket-customer',
      run: () =>
        resend.emails.send({
          from: `The OK Corral <${FROM}>`,
          to: [args.details.email as string],
          replyTo: OWNER_TO,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          attachments: mail.attachments,
        }),
    })
  } else {
    console.warn(`[stripe-webhook] ticket order ${args.order.id} has no email - confirmation skipped`)
  }

  const owner = renderTicketOwnerEmail(data)
  jobs.push({ label: 'ticket-owner', run: () => sendPlain(resend, owner, args.details.email) })

  if (args.oversell) {
    const alert = renderOversellEmail({
      eventName: args.event.name,
      eventDate,
      capacity: args.oversell.capacity,
      issued: args.oversell.issued,
      orderId: args.order.id,
      quantity: args.order.quantity,
    })
    jobs.push({ label: 'oversell-alert', run: () => sendPlain(resend, alert, null) })
    console.warn(
      `[stripe-webhook] ${args.event.name} OVERSOLD: ${args.oversell.issued}/${args.oversell.capacity}`
    )
  }

  // Never fatal. The order is paid and the tickets exist; a non-2xx here
  // would only make Stripe retry an event whose claim already succeeded,
  // which would skip the send anyway.
  const results = await Promise.allSettled(
    jobs.map(async j => {
      const res = (await j.run()) as { error?: unknown } | undefined
      if (res && res.error) throw res.error
      return j.label
    })
  )

  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[stripe-webhook] ${jobs[i].label} email failed for ${args.order.id}`, r.reason)
    }
  })
}

function sendPlain(resend: Resend, mail: RenderedEmail, replyTo: string | null) {
  return resend.emails.send({
    from: `The OK Corral <${FROM}>`,
    to: [OWNER_TO],
    ...(replyTo ? { replyTo } : {}),
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  })
}
