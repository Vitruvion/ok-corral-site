/**
 * Weekly specials -- the homepage "Every Week" strip and its editor.
 *
 * Pure and dependency-free on purpose: the editor (browser), the admin
 * API and the public query all import it, so there is ONE answer to
 * "what day is this", "what does its time say" and "what order do they
 * go in".
 *
 * WHY THE TIME IS TEXT. recurring_events.time has always been the
 * display string -- "7:30 PM", "All Day", "6 PM" -- and the homepage
 * prints it verbatim. Rather than add structured columns and backfill
 * the rows already there, the editor builds that string from real
 * inputs (a time picker, an optional end) via formatWeeklyTime, and
 * reads it back with parseWeeklyTime. Because the editor is the only
 * writer and always writes this exact grammar, parsing it is a round
 * trip, not a guess:
 *
 *   All Day
 *   7 PM            7:30 PM
 *   6–11 PM         11 AM–2 PM      (en dash; meridiem omitted on the
 *                                    start only when both share it)
 *   6 PM til late
 */

export type DayAbbr = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'

/** Monday first: the order the site and the editor list them in. */
export const WEEK_DAYS: readonly { abbr: DayAbbr; short: string; long: string }[] = [
  { abbr: 'MON', short: 'Mon', long: 'Monday' },
  { abbr: 'TUE', short: 'Tue', long: 'Tuesday' },
  { abbr: 'WED', short: 'Wed', long: 'Wednesday' },
  { abbr: 'THU', short: 'Thu', long: 'Thursday' },
  { abbr: 'FRI', short: 'Fri', long: 'Friday' },
  { abbr: 'SAT', short: 'Sat', long: 'Saturday' },
  { abbr: 'SUN', short: 'Sun', long: 'Sunday' },
]

export const DAY_ABBRS = WEEK_DAYS.map(d => d.abbr) as [DayAbbr, ...DayAbbr[]]

export function isDayAbbr(v: unknown): v is DayAbbr {
  return typeof v === 'string' && (DAY_ABBRS as string[]).includes(v)
}

/** 'SUN' -> 'Sunday'. Anything unrecognised comes back as it was. */
export function dayName(abbr: string): string {
  return WEEK_DAYS.find(d => d.abbr === abbr)?.long ?? abbr
}

/** Monday = 0 ... Sunday = 6; an unknown day sorts after Sunday. */
export function dayIndex(abbr: string): number {
  const i = DAY_ABBRS.indexOf(abbr as DayAbbr)
  return i === -1 ? DAY_ABBRS.length : i
}

// ── Time ──────────────────────────────────────────────────────────
/** Times are 24-hour "HH:MM" -- exactly what <input type="time"> yields. */
export type WeeklyTime =
  | { allDay: true }
  | { allDay: false; start: string; end: string | null; late: boolean }

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

const DASH = '–'

function split(hhmm: string): { h12: number; min: number; pm: boolean } {
  const [h, min] = hhmm.split(':').map(Number)
  return { h12: h % 12 === 0 ? 12 : h % 12, min, pm: h >= 12 }
}

const clock = (t: { h12: number; min: number }) =>
  t.min === 0 ? String(t.h12) : t.h12 + ':' + String(t.min).padStart(2, '0')

const mer = (pm: boolean) => (pm ? 'PM' : 'AM')

/** The display string for a weekly time. Inputs must already be valid. */
export function formatWeeklyTime(t: WeeklyTime): string {
  if (t.allDay) return 'All Day'
  const s = split(t.start)
  if (t.end) {
    const e = split(t.end)
    return s.pm === e.pm
      ? clock(s) + DASH + clock(e) + ' ' + mer(e.pm)
      : clock(s) + ' ' + mer(s.pm) + DASH + clock(e) + ' ' + mer(e.pm)
  }
  return clock(s) + ' ' + mer(s.pm) + (t.late ? ' til late' : '')
}

function to24(h12: number, min: number, meridiem: string): string | null {
  if (h12 < 1 || h12 > 12 || min > 59) return null
  const pm = meridiem.toUpperCase() === 'PM'
  const h = (h12 % 12) + (pm ? 12 : 0)
  return String(h).padStart(2, '0') + ':' + String(min).padStart(2, '0')
}

const RANGE = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s*[–-]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i
const SINGLE = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)(\s+til\s+late)?$/i

/**
 * Reads a stored time back into its parts, or null when it is not in
 * the editor's grammar (hand-entered text from before the editor
 * existed). Null is not an error: the homepage still prints the text
 * as-is, and the editor asks for a start time before it will save.
 */
export function parseWeeklyTime(text: string | null | undefined): WeeklyTime | null {
  const s = String(text ?? '').trim()
  if (/^all\s*day$/i.test(s)) return { allDay: true }

  let m = RANGE.exec(s)
  if (m) {
    const end = to24(+m[4], m[5] ? +m[5] : 0, m[6])
    const start = to24(+m[1], m[2] ? +m[2] : 0, m[3] ?? m[6])
    if (!start || !end) return null
    return { allDay: false, start, end, late: false }
  }

  m = SINGLE.exec(s)
  if (m) {
    const start = to24(+m[1], m[2] ? +m[2] : 0, m[3])
    if (!start) return null
    return { allDay: false, start, end: null, late: Boolean(m[4]) }
  }
  return null
}

/**
 * Minutes after midnight the special starts, for ordering within a day.
 * All Day opens with the bar, so it leads; an unreadable time trails.
 */
export function startMinutes(text: string | null | undefined): number {
  const t = parseWeeklyTime(text)
  if (!t) return 24 * 60
  if (t.allDay) return -1
  const [h, min] = t.start.split(':').map(Number)
  return h * 60 + min
}

// ── Order ─────────────────────────────────────────────────────────
type Sortable = { day: string; time: string | null; sort_order?: number | null; name: string }

/**
 * Day of week (Monday first), then start time, then sort_order, then
 * name. sort_order only ever breaks a tie between two specials on the
 * same day at the same time.
 */
export function compareRecurring(a: Sortable, b: Sortable): number {
  return (
    dayIndex(a.day) - dayIndex(b.day) ||
    startMinutes(a.time) - startMinutes(b.time) ||
    (a.sort_order ?? 0) - (b.sort_order ?? 0) ||
    a.name.localeCompare(b.name)
  )
}

export function sortRecurring<T extends Sortable>(rows: T[]): T[] {
  return [...rows].sort(compareRecurring)
}
