import { serviceClient } from './repo'

/**
 * THE one answer to "how full is this show".
 *
 * ═══════════════════════════════════════════════════════════════════
 * Before this existed there were five hand-rolled counts: the checkout
 * gate, the availability endpoint, the webhook's oversell re-check, the
 * /admin/tickets manifest, and the door picker. Four of them only
 * counted rows in `tickets`, which meant a door sale consumed a seat
 * that online checkout would happily sell again.
 *
 * A partial fix would have been worse than none. Five places answering
 * nearly the same question is the bug surface itself: fix three and the
 * other two disagree silently, and nothing tells you which number the
 * room is actually at. So every one of them now reads from here.
 *
 * WHAT COUNTS
 *   non-void rows in `tickets`              -- online, one row per seat
 * + sum(quantity) over PAID DOOR orders     -- door, a tally, no rows
 *
 * Online orders are deliberately NOT summed. They issue rows in
 * `tickets`, so counting the orders too would double every online seat.
 * `ticket_orders.channel` is the discriminator and the only one.
 *
 * CAPACITY IS NULLABLE AND THAT IS NORMAL. Null means unlimited: no
 * sold-out state, no warning, no "N of M" anywhere. Every field derived
 * from capacity is null in that case rather than a sentinel number, so
 * a caller cannot accidentally treat "unlimited" as zero.
 * ═══════════════════════════════════════════════════════════════════
 */

/** Raw counts, before capacity is considered. */
export type AdmissionCounts = {
  /** Non-void rows in `tickets`. One per online seat. */
  ticketsIssued: number
  /** Sum of quantity over paid door orders. Issues no ticket rows. */
  doorAdmissions: number
  /** The number that matters: everyone who holds a seat. */
  admitted: number
}

export type Occupancy = AdmissionCounts & {
  /** Null means unlimited. */
  capacity: number | null
  /** Null when capacity is null. Can go negative when oversold. */
  remaining: number | null
  /** Always false when capacity is null. */
  soldOut: boolean
}

const EMPTY: AdmissionCounts = { ticketsIssued: 0, doorAdmissions: 0, admitted: 0 }

/**
 * Counts admissions for many events in two queries.
 *
 * Batched because both the manifest and the door picker need every
 * event at once, and doing it per-event would be a query per row.
 */
export async function countAdmissions(
  eventIds: string[]
): Promise<Map<string, AdmissionCounts>> {
  const out = new Map<string, AdmissionCounts>()
  if (eventIds.length === 0) return out

  const sb = serviceClient()

  const [{ data: tickets, error: tErr }, { data: doorOrders, error: dErr }] = await Promise.all([
    sb.from('tickets').select('event_id').in('event_id', eventIds).neq('status', 'void'),
    sb
      .from('ticket_orders')
      .select('event_id, quantity')
      .in('event_id', eventIds)
      .eq('channel', 'door')
      .eq('status', 'paid'),
  ])

  if (tErr) throw new Error(`ticket count failed: ${tErr.message}`)
  if (dErr) throw new Error(`door admission count failed: ${dErr.message}`)

  const bump = (id: string, field: 'ticketsIssued' | 'doorAdmissions', by: number) => {
    const cur = out.get(id) ?? { ...EMPTY }
    cur[field] += by
    cur.admitted = cur.ticketsIssued + cur.doorAdmissions
    out.set(id, cur)
  }

  for (const t of tickets ?? []) bump(t.event_id, 'ticketsIssued', 1)
  for (const o of doorOrders ?? []) bump(o.event_id, 'doorAdmissions', Number(o.quantity) || 0)

  return out
}

/** Counts for one event, zeroed rather than absent when there are none. */
export async function countAdmissionsFor(eventId: string): Promise<AdmissionCounts> {
  return (await countAdmissions([eventId])).get(eventId) ?? { ...EMPTY }
}

/**
 * Pure: combines counts with a capacity.
 *
 * Separate from the query so callers that already hold the event row --
 * the manifest, the door picker -- do not fetch capacity a second time.
 */
export function describeOccupancy(
  counts: AdmissionCounts | undefined,
  capacity: number | null | undefined
): Occupancy {
  const c = counts ?? { ...EMPTY }
  const cap = capacity === null || capacity === undefined ? null : Number(capacity)

  if (cap === null) {
    // Unlimited. Nothing derived from capacity is meaningful, and a
    // zero here would read as "sold out" to a careless caller.
    return { ...c, capacity: null, remaining: null, soldOut: false }
  }

  const remaining = cap - c.admitted
  return { ...c, capacity: cap, remaining, soldOut: remaining <= 0 }
}

/**
 * The whole picture for one event.
 *
 * Pass `capacity` when the caller already has the events row; omit it
 * and it is fetched.
 */
export async function getOccupancy(
  eventId: string,
  capacity?: number | null
): Promise<Occupancy> {
  let cap = capacity
  if (cap === undefined) {
    const sb = serviceClient()
    const { data, error } = await sb
      .from('events')
      .select('ticket_capacity')
      .eq('id', eventId)
      .maybeSingle()
    if (error) throw new Error(`event capacity lookup failed: ${error.message}`)
    cap = data?.ticket_capacity ?? null
  }
  return describeOccupancy(await countAdmissionsFor(eventId), cap)
}
