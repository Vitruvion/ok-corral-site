import { getSupabase } from './supabase'
import { fetchInstagramPosts } from './instagram'
import {
  EVENTS as FALLBACK_EVENTS,
  RECURRING as FALLBACK_RECURRING,
  DRINKS as FALLBACK_DRINKS,
  MERCH as FALLBACK_MERCH,
  DRINK_TABS,
  type EventData,
  type DrinkData,
  type MerchItem,
  type InstagramPost,
} from './data'

type RecurringData = (typeof FALLBACK_RECURRING)[number]

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
  const sb = getSupabase()
  if (!sb) return FALLBACK_EVENTS
  try {
    const { data, error } = await sb
      .from('events')
      .select('id, slug, date, weekday, name, support, time, doors, genre, tickets, tags, description, eventbrite_url, poster_url, featured, related_links, youtube_url')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('date', { ascending: true })
    if (error) throw error
    if (!data || data.length === 0) return FALLBACK_EVENTS
    return data.map(row => ({
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
      eventbrite_url: row.eventbrite_url ?? null,
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
          }))
        : undefined,
      youtube_url: row.youtube_url ?? null,
    }))
  } catch (e) {
    log('events', e)
    return FALLBACK_EVENTS
  }
}

export async function fetchRecurring(): Promise<RecurringData[]> {
  const sb = getSupabase()
  if (!sb) return FALLBACK_RECURRING
  try {
    const { data, error } = await sb
      .from('recurring_events')
      .select('day_abbr, name, support, time, tickets')
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
    }))
  } catch (e) {
    log('recurring', e)
    return FALLBACK_RECURRING
  }
}

export async function fetchDrinks(): Promise<DrinksByCategory> {
  const sb = getSupabase()
  if (!sb) return FALLBACK_DRINKS
  try {
    const { data, error } = await sb
      .from('drinks')
      .select('category, name, tagline, price, description')
      .eq('active', true)
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })
    if (error) throw error
    if (!data || data.length === 0) return FALLBACK_DRINKS
    const grouped: DrinksByCategory = {}
    for (const d of data) {
      const cat = unmojibake(d.category as string)
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push({
        name: m(d.name),
        tagline: m(d.tagline),
        price: m(d.price),
        description: m(d.description),
      })
    }
    // Schema-mismatch guard: if the DB has rows but none of its categories
    // match the current DRINK_TABS (e.g. an old seed wasn't re-run after a
    // menu overhaul), fall back to data.ts so the UI doesn't render empty
    // tabs. Re-run supabase/seed.sql to fix.
    const overlap = Object.keys(grouped).filter(c => DRINK_TABS.includes(c))
    if (overlap.length === 0) {
      log('drinks', `Supabase categories [${Object.keys(grouped).join(', ')}] do not overlap with DRINK_TABS — re-run supabase/seed.sql`)
      return FALLBACK_DRINKS
    }
    return grouped
  } catch (e) {
    log('drinks', e)
    return FALLBACK_DRINKS
  }
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
  const [events, recurring, drinks, merch, igPosts] = await Promise.all([
    fetchEvents(),
    fetchRecurring(),
    fetchDrinks(),
    fetchMerch(),
    fetchInstagramPosts(6),
  ])
  return { events, recurring, drinks, merch, igPosts }
}

export type { InstagramPost }
