import { getServiceSupabase } from '@/lib/supabase'
import { countAdmissions } from '@/lib/tickets/occupancy'
// The SAME upcoming/past rule the homepage uses. Imported rather than
// reimplemented so the editor and filterUpcomingEvents can never
// disagree about what counts as past -- both resolve it against the
// venue's calendar day in America/Los_Angeles.
import { isEventUpcoming, venueTodayParts } from '@/lib/events'
import type { EventData } from '@/lib/data'

/**
 * Admin-side events access.
 *
 * Separate from the public fetchEvents() on purpose: the editor needs
 * ids, inactive rows and every column, none of which the storefront
 * should receive. Writes go through the service-role client, which
 * bypasses RLS -- events has a public READ policy and no public write
 * policy, so this is the only path that can modify a show.
 */

export type AdminEvent = {
  id: string
  slug: string
  date: string
  weekday: string
  name: string
  support: string | null
  time: string
  doors: string | null
  genre: string | null
  tickets: string | null
  tags: string[]
  description: string | null
  poster_url: string | null
  active: boolean
  featured: boolean
  sort_order: number
  youtube_url: string | null
  signup_url: string | null
  related_links: unknown
  tickets_on_sale: boolean
  ticket_price: number | null
  ticket_capacity: number | null
  ticket_blurb: string | null
  /** Admissions already taken: online tickets plus door sales. */
  sold: number
  /** True when the show is today or later in the venue's timezone. */
  upcoming: boolean
}

/**
 * eventbrite_url is deliberately absent. The column still exists and
 * still holds its old values as a record of past shows, but Eventbrite
 * is retired and the editor must not offer a way to put a new value in
 * one.
 */
export const EVENT_COLUMNS =
  'id, slug, date, weekday, name, support, time, doors, genre, tickets, tags, ' +
  'description, poster_url, active, featured, sort_order, youtube_url, signup_url, ' +
  'related_links, tickets_on_sale, ticket_price, ticket_capacity, ticket_blurb'

/** The public bucket event posters live in. Created in Supabase Storage. */
export const POSTER_BUCKET = 'event-posters'

/**
 * The storage path inside one of our public poster URLs, or null.
 *
 * Used to clean up the object a poster is replacing. It only matches
 * paths in OUR bucket, so a poster_url that happens to point somewhere
 * else can never make the delete path remove an unrelated object.
 *
 * Lives here rather than in the route because a Next route module may
 * only export handlers -- exporting a plain function from one fails the
 * build.
 */
export function storageKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const marker = '/storage/v1/object/public/' + POSTER_BUCKET + '/'
  const i = url.indexOf(marker)
  if (i === -1) return null
  const key = url.slice(i + marker.length).split('?')[0]
  return key || null
}

export function serviceClient() {
  const sb = getServiceSupabase()
  if (!sb) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return sb
}

const asDate = (d: unknown): string =>
  typeof d === 'string' ? d : new Date(d as string).toISOString().slice(0, 10)

/**
 * Every event, newest shows first among upcoming, with admission counts.
 *
 * Counts come from the shared occupancy function, so the number here is
 * the same one the checkout gate, the door and /admin/tickets use --
 * online tickets plus door sales.
 */
export async function listEvents(): Promise<AdminEvent[]> {
  const sb = serviceClient()

  const { data, error } = await sb
    .from('events')
    .select(EVENT_COLUMNS)
    .order('date', { ascending: true })

  if (error) throw new Error(`events lookup failed: ${error.message}`)

  const rows = data ?? []
  const admissions = await countAdmissions(rows.map((r: any) => r.id))
  const today = venueTodayParts()

  return rows.map((r: any) => {
    const date = asDate(r.date)
    // isEventUpcoming reads nothing but `date`; `today` is hoisted out
    // of the loop so every row is judged against one instant.
    const upcoming = isEventUpcoming({ date } as EventData, today)

    return {
      ...r,
      date,
      tags: Array.isArray(r.tags) ? r.tags : [],
      active: r.active !== false,
      featured: r.featured === true,
      sort_order: Number(r.sort_order ?? 0),
      tickets_on_sale: r.tickets_on_sale === true,
      ticket_price: r.ticket_price === null || r.ticket_price === undefined ? null : Number(r.ticket_price),
      ticket_capacity:
        r.ticket_capacity === null || r.ticket_capacity === undefined ? null : Number(r.ticket_capacity),
      sold: admissions.get(r.id)?.admitted ?? 0,
      upcoming,
    } as AdminEvent
  })
}

export async function getEvent(id: string): Promise<AdminEvent | null> {
  const all = await listEvents()
  return all.find(e => e.id === id) ?? null
}

// ── Slugs ─────────────────────────────────────────────────────────
/**
 * A URL-safe slug from the show's name.
 *
 * Derived, never typed: nobody adding a show at 11pm should have to
 * think about URL formatting. It is set ONCE at creation and never
 * changes afterwards, even if the show is renamed -- fetchEvents maps
 * `id: row.slug`, so the slug is the handle the public event card and
 * the ticket checkout use, and rewriting it would break links that are
 * already out in the world.
 */
export function slugify(name: string): string {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export async function slugExists(slug: string): Promise<boolean> {
  const sb = serviceClient()
  const { data, error } = await sb.from('events').select('id').eq('slug', slug).maybeSingle()
  if (error) throw new Error(`slug check failed: ${error.message}`)
  return Boolean(data)
}

// ── Weekday ───────────────────────────────────────────────────────
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * The weekday name for a YYYY-MM-DD date.
 *
 * Built from the numeric parts via Date.UTC rather than
 * `new Date('2026-06-25')`, which is parsed as UTC midnight and then
 * reads back a day earlier in Pacific -- the long-standing timezone bug
 * this codebase guards against everywhere else.
 */
export function weekdayFor(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return ''
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return WEEKDAYS[d.getUTCDay()]
}

// ── Featured ──────────────────────────────────────────────────────
/**
 * Moves the featured flag, or clears it when passed null.
 *
 * Prefers the set_featured_event function from migration 0015, which
 * does the whole swap in one transaction so no reader can observe two
 * featured events or none. Falls back to two statements if that
 * migration has not been applied yet -- correct, but with a brief
 * window where nothing is featured, which is a valid state anyway.
 */
export async function setFeatured(id: string | null): Promise<void> {
  const sb = serviceClient()

  const { error } = await sb.rpc('set_featured_event', { target: id })
  if (!error) return

  const missing = /could not find the function|does not exist|schema cache/i.test(error.message)
  if (!missing) throw new Error(`featured swap failed: ${error.message}`)

  console.warn('[events-repo] set_featured_event missing (apply migration 0015) - using fallback')

  // Clear first, then set. Never two featured; briefly none.
  const clear = await sb.from('events').update({ featured: false }).eq('featured', true)
  if (clear.error) throw new Error(`unfeature failed: ${clear.error.message}`)

  if (id) {
    const set = await sb.from('events').update({ featured: true }).eq('id', id)
    if (set.error) throw new Error(`feature failed: ${set.error.message}`)
  }
}

// ── Deletion ──────────────────────────────────────────────────────
export type DeleteOutcome = { mode: 'removed' } | { mode: 'deactivated'; orders: number }

/**
 * Removes a show, or retires it if anyone has bought a ticket.
 *
 * A show with orders is NEVER hard-deleted: ticket_orders references
 * events with ON DELETE RESTRICT, so the database would refuse anyway,
 * but more importantly someone holding a ticket needs that row to
 * exist for the door to scan them in. It goes inactive instead, which
 * removes it from the site while keeping every order intact.
 */
export async function deleteEvent(id: string): Promise<DeleteOutcome> {
  const sb = serviceClient()

  const { count, error: cErr } = await sb
    .from('ticket_orders')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', id)

  if (cErr) throw new Error(`order check failed: ${cErr.message}`)

  const orders = count ?? 0
  if (orders > 0) {
    const { error } = await sb
      .from('events')
      .update({ active: false, featured: false, tickets_on_sale: false })
      .eq('id', id)
    if (error) throw new Error(`deactivate failed: ${error.message}`)
    return { mode: 'deactivated', orders }
  }

  const { error } = await sb.from('events').delete().eq('id', id)
  if (error) throw new Error(`delete failed: ${error.message}`)
  return { mode: 'removed' }
}
