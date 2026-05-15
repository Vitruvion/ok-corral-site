/**
 * Generates an iCalendar (.ics) string for an event.
 *
 * Designed for download in the browser — Safari on iOS / Chrome on Android
 * both recognize the `text/calendar` MIME type and surface "Add to Calendar"
 * prompts when the file opens.
 *
 * Format notes:
 *   - Line endings MUST be CRLF per RFC 5545.
 *   - Times are emitted with TZID=America/Los_Angeles and a full VTIMEZONE
 *     block so calendar apps don't have to know our local zone.
 *   - Descriptions are RFC-escaped (backslash, comma, semicolon, newline).
 */

import type { EventData } from './data'

const TZID = 'America/Los_Angeles'
const PROD_ID = '-//The OK Corral//Events//EN'

const ADDRESS = 'The OK Corral, 3633 Main Street, Cottonwood, CA 96022'

/**
 * Builds an ICS string for the event. Returns null if the event's date or
 * time can't be parsed.
 */
export function eventToIcs(ev: EventData): string | null {
  const start = parseEventStart(ev)
  if (!start) return null

  // End: explicit end_time would be nicer, but EventData has no such field;
  // default to a 2-hour set length which is a reasonable saloon-show duration.
  const end = addHours(start, 2)

  const uid = `${ev.id}@okcorralsaloon.com`
  const summary = ev.name
  const url = ev.eventbrite_url || ''
  const descParts: string[] = []
  if (ev.description) descParts.push(ev.description)
  if (ev.support)     descParts.push(`\nLineup: ${ev.support}`)
  if (url)            descParts.push(`\nTickets: ${url}`)
  const description = descParts.join('').trim()

  // DTSTAMP must be UTC. We use the event's creation moment is unknown, so
  // use "now" — calendar apps just want a stable timestamp here.
  const dtstamp = formatUtc(new Date())

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PROD_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...VTIMEZONE_BLOCK,
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${TZID}:${formatLocal(start)}`,
    `DTEND;TZID=${TZID}:${formatLocal(end)}`,
    foldLine(`SUMMARY:${escapeText(summary)}`),
    foldLine(`DESCRIPTION:${escapeText(description)}`),
    foldLine(`LOCATION:${escapeText(ADDRESS)}`),
    ...(url ? [foldLine(`URL:${url}`)] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  // CRLF per spec, trailing CRLF too.
  return lines.join('\r\n') + '\r\n'
}

// ── Parsers ───────────────────────────────────────────────────────

/** Returns a Date in local time representing the event's start moment. */
function parseEventStart(ev: EventData): Date | null {
  const ymd = parseDate(ev.date)
  if (!ymd) return null
  const hm = parseTime(ev.time)
  if (!hm) return null
  return new Date(ymd.y, ymd.m - 1, ymd.d, hm.h, hm.min, 0, 0)
}

function parseDate(s: string): { y: number; m: number; d: number } | null {
  // ISO: 2026-06-25
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return { y: +iso[1], m: +iso[2], d: +iso[3] }
  // Loose: "June 25 2026" / "June 25, 2026" — let the JS Date parser try.
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }
}

function parseTime(s: string): { h: number; min: number } | null {
  const m = s.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i)
  if (!m) return null
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const ampm = m[3].toUpperCase()
  if (ampm === 'PM' && h < 12) h += 12
  if (ampm === 'AM' && h === 12) h = 0
  return { h, min }
}

// ── Formatters ────────────────────────────────────────────────────

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** ICS local-time format: YYYYMMDDTHHmmss */
function formatLocal(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  )
}

/** ICS UTC-time format: YYYYMMDDTHHmmssZ */
function formatUtc(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  )
}

function addHours(d: Date, hours: number): Date {
  const out = new Date(d.getTime())
  out.setHours(out.getHours() + hours)
  return out
}

/**
 * RFC 5545 §3.3.11 text escaping. Backslash, comma, semicolon must be
 * backslash-escaped; newlines become literal \n.
 */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * RFC 5545 §3.1 content-line folding: lines must not exceed 75 octets.
 * Long lines get a CRLF + space inserted every 73 chars (74 incl. space).
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = []
  let i = 0
  // First chunk: 75 chars. Subsequent: 74 (leading space is its own octet).
  chunks.push(line.slice(i, i + 75))
  i += 75
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + 74))
    i += 74
  }
  return chunks.join('\r\n')
}

// ── Static VTIMEZONE block for America/Los_Angeles ────────────────
// Includes both STANDARD (PST) and DAYLIGHT (PDT) sub-components so
// recipients with limited TZ databases still get correct local time.

const VTIMEZONE_BLOCK = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZID}`,
  'X-LIC-LOCATION:America/Los_Angeles',
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:-0800',
  'TZOFFSETTO:-0700',
  'TZNAME:PDT',
  'DTSTART:19700308T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:-0700',
  'TZOFFSETTO:-0800',
  'TZNAME:PST',
  'DTSTART:19701101T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
]

// ── Browser helpers ───────────────────────────────────────────────

/** Triggers a download of the given ICS string as `${slug}.ics`. */
export function downloadIcs(ev: EventData): boolean {
  const ics = eventToIcs(ev)
  if (!ics) return false
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${ev.id || 'event'}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke after a tick so iOS Safari has time to start the handoff.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
