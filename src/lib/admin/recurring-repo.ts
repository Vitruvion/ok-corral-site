import { sortRecurring } from '@/lib/recurring'
import { POSTER_BUCKET, serviceClient, storageKeyFromUrl } from './events-repo'

/**
 * Admin-side access to recurring_events -- the weekly specials.
 *
 * Kept apart from events on purpose. A weekly special has no date, no
 * tickets and no "past", so none of the ticketing, occupancy or door
 * code ever reads this table, and nothing here touches theirs.
 *
 * Writes go through the service-role client: recurring_events has a
 * public READ policy (active rows only) and no public write policy.
 */

export type AdminRecurring = {
  id: string
  /** 'MON'..'SUN'. Column: day_abbr. */
  day: string
  name: string
  /** The tagline under the name. */
  support: string | null
  /** Display string in the grammar of src/lib/recurring.ts. */
  time: string | null
  /** Price line, e.g. 'No Cover'. */
  tickets: string | null
  poster_url: string | null
  active: boolean
  sort_order: number
}

export const RECURRING_COLUMNS =
  'id, day_abbr, name, support, time, tickets, poster_url, active, sort_order'

function toAdmin(r: any): AdminRecurring {
  return {
    id: String(r.id),
    day: String(r.day_abbr ?? ''),
    name: String(r.name ?? ''),
    support: r.support ?? null,
    time: r.time ?? null,
    tickets: r.tickets ?? null,
    poster_url: r.poster_url ?? null,
    // The column is nullable, and the public policy shows only
    // `active = true`. Reading null as hidden keeps the editor in
    // agreement with what the site actually shows.
    active: r.active === true,
    sort_order: Number(r.sort_order ?? 0),
  }
}

/** Every weekly special, hidden ones included, Monday first. */
export async function listRecurring(): Promise<AdminRecurring[]> {
  const sb = serviceClient()
  const { data, error } = await sb.from('recurring_events').select(RECURRING_COLUMNS)
  if (error) throw new Error(`recurring lookup failed: ${error.message}`)
  return sortRecurring((data ?? []).map(toAdmin))
}

export async function getRecurring(id: string): Promise<AdminRecurring | null> {
  const sb = serviceClient()
  const { data, error } = await sb
    .from('recurring_events')
    .select(RECURRING_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(`recurring lookup failed: ${error.message}`)
  return data ? toAdmin(data) : null
}

/**
 * Deletes a weekly special outright, and its poster with it.
 *
 * Always a hard delete. Shows fall back to hiding when tickets or paid
 * orders point at them; nothing can point at a weekly special, so there
 * is nothing to keep it for. Hiding is a separate, explicit action.
 */
export async function deleteRecurring(id: string): Promise<{ posterRemoved: string | null }> {
  const sb = serviceClient()

  // Read the poster before the row goes; afterwards there is nothing
  // left to read the URL from.
  const current = await getRecurring(id)
  const posterKey = storageKeyFromUrl(current?.poster_url)

  const { error } = await sb.from('recurring_events').delete().eq('id', id)
  if (error) throw new Error(`delete failed: ${error.message}`)

  // Only after the row is gone. An orphaned object costs a few KB;
  // deleting one a row still points at would show a broken image. A
  // poster under /assets/ (the seeded Monday flyer) is not in the bucket,
  // storageKeyFromUrl returns null for it, and it is left alone.
  let posterRemoved: string | null = null
  if (posterKey) {
    const { error: rmErr } = await sb.storage.from(POSTER_BUCKET).remove([posterKey])
    if (rmErr) console.warn('[recurring-repo] could not remove poster', posterKey, rmErr.message)
    else posterRemoved = posterKey
  }
  return { posterRemoved }
}
