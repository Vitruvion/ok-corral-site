import type Stripe from 'stripe'
import { Resend } from 'resend'
import { getStripe } from '@/lib/stripe'
import { MARKETING_FIELD_KEY, serviceClient, TENANT_ID } from './repo'
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
 * Issuing first closes that. Issuance is itself idempotent: it tops the
 * order up to `quantity` tickets rather than inserting blindly, so a
 * replay inserts nothing and a crash mid-insert is repaired by the
 * retry. The claim still decides, exactly once, whether email goes out.
 */

const FROM = process.env.RESEND_FROM_EMAIL || 'howdy@okcorralsaloon.com'
const OWNER_TO = process.env.RESEND_TO_EMAIL || 'howdy@okcorralsaloon.com'

/** Retries on the (vanishingly unlikely) 60-bit code collision. */
const CODE_COLLISION_RETRIES = 5

type OrderRow = {
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
 * Tops the order up to `quantity` tickets and returns all of them.
 *
 * Idempotent by construction: it counts what exists first and only
 * inserts the shortfall, so a webhook replay inserts nothing and a
 * partial failure is repaired by the next delivery.
 */
async function ensureTicketsIssued(order: OrderRow): Promise<TicketLine[]> {
  const sb = serviceClient()

  const { data: existing, error: exErr } = await sb
    .from('tickets')
    .select('code')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true })

  if (exErr) throw new Error(`tickets lookup failed: ${exErr.message}`)

  const codes = (existing ?? []).map(t => String(t.code))
  const missing = order.quantity - codes.length

  if (missing > 0) {
    for (let i = 0; i < missing; i++) {
      codes.push(await insertOneTicket(order))
    }
    console.info(`[stripe-webhook] issued ${missing} ticket(s) for order ${order.id}`)
  }

  return codes.map(code => ({ code, payload: buildQrPayload(code, order.event_id) }))
}

async function insertOneTicket(order: OrderRow): Promise<string> {
  const sb = serviceClient()

  for (let attempt = 0; attempt < CODE_COLLISION_RETRIES; attempt++) {
    const code = generateTicketCode()
    const { error } = await sb.from('tickets').insert({
      tenant_id: TENANT_ID,
      order_id: order.id,
      event_id: order.event_id,
      code,
      status: 'valid',
      source: 'online',
    })

    if (!error) return code

    const duplicate = error.code === '23505' || /duplicate key value/i.test(error.message ?? '')
    if (!duplicate) throw new Error(`ticket insert failed: ${error.message}`)
    // 60 bits of entropy makes this effectively unreachable; the loop
    // exists so that if it ever does happen it self-corrects instead of
    // failing someone's order.
    console.warn(`[stripe-webhook] ticket code collision on ${code} - retrying`)
  }

  throw new Error('could not generate a unique ticket code')
}

// ── Capacity ──────────────────────────────────────────────────────
export type Oversell = { capacity: number; issued: number } | null

async function checkOversell(eventId: string): Promise<Oversell> {
  const sb = serviceClient()

  const { data: event, error: evErr } = await sb
    .from('events')
    .select('ticket_capacity')
    .eq('id', eventId)
    .maybeSingle()

  if (evErr) throw new Error(`event capacity lookup failed: ${evErr.message}`)

  const capacity = event?.ticket_capacity
  if (capacity === null || capacity === undefined) return null

  const { count, error: cErr } = await sb
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .neq('status', 'void')

  if (cErr) throw new Error(`ticket count failed: ${cErr.message}`)

  const issued = count ?? 0
  return issued > Number(capacity) ? { capacity: Number(capacity), issued } : null
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
