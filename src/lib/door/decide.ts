import type { ManifestTicket } from '@/lib/tickets/door'
import { parseScan } from './scanner'

/**
 * What a scanned payload means, given the manifest this device holds.
 *
 * Pure and side-effect free on purpose: this is the decision the whole
 * door rests on, so it is a function that can be reasoned about and
 * tested directly rather than logic tangled into a camera callback.
 *
 * THE SIGNATURE CHECK IS A STRING COMPARISON. The expected value was
 * computed on the server and shipped inside the manifest; the browser
 * never holds TICKET_SIGNING_SECRET and so cannot compute a signature
 * for a code it has not been told about. That is why an unknown code
 * returns 'unknown' rather than a verdict -- the caller re-queries the
 * server, and if there is no network it becomes NOT FOUND. Guessing
 * would be the only alternative, and guessing at a door is worse than
 * asking.
 */

export type Decision =
  /** Genuine, on the list, not yet used. Admit. */
  | { kind: 'valid'; ticket: ManifestTicket }
  /** Genuine, but this device or the server has already burned it. */
  | { kind: 'used'; ticket: ManifestTicket }
  /** Refunded or cancelled. */
  | { kind: 'void'; ticket: ManifestTicket }
  /** Signature mismatch, wrong version, or not a ticket at all. */
  | { kind: 'bad'; code: string | null; reason: 'signature' | 'malformed' | 'version' }
  /** Not in this manifest. Undecidable offline -- ask the server. */
  | { kind: 'unknown'; code: string }

export function decideScan(payload: string, tickets: ManifestTicket[]): Decision {
  const parsed = parseScan(payload)

  if (!parsed.ok) {
    return {
      kind: 'bad',
      code: null,
      reason: parsed.reason === 'unknown-version' ? 'version' : 'malformed',
    }
  }

  // parseScan normalizes, and manifest codes are stored canonically, so
  // a QR payload and a hand-typed PNGV-XSBT-67MR meet as the same string.
  const ticket = tickets.find(t => t.code === parsed.code)
  if (!ticket) return { kind: 'unknown', code: parsed.code }

  if (ticket.sig !== parsed.sig) {
    return { kind: 'bad', code: parsed.code, reason: 'signature' }
  }

  if (ticket.status === 'void') return { kind: 'void', ticket }
  if (ticket.status === 'used') return { kind: 'used', ticket }
  return { kind: 'valid', ticket }
}
