import { type EventData } from './data'

/**
 * The venue's local timezone. The OK Corral is in Cottonwood, CA, so all
 * "is this event in the past?" decisions are made against the current
 * calendar day in Pacific Time — NOT the server's timezone (Vercel runs in
 * UTC) and NOT the visitor's browser timezone.
 */
export const VENUE_TZ = 'America/Los_Angeles'

type DateParts = { y: number; m: number; d: number }

/**
 * The current calendar day at the venue, as numeric {y, m, d}.
 *
 * Built from an absolute instant (`now`) projected into America/Los_Angeles
 * via Intl, so the result is identical no matter where the code runs:
 *   - Vercel server (UTC) at 2026-06-18T06:00Z  -> { 2026, 6, 17 } (still the 17th in PT)
 *   - A browser in New York at the same instant  -> { 2026, 6, 17 } (same — we ignore the visitor's tz)
 * Intl also handles DST transitions correctly (PDT vs PST offsets).
 */
export function venueTodayParts(now: Date = new Date()): DateParts {
  // formatToParts is locale-independent for the numeric field values, so the
  // separator/order of the chosen locale is irrelevant — we read the fields by name.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: VENUE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value)
  return { y: get('year'), m: get('month'), d: get('day') }
}

/**
 * Extracts numeric {y, m, d} from an event's `date` string. Handles both
 * shapes the app produces:
 *   - "YYYY-MM-DD"   (Supabase date columns, via fetchEvents)
 *   - "Month D YYYY" (data.ts fallback, e.g. "June 25 2026")
 *
 * The ISO form is parsed by regex (NOT `new Date('2026-06-25')`, which the
 * constructor reads as UTC midnight and then `getDate()` rolls back a day in
 * negative-offset zones — the long-standing TZ bug this codebase guards
 * against). The "Month D YYYY" form is read via Date component getters, which
 * are timezone-agnostic for a date-only string.
 *
 * Returns null when the string can't be parsed.
 */
export function eventDateParts(s: string): DateParts | null {
  if (!s) return null
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }
}

/** Compares two {y,m,d} triples. Returns <0, 0, or >0 like a comparator. */
function compareParts(a: DateParts, b: DateParts): number {
  return a.y - b.y || a.m - b.m || a.d - b.d
}

/**
 * True when an event should still be shown: its date is today or later in the
 * venue's timezone. The comparison is DATE-only — an event on June 17 with a
 * 9:30 PM start stays visible all day June 17 and disappears at 00:00 June 18
 * (Pacific), regardless of its start/end time.
 *
 * Fails open: an event whose date can't be parsed is kept rather than silently
 * hidden, so a formatting quirk never makes a show vanish.
 */
export function isEventUpcoming(event: EventData, today: DateParts = venueTodayParts()): boolean {
  const ev = eventDateParts(event.date)
  if (!ev) return true
  return compareParts(ev, today) >= 0
}

/**
 * Filters an event list down to today-or-later (venue timezone), preserving
 * the input order. Apply this at every event data source so past shows
 * disappear automatically at midnight Pacific without anyone editing the DB.
 */
export function filterUpcomingEvents(events: EventData[], now: Date = new Date()): EventData[] {
  const today = venueTodayParts(now)
  return events.filter(e => isEventUpcoming(e, today))
}
