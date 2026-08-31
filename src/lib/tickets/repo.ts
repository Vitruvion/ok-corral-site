import { getServiceSupabase } from '@/lib/supabase'
import { eventDateParts, venueTodayParts } from '@/lib/events'

/**
 * Data access for ticketing.
 *
 * Everything here uses the SERVICE-ROLE client, and ticket_orders /
 * tickets carry no RLS policies at all. That is stricter than
 * merch_orders, which has a public insert policy so the anon client can
 * write its row from /api/checkout. The difference is deliberate: a
 * public insert policy here would let anyone forge pending orders
 * against a show, and a public read policy would expose ticket codes --
 * and the code IS the admission. Nothing about tickets should be
 * reachable with the anon key.
 */

/**
 * The Corral's tenant id. Matches the column defaults in migration 0012.
 *
 * There is one tenant and there will be one tenant for the foreseeable
 * future. It is written explicitly on insert anyway rather than leaning
 * on the default, so that the day this becomes a multi-tenant product
 * the call sites already read as tenant-scoped.
 */
export const TENANT_ID = 'a8ad9286-f33d-4c89-8f2f-2ec1347a798c'

/** Hard cap per online order. */
export const MAX_TICKETS_PER_ORDER = 10

/**
 * Stripe custom-field key for the marketing opt-in.
 *
 * Lives here rather than in the route because a Next route module may
 * only export handlers and a fixed set of config values -- exporting a
 * plain const from one fails the build. Both the checkout (which sets
 * the field) and the webhook (which reads it back) need the same
 * string, and a typo across the two would silently drop every consent.
 */
export const MARKETING_FIELD_KEY = 'marketing_opt_in'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TicketableEvent = {
  id: string
  slug: string
  name: string
  date: string
  weekday: string | null
  time: string | null
  doors: string | null
  ticket_price: number | null
  ticket_capacity: number | null
  tickets_on_sale: boolean
  ticket_blurb: string | null
}

const EVENT_COLUMNS =
  'id, slug, name, date, weekday, time, doors, ticket_price, ticket_capacity, tickets_on_sale, ticket_blurb'

export function serviceClient() {
  const sb = getServiceSupabase()
  if (!sb) throw new Error('SUPABASE_SERVICE_ROLE_KEY unset - ticketing is unavailable')
  return sb
}

/**
 * Looks an event up by UUID or by slug.
 *
 * Both are accepted because the browser only ever sees the slug:
 * fetchEvents maps `id: row.slug ?? row.id`, so EventData.id is the
 * slug, and that is what a ticket widget on the event card can send.
 * Passing a non-UUID string to a uuid column errors in Postgres rather
 * than returning no rows, so the shape decides which column to match.
 */
export async function getTicketableEvent(idOrSlug: string): Promise<TicketableEvent | null> {
  const key = String(idOrSlug ?? '').trim()
  if (!key || key.length > 200) return null

  const sb = serviceClient()
  const query = sb.from('events').select(EVENT_COLUMNS)
  const { data, error } = await (UUID_RE.test(key)
    ? query.eq('id', key)
    : query.eq('slug', key)
  ).maybeSingle()

  if (error) throw new Error(`event lookup failed: ${error.message}`)
  if (!data) return null

  return {
    ...(data as any),
    ticket_price: data.ticket_price === null ? null : Number(data.ticket_price),
    date: typeof data.date === 'string' ? data.date : new Date(data.date).toISOString().slice(0, 10),
  } as TicketableEvent
}

/**
 * Tickets already issued for an event.
 *
 * Counts everything that is not void -- a 'used' ticket still occupies
 * a seat, so only an explicitly voided one frees capacity back up.
 */
export async function countIssuedTickets(eventId: string): Promise<number> {
  const sb = serviceClient()
  const { count, error } = await sb
    .from('tickets')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .neq('status', 'void')

  if (error) throw new Error(`ticket count failed: ${error.message}`)
  return count ?? 0
}

export type SaleCheck =
  | { ok: true; event: TicketableEvent; price: number; issued: number; remaining: number | null }
  | { ok: false; error: string; soldOut?: boolean }

/**
 * Everything that must be true before someone is sent to Stripe.
 *
 * The PRICE IS RETURNED FROM HERE and nowhere else. The request body
 * carries an event and a quantity; what it costs is read off the events
 * row. /api/checkout once billed whatever price the body claimed, which
 * is the exact bug this shape exists to prevent repeating.
 */
export async function checkSaleable(idOrSlug: string, quantity: number): Promise<SaleCheck> {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return { ok: false, error: 'Quantity must be a whole number of at least 1.' }
  }
  if (quantity > MAX_TICKETS_PER_ORDER) {
    return { ok: false, error: `Maximum ${MAX_TICKETS_PER_ORDER} tickets per order.` }
  }

  const event = await getTicketableEvent(idOrSlug)
  if (!event) return { ok: false, error: 'Event not found.' }

  if (!event.tickets_on_sale) {
    return { ok: false, error: 'Tickets are not on sale for this event.' }
  }

  const price = event.ticket_price
  if (price === null || !Number.isFinite(price) || price <= 0) {
    return { ok: false, error: 'Tickets are not on sale for this event.' }
  }

  // Same venue-timezone rule the rest of the site uses to hide past
  // shows, so an event that has dropped off the homepage cannot still
  // be sold through a stale tab.
  const parts = eventDateParts(event.date)
  if (parts) {
    const today = venueTodayParts()
    const past =
      parts.y < today.y ||
      (parts.y === today.y && parts.m < today.m) ||
      (parts.y === today.y && parts.m === today.m && parts.d < today.d)
    if (past) return { ok: false, error: 'This event has already happened.' }
  }

  const issued = await countIssuedTickets(event.id)
  const capacity = event.ticket_capacity

  if (capacity !== null) {
    const remaining = capacity - issued
    if (remaining <= 0) {
      return { ok: false, error: 'This show is sold out.', soldOut: true }
    }
    if (quantity > remaining) {
      return {
        ok: false,
        error:
          remaining === 1
            ? 'Only 1 ticket left for this show.'
            : `Only ${remaining} tickets left for this show.`,
        soldOut: true,
      }
    }
    return { ok: true, event, price, issued, remaining }
  }

  return { ok: true, event, price, issued, remaining: null }
}
