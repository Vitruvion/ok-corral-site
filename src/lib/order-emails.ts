import { BRAND, HOURS } from './data'
import type { FulfillmentType } from './fulfillment'

/**
 * Email templates for completed merch orders — one confirmation for the
 * customer, one operational notification for the bar. Rendered by the Stripe
 * webhook after an order flips to 'paid'.
 *
 * Styling mirrors the booking-inquiry email (dark saloon palette, Menlo
 * labels, Georgia body) so everything from okcorralsaloon.com looks like it
 * came from the same place.
 */

export type OrderItem = {
  name: string
  qty: number
  /** Unit price in dollars. */
  price: number
  size?: string | null
  color?: string | null
}

export type ShippingAddress = {
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
}

export type OrderEmailData = {
  items: OrderItem[]
  /** What the customer actually paid, in dollars — includes shipping. */
  totalPaid: number
  /** Shipping charged, in dollars. Zero for pickup. */
  shippingCost: number
  fulfillment: FulfillmentType
  customerName?: string | null
  customerEmail?: string | null
  shippingAddress?: ShippingAddress | null
  sessionId: string
}

type Rendered = { subject: string; html: string; text: string }

// ── Helpers ───────────────────────────────────────────────────────
export const money = (n: number): string =>
  `$${(Number.isFinite(n) ? n : 0).toFixed(2)}`

const variant = (it: OrderItem): string =>
  [it.color, it.size].filter(Boolean).join(' · ')

const itemLabel = (it: OrderItem): string => {
  const v = variant(it)
  return v ? `${it.name} (${v})` : it.name
}

const lineTotal = (it: OrderItem): number => it.price * it.qty

export function formatAddress(a?: ShippingAddress | null): string[] {
  if (!a) return []
  const cityLine = [a.city, a.state].filter(Boolean).join(', ')
  const cityZip = [cityLine, a.postal_code].filter(Boolean).join(' ')
  return [a.line1, a.line2, cityZip, a.country && a.country !== 'US' ? a.country : null]
    .map(s => (s ?? '').trim())
    .filter(Boolean) as string[]
}

/** Daily hours, pulled from the same source the site's Visit section uses. */
const hoursLine = (): string => {
  const h = HOURS[0]
  return h ? `Open daily ${h.open} – ${h.close}` : 'Open daily'
}

function escape(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Shared HTML chrome ────────────────────────────────────────────
function shell(kicker: string, bodyHtml: string, footerHtml: string): string {
  return `<!doctype html>
<html>
<body style="margin:0;background:#0b0908;color:#ebe4d4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0908;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#141110;border:1px solid rgba(235,228,212,0.12);">
        <tr><td style="padding:32px 32px 24px;border-bottom:1px solid rgba(235,228,212,0.1);">
          <div style="font-family:Menlo,monospace;font-size:11px;letter-spacing:0.32em;color:#d97742;text-transform:uppercase;margin-bottom:8px;">◆ ${escape(kicker)}</div>
          <div style="font-family:Georgia,serif;font-size:32px;color:#ebe4d4;line-height:1;text-transform:uppercase;font-weight:700;letter-spacing:-0.01em;">The OK Corral</div>
        </td></tr>
        <tr><td style="padding:24px 32px;">${bodyHtml}</td></tr>
        <tr><td style="padding:18px 32px 24px;border-top:1px solid rgba(235,228,212,0.1);font-family:Menlo,monospace;font-size:10px;letter-spacing:0.18em;color:#8e8773;text-transform:uppercase;">
          ${footerHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function itemsTableHtml(d: OrderEmailData): string {
  const rows = d.items
    .map(
      it => `<tr>
        <td style="padding:8px 12px 8px 0;color:#ebe4d4;font-family:Georgia,serif;font-size:15px;vertical-align:top;">
          ${escape(it.name)}${variant(it) ? `<div style="font-family:Menlo,monospace;font-size:10px;letter-spacing:0.14em;color:#8e8773;text-transform:uppercase;margin-top:3px;">${escape(variant(it))}</div>` : ''}
        </td>
        <td style="padding:8px 12px;color:#c8bfa8;font-family:Menlo,monospace;font-size:13px;text-align:center;vertical-align:top;white-space:nowrap;">×${it.qty}</td>
        <td style="padding:8px 0;color:#ebe4d4;font-family:Menlo,monospace;font-size:13px;text-align:right;vertical-align:top;white-space:nowrap;">${money(lineTotal(it))}</td>
      </tr>`
    )
    .join('')

  const shippingRow =
    d.fulfillment === 'ship'
      ? `<tr>
          <td colspan="2" style="padding:6px 12px 6px 0;color:#8e8773;font-family:Menlo,monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">Shipping</td>
          <td style="padding:6px 0;color:#c8bfa8;font-family:Menlo,monospace;font-size:13px;text-align:right;white-space:nowrap;">${money(d.shippingCost)}</td>
        </tr>`
      : `<tr>
          <td colspan="2" style="padding:6px 12px 6px 0;color:#8e8773;font-family:Menlo,monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;">Pickup at the bar</td>
          <td style="padding:6px 0;color:#c8bfa8;font-family:Menlo,monospace;font-size:13px;text-align:right;white-space:nowrap;">—</td>
        </tr>`

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    ${rows}
    <tr><td colspan="3" style="padding:6px 0 0;border-top:1px solid rgba(235,228,212,0.1);"></td></tr>
    ${shippingRow}
    <tr>
      <td colspan="2" style="padding:10px 12px 0 0;color:#d97742;font-family:Menlo,monospace;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;">Total paid</td>
      <td style="padding:10px 0 0;color:#ebe4d4;font-family:Georgia,serif;font-size:20px;font-weight:700;text-align:right;white-space:nowrap;">${money(d.totalPaid)}</td>
    </tr>
  </table>`
}

function itemsTableText(d: OrderEmailData): string[] {
  const lines = d.items.map(it => `  ${it.qty} × ${itemLabel(it)} — ${money(lineTotal(it))}`)
  lines.push('')
  lines.push(
    d.fulfillment === 'ship'
      ? `  Shipping: ${money(d.shippingCost)}`
      : '  Pickup at the bar: no shipping charge'
  )
  lines.push(`  TOTAL PAID: ${money(d.totalPaid)}`)
  return lines
}

// ── A. Customer confirmation ──────────────────────────────────────
export function renderCustomerEmail(d: OrderEmailData): Rendered {
  const isPickup = d.fulfillment === 'pickup'
  const first = (d.customerName ?? '').trim().split(/\s+/)[0] || ''
  const greeting = first ? `Howdy ${first},` : 'Howdy,'

  const subject = isPickup
    ? 'Your OK Corral order is ready for pickup'
    : 'Your OK Corral order is confirmed'

  const intro = isPickup
    ? `Thanks for the order — it's paid for and set aside with your name on it. Come grab it any time we're open. No need to call ahead, just tell whoever's behind the bar you've got a pickup.`
    : `Thanks for the order — it's paid for and we're getting it boxed up. We'll send you a note the moment it ships.`

  const addr = formatAddress(d.shippingAddress)

  const pickupBlockHtml = `
    <div style="margin-top:24px;padding:18px 20px;border:1px solid rgba(217,119,66,0.35);background:rgba(217,119,66,0.06);">
      <div style="font-family:Menlo,monospace;font-size:11px;letter-spacing:0.22em;color:#d97742;text-transform:uppercase;margin-bottom:10px;">◆ Where to grab it</div>
      <div style="font-family:Georgia,serif;font-size:16px;color:#ebe4d4;line-height:1.6;">
        ${escape(BRAND.name)}<br/>
        ${escape(BRAND.address.line1)}<br/>
        ${escape(BRAND.address.line2)}
      </div>
      <div style="font-family:Menlo,monospace;font-size:11px;letter-spacing:0.14em;color:#c8bfa8;text-transform:uppercase;margin-top:12px;">${escape(hoursLine())}</div>
      <div style="font-family:Georgia,serif;font-style:italic;font-size:14px;color:#c8bfa8;margin-top:12px;">Just off I-5, exit 665. Free parking out back.</div>
    </div>`

  const shipBlockHtml = addr.length
    ? `
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid rgba(235,228,212,0.1);">
      <div style="font-family:Menlo,monospace;font-size:11px;letter-spacing:0.18em;color:#8e8773;text-transform:uppercase;margin-bottom:10px;">Shipping to</div>
      <div style="font-family:Georgia,serif;font-size:15px;color:#ebe4d4;line-height:1.6;">${addr.map(escape).join('<br/>')}</div>
    </div>`
    : ''

  const html = shell(
    isPickup ? 'Ready for pickup' : 'Order confirmed',
    `<div style="font-family:Georgia,serif;font-size:17px;color:#ebe4d4;margin-bottom:6px;">${escape(greeting)}</div>
     <div style="font-family:Georgia,serif;font-size:15px;color:#c8bfa8;line-height:1.6;margin-bottom:24px;">${escape(intro)}</div>
     <div style="font-family:Menlo,monospace;font-size:11px;letter-spacing:0.22em;color:#8e8773;text-transform:uppercase;margin-bottom:10px;">Your order</div>
     ${itemsTableHtml(d)}
     ${isPickup ? pickupBlockHtml : shipBlockHtml}`,
    `Questions? Just reply to this email or call ${escape(BRAND.phone)}.`
  )

  const text = [
    'THE OK CORRAL',
    isPickup ? 'Your order is ready for pickup' : 'Your order is confirmed',
    '═══════════════════════════════════',
    '',
    greeting,
    '',
    intro,
    '',
    'YOUR ORDER',
    ...itemsTableText(d),
    '',
    ...(isPickup
      ? [
          'WHERE TO GRAB IT',
          `  ${BRAND.name}`,
          `  ${BRAND.address.line1}`,
          `  ${BRAND.address.line2}`,
          `  ${hoursLine()}`,
          '',
          '  Just off I-5, exit 665. Free parking out back.',
        ]
      : addr.length
        ? ['SHIPPING TO', ...addr.map(l => `  ${l}`)]
        : []),
    '',
    `Questions? Just reply to this email or call ${BRAND.phone}.`,
  ].join('\n')

  return { subject, html, text }
}

// ── B. Owner notification ─────────────────────────────────────────
export function renderOwnerEmail(d: OrderEmailData): Rendered {
  const tag = d.fulfillment === 'ship' ? '[SHIP]' : '[PICKUP]'
  const subject = `${tag} New merch order — ${money(d.totalPaid)}`

  const addr = formatAddress(d.shippingAddress)

  const row = (label: string, value?: string | null) =>
    value
      ? `<tr><td style="padding:5px 12px 5px 0;color:#8e8773;font-family:Menlo,monospace;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;vertical-align:top;white-space:nowrap;">${escape(label)}</td><td style="padding:5px 0;color:#ebe4d4;font-family:Menlo,monospace;font-size:13px;word-break:break-all;">${escape(value)}</td></tr>`
      : ''

  const itemLines = d.items
    .map(
      it =>
        `<div style="font-family:Menlo,monospace;font-size:13px;color:#ebe4d4;padding:3px 0;">${it.qty} × ${escape(itemLabel(it))} <span style="color:#8e8773;">— ${money(lineTotal(it))}</span></div>`
    )
    .join('')

  const html = shell(
    `${d.fulfillment === 'ship' ? 'Ship' : 'Pickup'} · New merch order`,
    `<div style="font-family:Georgia,serif;font-size:26px;color:#d97742;font-weight:700;margin-bottom:4px;">${money(d.totalPaid)} <span style="font-size:13px;color:#8e8773;font-family:Menlo,monospace;letter-spacing:0.18em;text-transform:uppercase;">${escape(tag)}</span></div>
     <div style="margin:20px 0 8px;font-family:Menlo,monospace;font-size:11px;letter-spacing:0.22em;color:#8e8773;text-transform:uppercase;">Items</div>
     ${itemLines}
     <div style="margin:20px 0 8px;font-family:Menlo,monospace;font-size:11px;letter-spacing:0.22em;color:#8e8773;text-transform:uppercase;">Details</div>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
       ${row('Fulfillment', d.fulfillment === 'ship' ? 'SHIP' : 'PICKUP')}
       ${row('Customer', d.customerName)}
       ${row('Email', d.customerEmail)}
       ${row('Shipping', d.fulfillment === 'ship' ? money(d.shippingCost) : 'n/a (pickup)')}
       ${row('Total paid', money(d.totalPaid))}
       ${row('Session', d.sessionId)}
     </table>
     ${
       d.fulfillment === 'ship' && addr.length
         ? `<div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(235,228,212,0.1);">
              <div style="font-family:Menlo,monospace;font-size:11px;letter-spacing:0.18em;color:#8e8773;text-transform:uppercase;margin-bottom:8px;">Ship to</div>
              <div style="font-family:Menlo,monospace;font-size:13px;color:#ebe4d4;line-height:1.6;">${addr.map(escape).join('<br/>')}</div>
            </div>`
         : ''
     }`,
    `Sent automatically from okcorralsaloon.com`
  )

  const text = [
    `THE OK CORRAL — New merch order ${tag}`,
    '═══════════════════════════════════',
    '',
    `TOTAL PAID: ${money(d.totalPaid)}`,
    `FULFILLMENT: ${d.fulfillment === 'ship' ? 'SHIP' : 'PICKUP'}`,
    '',
    'ITEMS',
    ...d.items.map(it => `  ${it.qty} × ${itemLabel(it)} — ${money(lineTotal(it))}`),
    '',
    'DETAILS',
    `  Customer: ${d.customerName || '(not provided)'}`,
    `  Email: ${d.customerEmail || '(not provided)'}`,
    `  Shipping: ${d.fulfillment === 'ship' ? money(d.shippingCost) : 'n/a (pickup)'}`,
    `  Session: ${d.sessionId}`,
    ...(d.fulfillment === 'ship' && addr.length
      ? ['', 'SHIP TO', ...addr.map(l => `  ${l}`)]
      : []),
    '',
    '— Sent automatically from okcorralsaloon.com',
  ].join('\n')

  return { subject, html, text }
}
