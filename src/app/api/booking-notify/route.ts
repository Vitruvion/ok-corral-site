import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import {
  renderHtml,
  renderText,
  subjectFor,
  type InquiryBody,
} from '@/lib/email/booking-inquiry'

/**
 * Notification for a contact-form submission.
 *
 * The form is the only contact path on the site, so it carries far more
 * than bookings -- questions, complaints, bands asking for a slot. It now
 * asks why, and that answer drives the subject and the kicker. The
 * templates live in @/lib/email/booking-inquiry so the form and this
 * route share one definition of the reasons, and so the output can be
 * checked without sending mail.
 */

export const runtime = 'nodejs'

const FROM = process.env.RESEND_FROM_EMAIL || 'howdy@okcorralsaloon.com'
const TO = process.env.RESEND_TO_EMAIL || 'howdy@okcorralsaloon.com'

export async function POST(req: NextRequest) {
  let body: InquiryBody
  try {
    body = (await req.json()) as InquiryBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  if (!body.name || !body.email) {
    return NextResponse.json({ error: 'name and email are required.' }, { status: 400 })
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    // Graceful no-op: the inquiry already wrote to Supabase. Email is bonus.
    if (process.env.NODE_ENV !== 'production') {
      console.info('[booking-notify] RESEND_API_KEY unset — skipping email')
    }
    return NextResponse.json({
      ok: true,
      sent: false,
      reason: 'no-resend-key',
      // Echoed so the send can be verified end to end without a mailbox.
      subject: subjectFor(body),
    })
  }

  const resend = new Resend(apiKey)
  try {
    const { error } = await resend.emails.send({
      from: `The OK Corral <${FROM}>`,
      to: [TO],
      replyTo: body.email,
      subject: subjectFor(body),
      html: renderHtml(body),
      text: renderText(body),
    })
    if (error) throw error
    return NextResponse.json({ ok: true, sent: true, subject: subjectFor(body) })
  } catch (err: any) {
    console.error('[booking-notify] resend failed', err)
    return NextResponse.json(
      { ok: false, error: err?.message || 'Email send failed.' },
      { status: 502 }
    )
  }
}
