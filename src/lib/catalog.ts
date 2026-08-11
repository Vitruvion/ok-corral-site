import { fetchMerch } from './queries'
import type { MerchItem } from './data'

/**
 * Server-side price resolution for checkout.
 *
 * The browser is never trusted for anything that affects what a customer is
 * charged. It sends item IDs and quantities; every price, name, colour and
 * variant is looked up here from the catalog (Supabase `merch`, falling back
 * to data.ts exactly as the storefront does). Previously /api/checkout billed
 * whatever `price` the request body claimed, so a crafted request could buy
 * any item for a penny — and could also inflate the subtotal to unlock the
 * free-shipping tier.
 */

/** Per-item ceiling, after duplicate lines are merged. */
export const MAX_QTY_PER_ITEM = 25
/** Distinct cart lines accepted in one request. */
export const MAX_DISTINCT_LINES = 50

/** What the client is allowed to send. Anything else in the body is ignored. */
export type ClientLine = {
  id?: unknown
  /** Legacy fallback key only — never a price source. See resolveCartLines. */
  name?: unknown
  qty?: unknown
  size?: unknown
}

export type ResolvedLine = {
  /** The catalog row — the ONLY source of price/name/colour. */
  item: MerchItem
  qty: number
  /** Validated against the item's own size list, or undefined. */
  size?: string
}

export type CartResolution =
  | { ok: true; lines: ResolvedLine[]; subtotal: number }
  | { ok: false; error: string }

const isPositiveInt = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0

/**
 * Turns an untrusted cart payload into priced lines plus a server-computed
 * subtotal. Rejects unknown items, bad quantities and invalid variants.
 */
export async function resolveCartLines(rawItems: unknown): Promise<CartResolution> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return { ok: false, error: 'Cart is empty.' }
  }
  if (rawItems.length > MAX_DISTINCT_LINES) {
    return { ok: false, error: 'Too many items in cart.' }
  }

  const catalog = await fetchMerch()
  if (!catalog || catalog.length === 0) {
    // Never guess at prices. Better a failed checkout than a mispriced one.
    return { ok: false, error: 'Store catalog unavailable. Try again shortly.' }
  }

  const byId = new Map<string, MerchItem>()
  const byName = new Map<string, MerchItem>()
  for (const item of catalog) {
    if (item.id) byId.set(String(item.id), item)
    // Secondary key so a cart built against the data.ts fallback (ids like
    // "m1") still resolves when Supabase is serving slugs, and vice versa.
    // Only ever used to FIND the row — the price still comes from the row.
    if (item.name) byName.set(item.name.trim().toLowerCase(), item)
  }

  // Merge duplicate lines before applying the cap, so two lines of 25 can't
  // smuggle through 50 of the same thing.
  const merged = new Map<string, ResolvedLine>()

  for (const raw of rawItems as ClientLine[]) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'Invalid cart item.' }
    }

    if (!isPositiveInt(raw.qty)) {
      return { ok: false, error: 'Quantity must be a whole number of at least 1.' }
    }

    const id = typeof raw.id === 'string' ? raw.id.trim() : ''
    const name = typeof raw.name === 'string' ? raw.name.trim().toLowerCase() : ''
    const item = (id && byId.get(id)) || (name && byName.get(name)) || null

    if (!item) {
      return { ok: false, error: `Item not found: ${id || raw.name || 'unknown'}` }
    }

    // Variants: only a value the item actually offers is allowed through, so
    // arbitrary client text can never reach the Stripe line description.
    let size: string | undefined
    const offered = Array.isArray(item.sizes) ? item.sizes : []
    if (offered.length > 0) {
      const requested = typeof raw.size === 'string' ? raw.size.trim() : ''
      if (!requested) {
        size = offered[0]
      } else {
        const match = offered.find(s => s.toLowerCase() === requested.toLowerCase())
        if (!match) {
          return { ok: false, error: `Unavailable size for ${item.name}.` }
        }
        size = match
      }
    }
    // Items without a size list get no size, whatever the client claimed.

    const key = `${item.id}::${size ?? ''}`
    const existing = merged.get(key)
    const qty = (existing?.qty ?? 0) + raw.qty

    if (qty > MAX_QTY_PER_ITEM) {
      return {
        ok: false,
        error: `Limit ${MAX_QTY_PER_ITEM} per item — reduce the quantity of ${item.name}.`,
      }
    }

    merged.set(key, { item, qty, size })
  }

  const lines = [...merged.values()]

  // Prices come only from catalog rows, so this subtotal — and therefore the
  // shipping tier derived from it — cannot be influenced by the request.
  const subtotal = lines.reduce((sum, l) => sum + Number(l.item.price) * l.qty, 0)

  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return { ok: false, error: 'Could not price this cart.' }
  }

  return { ok: true, lines, subtotal }
}
