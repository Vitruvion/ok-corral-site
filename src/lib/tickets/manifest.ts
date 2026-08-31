import { serviceClient } from './repo'
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
  tickets: number
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
  /** Non-void tickets actually issued. */
  issued: number
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

  const { data: ticketRows, error: tErr } = await sb
    .from('tickets')
    .select('event_id, status')
    .neq('status', 'void')

  if (tErr) throw new Error(`tickets lookup failed: ${tErr.message}`)

  const issuedByEvent = new Map<string, number>()
  for (const t of ticketRows ?? []) {
    issuedByEvent.set(t.event_id, (issuedByEvent.get(t.event_id) ?? 0) + 1)
  }

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
      const issued = issuedByEvent.get(e.id) ?? 0
      const capacity = e.ticket_capacity === null || e.ticket_capacity === undefined
        ? null
        : Number(e.ticket_capacity)
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
        capacity,
        issued,
        remaining: capacity === null ? null : capacity - issued,
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
      tickets: 0,
      amount: 0,
    }
    line.orders += 1
    line.tickets += o.quantity
    line.amount += o.total
    byMethod.set(o.payment_method, line)
  }

  return [...byMethod.values()].sort((a, b) => b.amount - a.amount)
}
