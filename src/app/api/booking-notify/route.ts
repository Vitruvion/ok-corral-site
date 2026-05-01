import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export const runtime = 'nodejs'

type Body = {
  name: string
  email: string
  phone?: string
  event_type?: string
  party_size?: string
  preferred_date?: string
  notes?: string
}

const FROM = process.env.RESEND_FROM_EMAIL || 'howdy@okcorralsaloon.com'
const TO   = process.env.RESEND_TO_EMAIL   || 'howdy@okcorralsaloon.com'

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  if (!body.name || !body.email) {
    return NextResponse.json(
      { error: 'name and email are required.' },
      { status: 400 }
    )
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Graceful no-op: the booking already wrote to Supabase. Email is bonus.
    if (process.env.NODE_ENV !== 'production') {
      console.info('[booking-notify] RESEND_API_KEY unset — skipping email')
    }
    return NextResponse.json({ ok: true, sent: false, reason: 'no-resend-key' })
  }

  const resend = new Resend(apiKey)
  try {
    const { error } = await resend.emails.send({
      from: `The OK Corral <${FROM}>`,
      to: [TO],
      replyTo: body.email,
      subject: `New booking inquiry — ${body.name}${body.event_type ? ` · ${body.event_type}` : ''}`,
      html: renderHtml(body),
      text: renderText(body),
    })
    if (error) throw error
    return NextResponse.json({ ok: true, sent: true })
  } catch (err: any) {
    console.error('[booking-notify] resend failed', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Email send failed.' },
      { status: 502 }
    )
  }
}

// ── Templates ─────────────────────────────────────────────────────
function renderText(b: Body): string {
  const lines: string[] = []
  lines.push('THE OK CORRAL — New booking inquiry')
  lines.push('═══════════════════════════════════')
  lines.push('')
  lines.push(`Name: ${b.name}`)
  lines.push(`Email: ${b.email}`)
  if (b.phone)          lines.push(`Phone: ${b.phone}`)
  if (b.event_type)     lines.push(`Event type: ${b.event_type}`)
  if (b.party_size)     lines.push(`Party size: ${b.party_size}`)
  if (b.preferred_date) lines.push(`Preferred date: ${b.preferred_date}`)
  if (b.notes)          lines.push('', 'Notes:', b.notes)
  lines.push('')
  lines.push('— Sent automatically from okcorralsaloon.com')
  return lines.join('\n')
}

function renderHtml(b: Body): string {
  const row = (label: string, value?: string | null) =>
    value
      ? `<tr><td style="padding:6px 12px 6px 0;color:#8e8773;font-family:Menlo,monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;vertical-align:top;white-space:nowrap;">${label}</td><td style="padding:6px 0;color:#ebe4d4;font-family:Georgia,serif;font-size:15px;">${escape(value)}</td></tr>`
      : ''

  return `<!doctype html>
<html>
<body style="margin:0;background:#0b0908;color:#ebe4d4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0908;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141110;border:1px solid rgba(235,228,212,0.12);">
        <tr><td style="padding:32px 32px 24px;border-bottom:1px solid rgba(235,228,212,0.1);">
          <div style="font-family:Menlo,monospace;font-size:11px;letter-spacing:0.32em;color:#d97742;text-transform:uppercase;margin-bottom:8px;">◆ New Booking Inquiry</div>
          <div style="font-family:Georgia,serif;font-size:32px;color:#ebe4d4;line-height:1;text-transform:uppercase;font-weight:700;letter-spacing:-0.01em;">The OK Corral</div>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${row('Name', b.name)}
            ${row('Email', b.email)}
            ${row('Phone', b.phone)}
            ${row('Event Type', b.event_type)}
            ${row('Party Size', b.party_size)}
            ${row('Preferred Date', b.preferred_date)}
          </table>
          ${b.notes ? `
          <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(235,228,212,0.1);">
            <div style="font-family:Menlo,monospace;font-size:11px;letter-spacing:0.18em;color:#8e8773;text-transform:uppercase;margin-bottom:10px;">Notes</div>
            <div style="font-family:Georgia,serif;font-style:italic;font-size:15px;color:#c8bfa8;line-height:1.5;white-space:pre-wrap;">${escape(b.notes)}</div>
          </div>` : ''}
        </td></tr>
        <tr><td style="padding:18px 32px 24px;border-top:1px solid rgba(235,228,212,0.1);font-family:Menlo,monospace;font-size:10px;letter-spacing:0.22em;color:#8e8773;text-transform:uppercase;">
          Reply directly to this email to reach ${escape(b.name)}.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function escape(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
