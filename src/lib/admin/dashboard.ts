import { serviceClient } from '@/lib/tickets/repo'
import { isEventUpcoming } from '@/lib/events'
import { countAdmissions, describeOccupancy, type Occupancy } from '@/lib/tickets/occupancy'
import { displayEventDate } from '@/lib/tickets/complete'
import { unconfiguredReason } from '@/lib/tickets/manifest'
import type { EventData } from '@/lib/data'

/**
 * The at-a-glance summary on /admin.
 *
 * ═══════════════════════════════════════════════════════════════════
 * BUDGET: 3 queries, and 1 when nothing is on sale.
 *
 * A dashboard is the page most likely to be opened idly, from a phone,
 * several times an evening -- so it is the page where a lazy
 * implementation costs the most. The temptation is to call
 * loadTicketEvents() and loadUnconfiguredEvents() and pick out the two
 * numbers needed; that would be four queries, one of them dragging back
 * up to 500 orders with every purchaser's name, email and phone, to
 * render a line that says "38 admitted".
 *
 * Instead:
 *   1. ONE select over active events -- the only columns needed.
 *   2. The next show and the not-ready count are both derived from that
 *      one result set in JS. Same rows, two questions.
 *   3. countAdmissions() for the next event ONLY, and only when it
 *      sells tickets. That is the shared count -- 2 queries however
 *      many events it is asked about -- and it is skipped entirely for
 *      a free show, where "how many admitted" has no meaning.
 *
 * Neither derived answer is re-implemented here: upcoming-ness is
 * isEventUpcoming (the venue-calendar-day rule), ticket-readiness is
 * unconfiguredReason (what /admin/tickets lists), and occupancy is
 * describeOccupancy. This module decides nothing on its own -- it is a
 * cheap read shaped for one screen.
 * ═══════════════════════════════════════════════════════════════════
 */

export type NextShow = {
  id: string
  name: string
  date: string
  dateLabel: string
  ticketsOnSale: boolean
  /** Null when the show does not sell tickets — there is nothing to count. */
  occupancy: Occupancy | null
}

export type DashboardSummary = {
  /** Null when there is no upcoming show at all. Say so; don't render an empty shell. */
  nextShow: NextShow | null
  /**
   * Upcoming shows that are not ticket-ready. The same set
   * /admin/tickets lists under "Not selling tickets", counted by the
   * same rule.
   */
  notTicketReady: number
  /** Queries actually issued, so the cost of this page stays visible. */
  queryCount: number
}

export async function loadDashboard(): Promise<DashboardSummary> {
  const sb = serviceClient()

  // Query 1. Active events only -- a hidden show is hidden from here
  // too. Sorted ascending so the first upcoming row IS the next show.
  const { data, error } = await sb
    .from('events')
    .select('id, name, date, weekday, tickets_on_sale, ticket_price, ticket_capacity')
    .eq('active', true)
    .order('date', { ascending: true })

  if (error) throw new Error(`dashboard events lookup failed: ${error.message}`)

  const upcoming = (data ?? [])
    .map(e => ({
      ...e,
      date: typeof e.date === 'string' ? e.date : new Date(e.date).toISOString().slice(0, 10),
    }))
    .filter(e => isEventUpcoming({ date: e.date } as EventData))

  const notTicketReady = upcoming.filter(e => unconfiguredReason(e) !== null).length

  const next = upcoming[0]
  if (!next) return { nextShow: null, notTicketReady, queryCount: 1 }

  const ticketsOnSale = next.tickets_on_sale === true

  // Queries 2 and 3, and only for a show that actually sells tickets.
  // describeOccupancy is pure and the capacity is already in hand from
  // query 1, so no second lookup of the event row.
  let occupancy: Occupancy | null = null
  if (ticketsOnSale) {
    const counts = await countAdmissions([next.id])
    occupancy = describeOccupancy(counts.get(next.id), next.ticket_capacity)
  }

  return {
    nextShow: {
      id: next.id,
      name: next.name,
      date: next.date,
      dateLabel: displayEventDate(next.date, next.weekday ?? null),
      ticketsOnSale,
      occupancy,
    },
    notTicketReady,
    queryCount: ticketsOnSale ? 3 : 1,
  }
}
