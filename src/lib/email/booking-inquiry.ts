/**
 * The contact form's reasons, and the email that announces one.
 *
 * WHY THIS IS A LIB MODULE AND NOT PART OF THE ROUTE: a Next route file
 * may only export handlers and a fixed config set, so templates living
 * there cannot be imported by anything -- not by the form, not by a test.
 * Here, the form renders its <select> from the same list the email
 * validates against, and the subject line can be checked without sending
 * any mail.
 */

/**
 * The only four answers the form offers.
 *
 * Order matters: it is the order of the <select>, and the first is the
 * most common (this was a booking form before it was anything else).
 * The stored value IS this text -- readable straight out of the database
 * without a lookup table.
 */
export const CONTACT_REASONS = [
  'Private party or group booking',
  'Live music / performing here',
  'General question',
  'Something else',
] as const

export type ContactReason = (typeof CONTACT_REASONS)[number]

export const isContactReason = (v: unknown): v is ContactReason =>
  typeof v === 'string' && (CONTACT_REASONS as readonly string[]).includes(v)

/** Only the booking reason expects a date; the rest are just messages. */
export const isBookingReason = (v: unknown) => v === CONTACT_REASONS[0]

export type InquiryBody = {
  name: string
  email: string
  phone?: string
  reason?: string
  event_type?: string
  party_size?: string
  preferred_date?: string
  notes?: string
}

/**
 * What lands in the inbox.
 *
 * Every one of these used to read "New booking inquiry", including the
 * complaints and the general questions, which made the subject line
 * actively misleading. Now the subject is the reason the sender picked.
 * An unrecognised or missing reason falls back to the old wording rather
 * than inventing one.
 */
export function subjectFor(b: InquiryBody): string {
  const reason = isContactReason(b.reason) ? b.reason : 'New booking inquiry'
  return `${reason} — ${b.name}`
}

/** The kicker above the masthead, matching the subject. */
export function kickerFor(b: InquiryBody): string {
  return isContactReason(b.reason) ? b.reason : 'New booking inquiry'
}

export function renderText(b: InquiryBody): string {
  const lines: string[] = []
  lines.push(`THE OK CORRAL — ${kickerFor(b)}`)
  lines.push('═══════════════════════════════════')
  lines.push('')
  lines.push(`Name: ${b.name}`)
  lines.push(`Email: ${b.email}`)
  if (b.phone) lines.push(`Phone: ${b.phone}`)
  if (b.reason) lines.push(`Reason: ${b.reason}`)
  if (b.event_type) lines.push(`Event type: ${b.event_type}`)
  if (b.party_size) lines.push(`Party size: ${b.party_size}`)
  if (b.preferred_date) lines.push(`Preferred date: ${b.preferred_date}`)
  if (b.notes) lines.push('', 'Notes:', b.notes)
  lines.push('')
  lines.push('— Sent automatically from okcorralsaloon.com')
  return lines.join('\n')
}

export function renderHtml(b: InquiryBody): string {
  const row = (label: string, value?: string | null) =>
    value
      ? `<tr><td style="padding:6px 12px 6px 0;color:#8e8773;font-family:Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;vertical-align:top;white-space:nowrap;">${label}</td><td style="padding:6px 0;color:#ebe4d4;font-family:Georgia,serif;font-size:15px;">${escapeHtml(value)}</td></tr>`
      : ''

  return `<!doctype html>
<html>
<body style="margin:0;background:#0b0908;color:#ebe4d4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0908;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141110;border:1px solid rgba(235,228,212,0.12);">
        <tr><td style="padding:32px 32px 24px;border-bottom:1px solid rgba(235,228,212,0.1);">
          <div style="font-family:Menlo,monospace;font-size:11px;letter-spacing:0.32em;color:#d97742;text-transform:uppercase;margin-bottom:8px;">◆ ${escapeHtml(kickerFor(b))}</div>
          <div style="font-family:Georgia,serif;font-size:32px;color:#ebe4d4;line-height:1;text-transform:uppercase;font-weight:700;letter-spacing:-0.01em;">The OK Corral</div>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${row('Name', b.name)}
            ${row('Email', b.email)}
            ${row('Phone', b.phone)}
            ${row('Reason', b.reason)}
            ${row('Event Type', b.event_type)}
            ${row('Party Size', b.party_size)}
            ${row('Preferred Date', b.preferred_date)}
          </table>
          ${b.notes ? `
          <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(235,228,212,0.1);">
            <div style="font-family:Menlo,monospace;font-size:11px;letter-spacing:0.18em;color:#8e8773;text-transform:uppercase;margin-bottom:10px;">Notes</div>
            <div style="font-family:Georgia,serif;font-style:italic;font-size:15px;color:#c8bfa8;line-height:1.5;white-space:pre-wrap;">${escapeHtml(b.notes)}</div>
          </div>` : ''}
        </td></tr>
        <tr><td style="padding:18px 32px 24px;border-top:1px solid rgba(235,228,212,0.1);font-family:Menlo,monospace;font-size:10px;letter-spacing:0.22em;color:#8e8773;text-transform:uppercase;">
          Reply directly to this email to reach ${escapeHtml(b.name)}.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
