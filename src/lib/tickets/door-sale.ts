import { z } from 'zod'
import { serviceClient, TENANT_ID } from './repo'
import { getOccupancy, type Occupancy } from './occupancy'

/**
 * Recording a door sale.
 *
 * A TALLY, NOT A TICKET. It writes one ticket_orders row and nothing
 * else: no rows in `tickets`, no code, no QR, no email. Someone paid at
 * the door and walked in; that is the whole event being recorded.
 *
 * THE MONEY DOES NOT MOVE THROUGH HERE. A card is rung on the bar's
 * Square POS and cash goes in the register. This code has no payment
 * integration and must never grow one -- if it ever looks like it is
 * taking a payment, something has gone badly wrong.
 */

/** One flush should not be able to write the whole night at once. */
export const MAX_SALE_BATCH = 100

/**
 * The accepted request shape.
 *
 * NOTE WHAT IS ABSENT: no price, no total, no amount. zod strips
 * unknown keys, so a body carrying one is not rejected -- it is simply
 * ignored, which is the same outcome and one fewer way for a queued
 * sale to get permanently stuck. The amount is read off the events row
 * in recordDoorSale and nowhere else.
 *
 * Lives here rather than in the route because a Next route module may
 * only export handlers, so a schema declared there cannot be imported
 * by anything -- including a test.
 */
export const DoorSaleSchema = z.object({
  id: z.string().uuid('Sale id must be a uuid.'),
  quantity: z
    .number()
    .int('Quantity must be a whole number.')
    .min(1, 'Quantity must be at least 1.')
    .max(50, 'That is more people than one door sale should cover.'),
  payment_method: z.enum(['square', 'cash']),
  sold_at: z.string().datetime().nullish(),
})

export const DoorSaleBodySchema = z.object({
  event_id: z.string().uuid('event_id must be a uuid.'),
  device_id: z.string().max(64).optional(),
  sales: z.array(DoorSaleSchema).min(1, 'No sales supplied.').max(MAX_SALE_BATCH),
})

export type DoorSaleInput = {
  /** Client-generated uuid, used as the row id. See below. */
  id: string
  eventId: string
  quantity: number
  paymentMethod: 'square' | 'cash'
  /** Client clock. Only meaningful for a sale that was queued offline. */
  soldAt?: string | null
  deviceId: string
}

export type DoorSaleResult = {
  id: string
  /** True when this call created the row; false when it already existed. */
  recorded: boolean
  quantity: number
  unitPrice: number
  total: number
  occupancy: Occupancy
}

/** A device clock further out than this is not to be believed. */
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000

function resolveSoldAt(supplied: string | null | undefined, now: number): string {
  if (!supplied) return new Date(now).toISOString()
  const t = Date.parse(supplied)
  if (!Number.isFinite(t)) return new Date(now).toISOString()
  if (t > now + 60_000) return new Date(now).toISOString()
  if (t < now - MAX_CLOCK_SKEW_MS) return new Date(now).toISOString()
  return new Date(t).toISOString()
}

export class DoorSaleError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

/**
 * Records a sale, idempotently on the client-supplied id.
 *
 * THE PRICE COMES FROM THE EVENT ROW. The request carries an event, a
 * quantity and how it was paid -- never an amount. A client-supplied
 * price would let whoever holds the phone write any figure into the
 * night's takings, and the register would not agree at close.
 *
 * The id being the PRIMARY KEY is what makes a retried flush safe: the
 * second insert violates the primary key and is recognised as "already
 * recorded" rather than writing a second sale. A duplicated scan is
 * harmless; a duplicated sale is money that does not exist.
 */
export async function recordDoorSale(input: DoorSaleInput): Promise<DoorSaleResult> {
  const sb = serviceClient()

  const { data: event, error: evErr } = await sb
    .from('events')
    .select('id, ticket_price, ticket_capacity')
    .eq('id', input.eventId)
    .maybeSingle()

  if (evErr) throw new DoorSaleError(`event lookup failed: ${evErr.message}`, 500)
  if (!event) throw new DoorSaleError('Event not found.', 404)

  const unitPrice = event.ticket_price === null ? null : Number(event.ticket_price)
  if (unitPrice === null || !Number.isFinite(unitPrice) || unitPrice <= 0) {
    throw new DoorSaleError('This event has no ticket price set.', 409)
  }

  const subtotal = Math.round(unitPrice * input.quantity * 100) / 100
  const soldAt = resolveSoldAt(input.soldAt, Date.now())

  const { error: insErr } = await sb.from('ticket_orders').insert({
    id: input.id,
    tenant_id: TENANT_ID,
    event_id: event.id,
    channel: 'door',
    payment_method: input.paymentMethod,
    // Left NULL on purpose. Nobody is asked for their name at a door
    // that is taking cash, and inventing a placeholder would make the
    // will-call list unsearchable.
    purchaser_name: null,
    purchaser_email: null,
    purchaser_phone: null,
    quantity: input.quantity,
    unit_price: unitPrice,
    subtotal,
    fees: 0,
    total: subtotal,
    // Paid by definition: the money changed hands before this was rung.
    status: 'paid',
    door_device: input.deviceId,
    created_at: soldAt,
    updated_at: soldAt,
  })

  let recorded = true
  if (insErr) {
    const duplicate =
      insErr.code === '23505' || /duplicate key value/i.test(insErr.message ?? '')
    if (!duplicate) throw new DoorSaleError(`door sale insert failed: ${insErr.message}`, 500)
    // The id already exists: this is a retried flush of a sale that
    // landed. Report it as recorded-already rather than as an error, so
    // the queue can drop it instead of retrying forever.
    recorded = false
  }

  // Note capacity is NOT enforced. Going over is a call the person on
  // the door makes with the room in front of them; the figure is
  // returned so the UI can show it, not so anything can refuse.
  const occupancy = await getOccupancy(event.id, event.ticket_capacity)

  return {
    id: input.id,
    recorded,
    quantity: input.quantity,
    unitPrice,
    total: subtotal,
    occupancy,
  }
}
