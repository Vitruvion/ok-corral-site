import { serviceClient } from './repo'
import { signTicket } from './codes'
import { displayEventDate } from './complete'

/**
 * Server side of the door scanner.
 *
 * ═══════════════════════════════════════════════════════════════════
 * WHY THE SERVER SIGNS THE MANIFEST INSTEAD OF THE CLIENT VERIFYING
 *
 * The scanner has to answer "is this ticket genuine?" with no network.
 * The obvious way is to give the browser TICKET_SIGNING_SECRET and let
 * it recompute the HMAC. That is not done here, and must never be.
 *
 * Anything the browser can read, a person can read. A secret in a JS
 * bundle, in a NEXT_PUBLIC_ variable, or fetched into memory is one
 * devtools tab away from being copied -- and whoever has it can mint a
 * ticket for any show that passes the door check perfectly. It would
 * also be unrotatable in practice: every phone that ever loaded the
 * scanner would have had a copy.
 *
 * So the signature is computed HERE, once per ticket, and shipped as
 * part of the manifest. The client compares two strings. It can verify
 * every ticket it has been told about and cannot forge one, because it
 * never holds the key -- it holds a list of answers, not the ability
 * to compute new ones.
 *
 * The trade is that a code absent from the manifest cannot be verified
 * offline. That is the correct failure: it falls through to NOT FOUND
 * and gets re-queried the moment there is a network. A ticket bought
 * after the manifest loaded is indistinguishable from a forgery
 * offline, and pretending otherwise would be worse than saying so.
 * ═══════════════════════════════════════════════════════════════════
 *
 * The manifest carries purchaser names and ticket codes. It is behind
 * the admin cookie and must never be served unauthenticated.
 */

export type DoorEvent = {
  id: string
  slug: string
  name: string
  date: string
  dateLabel: string
  time: string | null
  doors: string | null
  issued: number
  used: number
}

export type ManifestTicket = {
  code: string
  /** The expected signature. See the note above: the client compares, never computes. */
  sig: string
  status: 'valid' | 'used' | 'void'
  used_at: string | null
  used_by: string | null
  purchaser_name: string | null
  order_id: string
  /** Ordinal within the order -- the "1 of 2" on the result screen. */
  seq: number
  /** How many tickets the order holds, so "1 of 2" can be rendered. */
  order_size: number
}

export type DoorManifest = {
  event: DoorEvent
  tickets: ManifestTicket[]
  /** Server clock at build time. The client shows age against this. */
  generated_at: string
}

/** Events worth opening a door for: nearest date first. */
export async function listDoorEvents(): Promise<DoorEvent[]> {
  const sb = serviceClient()

  const { data: events, error } = await sb
    .from('events')
    .select('id, slug, name, date, weekday, time, doors, tickets_on_sale')
    .eq('tickets_on_sale', true)
    .order('date', { ascending: true })

  if (error) throw new Error(`door event list failed: ${error.message}`)
  if (!events?.length) return []

  const { data: tickets, error: tErr } = await sb
    .from('tickets')
    .select('event_id, status')
    .in('event_id', events.map(e => e.id))

  if (tErr) throw new Error(`door ticket counts failed: ${tErr.message}`)

  const counts = new Map<string, { issued: number; used: number }>()
  for (const t of tickets ?? []) {
    if (t.status === 'void') continue
    const c = counts.get(t.event_id) ?? { issued: 0, used: 0 }
    c.issued += 1
    if (t.status === 'used') c.used += 1
    counts.set(t.event_id, c)
  }

  return events.map(e => toDoorEvent(e, counts.get(e.id)))
}

function toDoorEvent(row: any, count?: { issued: number; used: number }): DoorEvent {
  const date =
    typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10)
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    date,
    dateLabel: displayEventDate(date, row.weekday ?? null),
    time: row.time ?? null,
    doors: row.doors ?? null,
    issued: count?.issued ?? 0,
    used: count?.used ?? 0,
  }
}

/**
 * Every ticket for one event, each with its expected signature.
 *
 * Void tickets are included rather than filtered out. A refunded
 * ticket that someone still has the email for should say so at the
 * door, not read as "not on the list" -- which looks like a system
 * failure and invites an argument.
 */
export async function buildManifest(eventId: string): Promise<DoorManifest | null> {
  const sb = serviceClient()

  const { data: event, error: evErr } = await sb
    .from('events')
    .select('id, slug, name, date, weekday, time, doors, tickets_on_sale')
    .eq('id', eventId)
    .maybeSingle()

  if (evErr) throw new Error(`event lookup failed: ${evErr.message}`)
  if (!event) return null

  const { data: rows, error } = await sb
    .from('tickets')
    .select('code, status, used_at, used_by, order_id, seq, ticket_orders(purchaser_name, quantity)')
    .eq('event_id', eventId)
    .order('seq', { ascending: true })

  if (error) throw new Error(`manifest build failed: ${error.message}`)

  let used = 0
  let issued = 0

  const tickets: ManifestTicket[] = (rows ?? []).map((r: any) => {
    // Supabase returns an embedded to-one relation as an object, but
    // types it as a possible array. Normalise before reading it.
    const order = Array.isArray(r.ticket_orders) ? r.ticket_orders[0] : r.ticket_orders
    if (r.status !== 'void') {
      issued += 1
      if (r.status === 'used') used += 1
    }
    return {
      code: String(r.code),
      sig: signTicket(String(r.code), eventId),
      status: r.status,
      used_at: r.used_at ?? null,
      used_by: r.used_by ?? null,
      purchaser_name: order?.purchaser_name ?? null,
      order_id: r.order_id,
      seq: Number(r.seq),
      order_size: Number(order?.quantity ?? 1),
    }
  })

  return {
    event: toDoorEvent(event, { issued, used }),
    tickets,
    generated_at: new Date().toISOString(),
  }
}
