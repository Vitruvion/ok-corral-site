import crypto from 'node:crypto'

/**
 * Ticket codes and the QR payload the door scanner reads.
 *
 * ═══════════════════════════════════════════════════════════════════
 * QR PAYLOAD FORMAT  --  PHASE 2 DEPENDS ON THIS. DO NOT CHANGE IT
 * WITHOUT BUMPING THE VERSION TAG.
 *
 *     OKC1.<CODE>.<SIG>
 *
 *     OKC1   version tag. A future format ships as OKC2 and the
 *            scanner can keep accepting OKC1 for tickets already in
 *            circulation, rather than silently failing on them.
 *     CODE   12 characters, the ticket's opaque code (below).
 *     SIG    16 characters, the first 80 bits of
 *            HMAC-SHA256(TICKET_SIGNING_SECRET, `${CODE}.${eventId}`)
 *            in the same base32 alphabet.
 *
 * Total 34 characters, all uppercase alphanumerics plus '.', which is
 * entirely inside QR ALPHANUMERIC mode. That matters: alphanumeric
 * mode packs 5.5 bits per character against byte mode's 8, so the
 * printed code is meaningfully smaller and scans faster off a phone
 * screen at a dark door.
 *
 * WHY THE EVENT ID IS NOT IN THE PAYLOAD
 * The verifier supplies it. The door scanner already knows which show
 * it is working -- it loaded that event's manifest -- so putting the
 * id in the payload would only add length. It also buys a property
 * worth having: a genuine ticket for Friday's show does not verify at
 * Saturday's, because the HMAC is over a different event id. Sharing
 * a ticket photo across shows fails at the door with no lookup.
 *
 * WHY THIS VERIFIES OFFLINE
 * Everything needed to answer "is this ticket real?" is the payload
 * plus the secret plus the event id. No network, no database. That is
 * the whole point of Phase 2: bar wifi is unreliable and the line at
 * the door does not wait for it. What offline verification CANNOT
 * answer is "has this ticket already been scanned?" -- that needs the
 * manifest, which the scanner downloads once before doors and updates
 * as it burns codes.
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * 32 characters, chosen to survive being read aloud across a noisy bar
 * and typed in by someone who is not looking closely.
 *
 * Excluded: 0, 1, I, L. That kills the 0/O and 1/I/l confusions in
 * both directions -- O and U are kept because with 0 and 1 gone there
 * is nothing left for them to be mistaken FOR.
 */
export const TICKET_CODE_ALPHABET = '23456789ABCDEFGHJKMNOPQRSTUVWXYZ'

/** Characters per code. 12 x 5 bits = 60 bits of entropy. */
const CODE_LENGTH = 12

/** Characters of signature. 16 x 5 bits = the first 80 bits of the HMAC. */
const SIG_LENGTH = 16

/** Bytes of HMAC actually used. 10 bytes encodes to exactly SIG_LENGTH. */
const SIG_BYTES = 10

export const QR_VERSION = 'OKC1'

// ── Secret ────────────────────────────────────────────────────────
/**
 * Never NEXT_PUBLIC_. Anyone holding this can mint tickets that pass
 * the door's offline check, which is the entire security boundary of
 * Phase 2.
 */
export function getTicketSigningSecret(): string {
  const secret = process.env.TICKET_SIGNING_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'TICKET_SIGNING_SECRET is unset or too short (need >= 32 chars). ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  return secret
}

/** True when a secret is configured, without throwing. For health checks. */
export const ticketSigningConfigured = (): boolean =>
  Boolean(process.env.TICKET_SIGNING_SECRET && process.env.TICKET_SIGNING_SECRET.length >= 32)

// ── base32 over our alphabet ──────────────────────────────────────
/**
 * Big-endian base32. Only ever called with byte lengths that are a
 * multiple of 5 bits' worth, so no padding scheme is needed.
 */
function base32(bytes: Buffer, length: number): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5 && out.length < length) {
      out += TICKET_CODE_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
    if (out.length >= length) break
  }
  return out
}

// ── Codes ─────────────────────────────────────────────────────────
/**
 * A fresh opaque ticket code.
 *
 * Random, never sequential: sequential codes would let anyone holding
 * one ticket derive every other ticket for the show. The alphabet has
 * exactly 32 entries and 256 % 32 === 0, so a plain `byte % 32` is
 * uniform -- no rejection sampling needed and no modulo bias.
 */
export function generateTicketCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH)
  let out = ''
  for (const byte of bytes) out += TICKET_CODE_ALPHABET[byte % 32]
  return out
}

/** `ABCD-EFGH-JKMN` -- for email, print, and reading aloud at the door. */
export function formatTicketCode(code: string): string {
  return (code.match(/.{1,4}/g) ?? [code]).join('-')
}

/**
 * Canonicalises anything a human might type or a scanner might hand
 * back: lowercase, dashes, spaces.
 *
 * A typed '0' is folded to 'O' and never the other way round, because
 * '0' is not in the alphabet so it cannot have been meant literally.
 * '1' is deliberately NOT folded -- it could stand for either I or L,
 * both of which are also out of the alphabet, so there is no
 * defensible target and a silent wrong guess is worse than a miss.
 */
export function normalizeTicketCode(input: string): string {
  return String(input ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/0/g, 'O')
}

/** Shape check only -- says nothing about whether the code is genuine. */
export function isWellFormedCode(code: string): boolean {
  if (code.length !== CODE_LENGTH) return false
  for (const ch of code) if (!TICKET_CODE_ALPHABET.includes(ch)) return false
  return true
}

// ── Signing ───────────────────────────────────────────────────────
/**
 * The signature half of the payload: 80 bits of
 * HMAC-SHA256(secret, `code.eventId`).
 *
 * 80 bits is far past what this needs. A forger gets no oracle -- a
 * wrong guess is simply refused at the door -- so the only attack is
 * offline brute force against a value that is verified once, by hand,
 * by a human holding a scanner.
 */
export function signTicket(code: string, eventId: string): string {
  const mac = crypto
    .createHmac('sha256', getTicketSigningSecret())
    .update(`${code}.${eventId}`)
    .digest()
  return base32(mac.subarray(0, SIG_BYTES), SIG_LENGTH)
}

/** The full string that gets encoded into the QR. */
export function buildQrPayload(code: string, eventId: string): string {
  return `${QR_VERSION}.${code}.${signTicket(code, eventId)}`
}

export type ParsedPayload = { version: string; code: string; sig: string }

/** Splits a payload without verifying it. Null if the shape is wrong. */
export function parseQrPayload(payload: string): ParsedPayload | null {
  const parts = String(payload ?? '').trim().toUpperCase().split('.')
  if (parts.length !== 3) return null
  const [version, code, sig] = parts
  if (!version || !code || !sig) return null
  if (code.length !== CODE_LENGTH || sig.length !== SIG_LENGTH) return null
  return { version, code, sig }
}

export type VerifyResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'malformed' | 'unknown-version' | 'bad-signature' }

/**
 * Offline authenticity check. Everything Phase 2's scanner needs to
 * answer "is this real?" with no network call.
 *
 * Compared with timingSafeEqual. The margin barely matters against a
 * door scanner, but a plain === on a signature is the kind of thing
 * that gets copied into somewhere it does matter.
 */
export function verifyQrPayload(payload: string, eventId: string): VerifyResult {
  const parsed = parseQrPayload(payload)
  if (!parsed) return { ok: false, reason: 'malformed' }
  if (parsed.version !== QR_VERSION) return { ok: false, reason: 'unknown-version' }

  const expected = Buffer.from(signTicket(parsed.code, eventId), 'utf8')
  const actual = Buffer.from(parsed.sig, 'utf8')
  if (expected.length !== actual.length) return { ok: false, reason: 'bad-signature' }
  if (!crypto.timingSafeEqual(expected, actual)) return { ok: false, reason: 'bad-signature' }

  return { ok: true, code: parsed.code }
}
