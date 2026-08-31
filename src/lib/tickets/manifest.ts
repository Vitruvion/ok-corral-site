import { serviceClient } from './repo'
import { isEventUpcoming } from '@/lib/events'
import { countAdmissions, describeOccupancy } from './occupancy'
import { displayEventDate } from './complete'

/**
 * Read model for /admin/tickets — the will-call sheet.
 *
 * Until the Phase 2 scanner ships this IS the door process: someone
 * gives a name, whoever is working the door searches for it here. That
 * shapes what gets loaded — every paid order for every event that sells
 * tickets, all at once, so the search is instant and does not depend on
 * bar wifi holding up between keystrokes.
 */

/** Per-event ceiling on orders loaded. A show at the Corral will not
 *  come close; the cap exists so a runaway query can't hang the page. */
const ORDER_LIMIT = 500

export type TicketOrderRow = {
  id: string
  purchaser_name: string | null
  purchaser_email: string | null
  purchaser_phone: string | null
  quantity: number
  channel: string
  payment_method: string
  status: string
  total: number
  created_at: string
}

export type RevenueLine = {
  payment_method: string
  orders: number
  /**
   * People through the door on this payment method.
   *
   * NOT "tickets": a door sale has a quantity but issues no ticket
   * records at all, so calling this a ticket count would be wrong for
   * half the rows. "Admitted" is true of both channels.
   */
  admitted: number
  amount: number
}

export type EventTickets = {
  id: string
  slug: string
  name: string
  date: string
  dateLabel: string
  ticketsOnSale: boolean
  price: number | null
  capacity: number | null
  /** Non-void rows in `tickets`. Online seats only. */
  issued: number
  /** Sum of quantity over paid door orders. Issues no ticket rows. */
  doorAdmissions: number
  /** issued + doorAdmissions -- everyone holding a seat. */
  admitted: number
  /** Null when capacity is null (unlimited). */
  remaining: number | null
  /**
   * Revenue split by how the money was taken. NOT summed into a single
   * figure anywhere, deliberately - see the note on this module's
   * consumer. Only 'paid' orders are counted.
   */
  revenue: RevenueLine[]
  orders: TicketOrderRow[]
}

/**
 * An upcoming show with no ticket setup.
 *
 * NOT AN ERROR, and it must not read as one. Plenty of shows are free
 * or take no advance sales, and those are the normal case. This exists
 * only so a show that was MEANT to sell tickets cannot sit there
 * silently offering no way to buy -- which, with Eventbrite retired, is
 * a failure nobody would notice until a customer said so.
 */
export type UnconfiguredEvent = {
  id: string
  name: string
  date: string
  dateLabel: string
  /** Why it is not ticket-ready, in the words the sheet shows. */
  reason: 'no price set' | 'sales not switched on'
}

/**
 * Active, still-upcoming events that are not ticket-ready.
 *
 * Upcoming by the venue's own calendar day, the same rule the homepage
 * uses to retire past shows -- a show last March needs no nagging.
 */
export async function loadUnconfiguredEvents(): Promise<UnconfiguredEvent[]> {
  const sb = serviceClient()

  const { data, error } = await sb
    .from('events')
    .select('id, name, date, weekday, active, tickets_on_sale, ticket_price')
    .eq('active', true)
    .order('date', { ascending: true })

  if (error) throw new Error(`unconfigured events lookup failed: ${error.message}`)

  return (data ?? [])
    .map(e => ({
      ...e,
      date: typeof e.date === 'string' ? e.date : new Date(e.date).toISOString().slice(0, 10),
    }))
    .filter(e => isEventUpcoming({ date: e.date } as any))
    .filter(e => e.tickets_on_sale !== true || e.ticket_price === null || e.ticket_price === undefined)
    .map(e => ({
      id: e.id,
      name: e.name,
      date: e.date,
      dateLabel: displayEventDate(e.date, e.weekday ?? null),
      // On-sale-but-priceless is the genuinely odd one: someone meant to
      // sell and stopped half way. Called out differently for that reason.
      reason: e.tickets_on_sale === true ? 'no price set' : 'sales not switched on',
    }))
}

export async function loadTicketEvents(): Promise<EventTickets[]> {
  const sb = serviceClient()

  // Events that sell tickets, plus any event that has taken an order in
  // the past even if sales are now switched off - closing sales must not
  // make the will-call list for that show disappear.
  const { data: eventRows, error: evErr } = await sb
    .from('events')
    .select('id, slug, name, date, weekday, ticket_price, ticket_capacity, tickets_on_sale')
    .order('date', { ascending: true })

  if (evErr) throw new Error(`events lookup failed: ${evErr.message}`)

  const { data: orderRows, error: orErr } = await sb
    .from('ticket_orders')
    .select(
      'id, event_id, purchaser_name, purchaser_email, purchaser_phone, quantity, channel, payment_method, status, total, created_at'
    )
    .order('created_at', { ascending: false })
    .limit(ORDER_LIMIT)

  if (orErr) throw new Error(`ticket_orders lookup failed: ${orErr.message}`)

  // Shared occupancy count -- online tickets plus door admissions.
  const admissions = await countAdmissions((eventRows ?? []).map(e => e.id))

  const ordersByEvent = new Map<string, TicketOrderRow[]>()
  for (const o of orderRows ?? []) {
    const list = ordersByEvent.get(o.event_id) ?? []
    list.push({
      id: o.id,
      purchaser_name: o.purchaser_name,
      purchaser_email: o.purchaser_email,
      purchaser_phone: o.purchaser_phone,
      quantity: Number(o.quantity),
      channel: o.channel,
      payment_method: o.payment_method,
      status: o.status,
      total: Number(o.total),
      created_at: o.created_at,
    })
    ordersByEvent.set(o.event_id, list)
  }

  return (eventRows ?? [])
    .filter(e => e.tickets_on_sale === true || ordersByEvent.has(e.id))
    .map(e => {
      const orders = ordersByEvent.get(e.id) ?? []
      const occupancy = describeOccupancy(admissions.get(e.id), e.ticket_capacity)
      const date =
        typeof e.date === 'string' ? e.date : new Date(e.date).toISOString().slice(0, 10)

      return {
        id: e.id,
        slug: e.slug,
        name: e.name,
        date,
        dateLabel: displayEventDate(date, e.weekday ?? null),
        ticketsOnSale: e.tickets_on_sale === true,
        price: e.ticket_price === null || e.ticket_price === undefined ? null : Number(e.ticket_price),
        capacity: occupancy.capacity,
        issued: occupancy.ticketsIssued,
        doorAdmissions: occupancy.doorAdmissions,
        admitted: occupancy.admitted,
        remaining: occupancy.remaining,
        revenue: splitRevenue(orders),
        orders,
      }
    })
}

/**
 * Groups paid orders by payment_method.
 *
 * NEVER add a grand total to this. Stripe money arrives in the bank on
 * its own; Square and cash are reconciled against the register at close.
 * A single combined figure would be counted twice against the Square
 * close-out, which is worse than having no number at all.
 */
function splitRevenue(orders: TicketOrderRow[]): RevenueLine[] {
  const byMethod = new Map<string, RevenueLine>()

  for (const o of orders) {
    if (o.status !== 'paid') continue
    const line = byMethod.get(o.payment_method) ?? {
      payment_method: o.payment_method,
      orders: 0,
      admitted: 0,
      amount: 0,
    }
    line.orders += 1
    line.admitted += o.quantity
    line.amount += o.total
    byMethod.set(o.payment_method, line)
  }

  return [...byMethod.values()].sort((a, b) => b.amount - a.amount)
}
