import { getSupabase } from './supabase'
import { fetchInstagramPosts } from './instagram'
import {
  EVENTS as FALLBACK_EVENTS,
  RECURRING as FALLBACK_RECURRING,
  DRINKS as FALLBACK_DRINKS,
  MERCH as FALLBACK_MERCH,
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

export async function fetchEvents(): Promise<EventData[]> {
  const sb = getSupabase()
  if (!sb) return FALLBACK_EVENTS
  try {
    const { data, error } = await sb
      .from('events')
      .select('id, slug, date, weekday, name, support, time, doors, genre, tickets, tags, description')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('date', { ascending: true })
    if (error) throw error
    if (!data || data.length === 0) return FALLBACK_EVENTS
    return data.map(row => ({
      id: row.slug ?? row.id,
      date: typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10),
      weekday: row.weekday,
      name: row.name,
      support: row.support ?? '',
      time: row.time,
      doors: row.doors ?? '',
      genre: row.genre ?? '',
      tickets: row.tickets ?? '',
      tags: row.tags ?? [],
      description: row.description ?? '',
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
      day: r.day_abbr,
      name: r.name,
      support: r.support ?? '',
      time: r.time ?? '',
      tickets: r.tickets ?? '',
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
      const cat = d.category as string
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push({
        name: d.name,
        tagline: d.tagline ?? '',
        price: d.price,
        description: d.description ?? '',
      })
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
    return data.map(m => ({
      id: m.slug ?? m.id,
      name: m.name,
      category: m.category,
      price: Number(m.price),
      badge: m.badge ?? undefined,
      color: m.color ?? '',
      sizes: m.sizes ?? [],
      image: m.image_url ?? undefined,
      imageBg: m.image_bg === 'bone' ? 'bone' : undefined,
      description: m.description ?? '',
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
