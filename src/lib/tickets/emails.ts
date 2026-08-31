import QRCode from 'qrcode'
import { BRAND } from '@/lib/data'
import { escape, money, shell } from '@/lib/order-emails'
import { formatTicketCode } from './codes'

/**
 * Ticket confirmation emails.
 *
 * Rendered by the Stripe webhook once a ticket order flips to 'paid'.
 * Reuses order-emails' shell() and escape() so a ticket receipt and a
 * merch receipt look like they came from the same bar.
 *
 * THE QR CODES ARE INLINE CID ATTACHMENTS, not remote images. A
 * hotlinked <img> is the normal way to do this and it is wrong here:
 * Gmail, Outlook and Apple Mail all block remote content by default for
 * unknown senders, which would leave someone standing at the door with
 * an empty box where their ticket should be. The PNG travels inside the
 * message.
 *
 * The plain-text part lists the codes in full for the same reason -- if
 * images are off entirely, the codes can still be read aloud and looked
 * up by name at will-call.
 */

export type TicketLine = {
  /** The stored code, e.g. K7QM4TZBWXN2. */
  code: string
  /** The signed QR payload, OKC1.<code>.<sig>. */
  payload: string
}

export type TicketEmailData = {
  eventName: string
  /** Display date, already formatted for humans. */
  eventDate: string
  eventTime: string | null
  doors: string | null
  quantity: number
  unitPrice: number
  total: number
  purchaserName: string | null
  purchaserEmail: string | null
  orderId: string
  tickets: TicketLine[]
}

export type RenderedEmail = {
  subject: string
  html: string
  text: string
  attachments?: Array<{
    filename: string
    content: Buffer
    contentId: string
    contentType: string
  }>
}

const VENUE_LINES = [BRAND.address.line1, BRAND.address.line2]

/**
 * QR polarity is dark-on-light even though the email is dark. Inverted
 * codes decode on many modern phones but not reliably on all of them,
 * and a ticket gets one attempt from a stranger at a dark door.
 */
async function qrPng(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 360,
    color: { dark: '#0b0908', light: '#ebe4d4' },
  })
}

const detailRow = (label: string, value: string): string =>
  `<tr>
     <td style="padding:4px 0;font-family:Menlo,monospace;font-size:10px;letter-spacing:0.18em;color:#8e8773;text-transform:uppercase;white-space:nowrap;vertical-align:top;">${escape(label)}</td>
     <td style="padding:4px 0 4px 16px;font-family:Georgia,serif;font-size:15px;color:#ebe4d4;">${escape(value)}</td>
   </tr>`

// ── Customer confirmation ─────────────────────────────────────────
export async function renderTicketCustomerEmail(d: TicketEmailData): Promise<RenderedEmail> {
  const plural = d.quantity === 1 ? 'ticket' : 'tickets'
  const subject = `Your ${d.quantity} ${plural} — ${d.eventName}`

  const pngs = await Promise.all(d.tickets.map(t => qrPng(t.payload)))

  const attachments = d.tickets.map((t, i) => ({
    filename: `ticket-${t.code}.png`,
    content: pngs[i],
    contentId: `ticket-${t.code}`,
    contentType: 'image/png',
  }))

  const details = [
    detailRow('Event', d.eventName),
    detailRow('Date', d.eventDate),
    d.eventTime ? detailRow('Show', d.eventTime) : '',
    d.doors ? detailRow('Doors', d.doors) : '',
    detailRow('Tickets', String(d.quantity)),
    detailRow('Total', money(d.total)),
  ].join('')

  const ticketCards = d.tickets
    .map(
      (t, i) => `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:#0b0908;border:1px solid rgba(235,228,212,0.14);">
        <tr><td align="center" style="padding:20px 16px 12px;">
          <div style="font-family:Menlo,monospace;font-size:10px;letter-spacing:0.24em;color:#8e8773;text-transform:uppercase;margin-bottom:12px;">Admit one &middot; ${i + 1} of ${d.tickets.length}</div>
          <img src="cid:ticket-${escape(t.code)}" alt="QR code for ticket ${escape(formatTicketCode(t.code))}" width="180" height="180" style="display:block;width:180px;height:180px;border:6px solid #ebe4d4;background:#ebe4d4;" />
          <div style="font-family:Menlo,monospace;font-size:15px;letter-spacing:0.16em;color:#ebe4d4;margin-top:12px;">${escape(formatTicketCode(t.code))}</div>
        </td></tr>
      </table>`
    )
    .join('')

  const body = `
    <div style="font-family:Georgia,serif;font-size:17px;line-height:1.5;color:#ebe4d4;margin-bottom:6px;">
      ${d.purchaserName ? `${escape(d.purchaserName)}, you&rsquo;re in.` : 'You&rsquo;re in.'}
    </div>
    <div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#c8bfa8;margin-bottom:20px;">
      Show this email at the door &mdash; we&rsquo;ll scan one code per person.
      No need to print anything.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">${details}</table>

    ${ticketCards}

    <div style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:#8e8773;margin-top:8px;">
      If the codes above don&rsquo;t load, give your name at the door and we&rsquo;ll
      find you on the list.
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;padding-top:18px;border-top:1px solid rgba(235,228,212,0.1);">
      ${detailRow('Where', VENUE_LINES.join(', '))}
      ${detailRow('Questions', BRAND.phone)}
    </table>`

  const footer = `${escape(BRAND.address.line1)} &middot; ${escape(BRAND.address.line2)}<br />${escape(BRAND.phone)}`

  const text = [
    d.purchaserName ? `${d.purchaserName}, you're in.` : "You're in.",
    '',
    `${d.eventName}`,
    `${d.eventDate}${d.eventTime ? ` · ${d.eventTime}` : ''}`,
    d.doors ? `Doors ${d.doors}` : '',
    '',
    `${d.quantity} ${plural} · ${money(d.total)}`,
    '',
    'YOUR CODES (one admission each):',
    ...d.tickets.map(t => `  ${formatTicketCode(t.code)}`),
    '',
    "Show this email at the door. If the QR images don't load, read a code",
    'aloud or give your name and we will find you on the list.',
    '',
    VENUE_LINES.join(', '),
    BRAND.phone,
  ]
    .filter(line => line !== '')
    .join('\n')

  return { subject, html: shell('Tickets', body, footer), text, attachments }
}

// ── Bar notification ──────────────────────────────────────────────
export function renderTicketOwnerEmail(d: TicketEmailData): RenderedEmail {
  const subject = `${d.quantity} ticket${d.quantity === 1 ? '' : 's'} sold — ${d.eventName}`

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detailRow('Event', d.eventName)}
      ${detailRow('Date', d.eventDate)}
      ${detailRow('Quantity', String(d.quantity))}
      ${detailRow('Unit', money(d.unitPrice))}
      ${detailRow('Total', money(d.total))}
      ${detailRow('Name', d.purchaserName || 'not given')}
      ${detailRow('Email', d.purchaserEmail || 'not given')}
      ${detailRow('Channel', 'online / stripe')}
      ${detailRow('Order', d.orderId)}
    </table>
    <div style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:#8e8773;margin-top:18px;">
      Codes: ${escape(d.tickets.map(t => formatTicketCode(t.code)).join(', '))}
    </div>`

  const text = [
    `${d.quantity} ticket(s) sold - ${d.eventName}`,
    `${d.eventDate}`,
    `Total ${money(d.total)} (${d.quantity} x ${money(d.unitPrice)})`,
    `Name: ${d.purchaserName || 'not given'}`,
    `Email: ${d.purchaserEmail || 'not given'}`,
    `Order: ${d.orderId}`,
    `Codes: ${d.tickets.map(t => formatTicketCode(t.code)).join(', ')}`,
  ].join('\n')

  return { subject, html: shell('Ticket sale', body, 'okcorralsaloon.com'), text }
}

// ── Oversell alert ────────────────────────────────────────────────
export type OversellData = {
  eventName: string
  eventDate: string
  capacity: number
  issued: number
  orderId: string
  quantity: number
}

/**
 * Sent when the webhook issues tickets that push an event past its
 * capacity.
 *
 * The tickets are issued regardless -- the customer has already paid,
 * and refusing or auto-refunding someone at that point is a far worse
 * outcome than a room that is a few over. This email exists so the
 * decision reaches a human the same evening instead of at the door.
 */
export function renderOversellEmail(d: OversellData): RenderedEmail {
  const over = d.issued - d.capacity
  const subject = `OVERSOLD by ${over} — ${d.eventName}`

  const body = `
    <div style="font-family:Georgia,serif;font-size:17px;line-height:1.5;color:#ebe4d4;margin-bottom:16px;">
      ${escape(d.eventName)} is oversold by <strong>${over}</strong>.
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detailRow('Date', d.eventDate)}
      ${detailRow('Capacity', String(d.capacity))}
      ${detailRow('Issued', String(d.issued))}
      ${detailRow('Over by', String(over))}
      ${detailRow('This order', `${d.quantity} ticket${d.quantity === 1 ? '' : 's'}`)}
      ${detailRow('Order', d.orderId)}
    </table>
    <div style="font-family:Georgia,serif;font-size:14px;line-height:1.6;color:#c8bfa8;margin-top:18px;">
      The tickets were issued anyway &mdash; the customer had already paid, and
      refusing them after the fact is worse than a few extra in the room.
      Decide how to handle it: raise the capacity, or refund the last order
      from the Stripe dashboard and void its tickets.
    </div>`

  const text = [
    `${d.eventName} is OVERSOLD by ${over}.`,
    `${d.eventDate}`,
    `Capacity ${d.capacity}, issued ${d.issued}.`,
    `Triggered by order ${d.orderId} (${d.quantity} ticket(s)).`,
    '',
    'The tickets were issued anyway - the customer had already paid.',
    'Either raise the capacity or refund that order and void its tickets.',
  ].join('\n')

  return { subject, html: shell('Oversold', body, 'okcorralsaloon.com'), text }
}
