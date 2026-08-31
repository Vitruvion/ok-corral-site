import { getSupabase } from './supabase'
import { fetchInstagramPosts } from './instagram'
import { filterUpcomingEvents } from './events'
import {
  RECURRING as FALLBACK_RECURRING,
  MERCH as FALLBACK_MERCH,
  DRINK_TABS,
  SHOW_MERCH,
  type EventData,
  type RecurringEvent,
  type DrinkData,
  type MerchItem,
  type InstagramPost,
} from './data'

type RecurringData = RecurringEvent

type DrinksByCategory = Record<string, DrinkData[]>

const log = (label: string, err: unknown) => {
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[supabase:${label}] falling back to data.ts —`, err)
  }
}

/**
 * Self-heal mojibake (UTF-8 bytes that were interpreted as Latin-1 and then
 * re-encoded back to UTF-8 — e.g. "·" becomes "Â·", "—" becomes "â€\"") .
 *
 * The transformation is exact: every char in the input is treated as a
 * single byte (low 8 bits of its codepoint), the resulting byte stream is
 * decoded as UTF-8, and on success that's the original string.
 *
 * Guarded so legitimate strings without telltale chars pass through
 * untouched, and falls back to the original on any decode error.
 */
function unmojibake(s: string): string {
  if (!s) return s
  // Only attempt if the input contains characters that strongly suggest
  // mojibake — bare Â or â means we're almost certainly looking at
  // UTF-8-as-Latin-1 round-tripping.
  if (!/[À-ÿ]/.test(s)) return s
  try {
    const bytes = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) {
      const cp = s.charCodeAt(i)
      if (cp > 0xff) return s // contains a codepoint that can't have come from a byte
      bytes[i] = cp
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return s
  }
}

/** Apply unmojibake to a possibly-null/undefined string field, preserving nullishness. */
const m = (v: string | null | undefined): string => v ? unmojibake(v) : ''
const mn = (v: string | null | undefined): string | null => v ? unmojibake(v) : null

export async function fetchEvents(): Promise<EventData[]> {
  // Past events are hidden everywhere by filtering on the venue's calendar day
  // (America/Los_Angeles) at render time — see src/lib/events.ts. Rows are left
  // active in the DB so history is preserved and no manual cleanup is needed.
  // Filtering runs server-side on each (re)render; page.tsx uses ISR
  // (revalidate=60), so an event's midnight-PT rollover takes effect on the next
  // regeneration — typically within ~60s under steady traffic. Because ISR is
  // stale-while-revalidate, the first request after the window still gets the
  // cached page, so on a low-traffic night a just-passed event can briefly
  // linger until a couple of requests come in. Acceptable: it self-heals on the
  // following request and the DB is never touched.
  const sb = getSupabase()
  // No hardcoded fallback: events live only in Supabase now that they
  // are edited at /admin/events. An empty list is honest; a months-old
  // lineup presented as tonight's is not.
  if (!sb) return []
  try {
    const { data, error } = await sb
      .from('events')
      .select('id, slug, date, weekday, name, support, time, doors, genre, tickets, tags, description, signup_url, poster_url, featured, related_links, youtube_url, tickets_on_sale, ticket_price, ticket_blurb')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('date', { ascending: true })
    if (error) throw error
    if (!data || data.length === 0) return []
    return filterUpcomingEvents(data.map(row => ({
      id: row.slug ?? row.id,
      date: typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10),
      weekday: m(row.weekday),
      name: m(row.name),
      support: m(row.support),
      time: m(row.time),
      doors: m(row.doors),
      genre: m(row.genre),
      tickets: m(row.tickets),
      tags: (row.tags ?? []).map(unmojibake),
      description: m(row.description),
      signup_url: row.signup_url ?? null,
      poster_url: row.poster_url ?? null,
      featured: !!row.featured,
      // Normalize related_links: unmojibake the name/role strings on the way
      // through. URL/image fields are pass-through.
      related_links: Array.isArray(row.related_links)
        ? row.related_links.map((l: any) => ({
            name: l?.name ? unmojibake(String(l.name)) : '',
            url: String(l?.url ?? ''),
            image: l?.image ? String(l.image) : undefined,
            role: l?.role ? unmojibake(String(l.role)) : undefined,
            skipFirstInDescription: l?.skipFirstInDescription === true,
          }))
        : undefined,
      youtube_url: row.youtube_url ?? null,
      // Direct ticket sales. Absent columns (a database that has not run
      // migration 0012 yet) read as "not on sale", which is exactly the
      // old behaviour.
      tickets_on_sale: row.tickets_on_sale === true,
      ticket_price: row.ticket_price === null || row.ticket_price === undefined
        ? null
        : Number(row.ticket_price),
      ticket_blurb: row.ticket_blurb ? m(row.ticket_blurb) : null,
    })))
  } catch (e) {
    log('events', e)
    return []
  }
}

export async function fetchRecurring(): Promise<RecurringData[]> {
  const sb = getSupabase()
  if (!sb) return FALLBACK_RECURRING
  try {
    const { data, error } = await sb
      .from('recurring_events')
      .select('day_abbr, name, support, time, tickets, poster_url')
      .eq('active', true)
      .order('sort_order', { ascending: true })
    if (error) throw error
    if (!data || data.length === 0) return FALLBACK_RECURRING
    return data.map(r => ({
      day: m(r.day_abbr),
      name: m(r.name),
      support: m(r.support),
      time: m(r.time),
      tickets: m(r.tickets),
      poster_url: r.poster_url ?? null,
    }))
  } catch (e) {
    log('recurring', e)
    return FALLBACK_RECURRING
  }
}

/**
 * THE drinks query. Single source of truth for every consumer: the homepage
 * via fetchAll(), and the /menu-board TV display.
 *
 * Returns only active drinks, grouped by category, each group already in
 * sort_order. Drinks are authoritative in Supabase now that they're edited
 * through /admin/menu, so there is deliberately no data.ts fallback — a
 * fallback would quietly serve stale hardcoded prices over the bar's real
 * ones.
 *
 * THROWS on failure rather than returning {}. That distinction matters for
 * the TV: an empty render is a SUCCESSFUL render, so ISR would cache the
 * blank page and the bar would stare at an empty menu board until the next
 * good revalidation. Throwing makes Next keep serving the last good cached
 * page instead, and /menu-board/error.tsx covers the cold case.
 *
 * A query that succeeds with zero rows is NOT a failure — that's a genuinely
 * empty menu, and it returns {} normally. Only the error channel throws.
 * Callers that would rather degrade than fail (fetchAll) catch it themselves.
 */
export async function getDrinks(): Promise<DrinksByCategory> {
  const sb = getSupabase()
  // Missing config is a failure, not an empty menu.
  if (!sb) throw new Error('drinks unavailable: Supabase is not configured')

  const { data, error } = await sb
    .from('drinks')
    .select('category, name, tagline, price, description')
    .eq('active', true)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) throw new Error(`drinks query failed: ${error.message}`)

  // supabase-js gives [] for a successful empty result; error is the only
  // failure signal, so a null here is treated as empty rather than fatal.
  const rows = data ?? []

  const grouped: DrinksByCategory = {}
  for (const d of rows) {
    const cat = unmojibake(d.category as string)
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push({
      name: m(d.name),
      tagline: m(d.tagline),
      price: m(d.price),
      description: m(d.description),
    })
  }
  return grouped
}

/**
 * Category display order, shared by the homepage tabs and the menu board so
 * the two never disagree.
 *
 * DRINK_TABS first, in its curated order, then any category the editor has
 * since invented — appended alphabetically rather than dropped, so a new
 * category created at /admin/menu shows up instead of silently vanishing.
 */
export function orderDrinkCategories(drinks: DrinksByCategory): string[] {
  const known = DRINK_TABS.filter(t => drinks[t]?.length)
  const extra = Object.keys(drinks)
    .filter(c => !DRINK_TABS.includes(c) && drinks[c]?.length)
    .sort()
  return [...known, ...extra]
}

export async function fetchMerch(): Promise<MerchItem[]> {
  const sb = getSupabase()
  if (!sb) return FALLBACK_MERCH
  try {
    const { data, error } = await sb
      .from('merch')
      .select('id, slug, name, category, price, badge, color, sizes, image_url, image_bg, description')
      .eq('active', true)
      .order('sort_order', { ascending: true })
    if (error) throw error
    if (!data || data.length === 0) return FALLBACK_MERCH
    return data.map(row => ({
      id: row.slug ?? row.id,
      name: m(row.name),
      category: m(row.category),
      price: Number(row.price),
      badge: row.badge ? unmojibake(row.badge) : undefined,
      color: m(row.color),
      sizes: (row.sizes ?? []).map(unmojibake),
      image: row.image_url ?? undefined,
      imageBg: row.image_bg === 'bone' ? 'bone' : undefined,
      description: m(row.description),
    }))
  } catch (e) {
    log('merch', e)
    return FALLBACK_MERCH
  }
}

export async function fetchAll() {
  // With SHOW_MERCH off nothing renders the catalog, but anything returned
  // here still gets serialized into the page's RSC payload — product names,
  // prices and descriptions would sit in view-source for a store that isn't
  // open. Skip the query entirely instead.
  //
  // NOTE: this gates only the page payload. fetchMerch() stays callable and
  // is used directly by src/lib/catalog.ts to price checkouts server-side,
  // so /api/checkout keeps working while the storefront is hidden.
  const [events, recurring, drinks, merch, igPosts] = await Promise.all([
    fetchEvents(),
    fetchRecurring(),
    // The homepage would rather lose its drinks section than 500 outright:
    // events, gallery, hours and everything else still render. The TV gets
    // the opposite treatment — see getDrinks().
    getDrinks().catch(err => {
      log('drinks', err)
      return {} as DrinksByCategory
    }),
    SHOW_MERCH ? fetchMerch() : Promise.resolve<MerchItem[]>([]),
    fetchInstagramPosts(6),
  ])
  return { events, recurring, drinks, merch, igPosts }
}

export type { InstagramPost }
