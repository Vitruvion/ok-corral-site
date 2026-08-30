import crypto from 'node:crypto'

/**
 * Admin session: one shared passcode for three brothers, deliberately small.
 *
 * The cookie holds `<issuedAt>.<expiresAt>.<hmac>` — never the passcode
 * itself. The HMAC is over the timestamps with ADMIN_COOKIE_SECRET, so a
 * client can't extend its own expiry or forge a session without the secret.
 *
 * Node crypto only — this module must not be imported from middleware, which
 * runs on the edge runtime. See src/lib/admin/edge-session.ts for that half.
 */

export const ADMIN_COOKIE = 'corral_admin'
export const SESSION_DAYS = 30
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000

function secret(): string {
  const s = process.env.ADMIN_COOKIE_SECRET
  if (!s) throw new Error('ADMIN_COOKIE_SECRET is not set')
  return s
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('hex')
}

/** Cookie value for a session starting now. */
export function issueSession(now: number = Date.now()): string {
  const expires = now + SESSION_MS
  const payload = `${now}.${expires}`
  return `${payload}.${sign(payload)}`
}

/** True when the token's signature checks out and it hasn't expired. */
export function verifySession(token: string | undefined, now: number = Date.now()): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [issued, expires, mac] = parts
  if (!/^\d+$/.test(issued) || !/^\d+$/.test(expires)) return false

  const expected = sign(`${issued}.${expires}`)
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (mac.length !== expected.length) return false
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false

  return Number(expires) > now
}

/** Constant-time passcode comparison — no early return on first wrong byte. */
export function passcodeMatches(supplied: string): boolean {
  const expected = process.env.ADMIN_PASSCODE
  if (!expected) return false

  // Hash both sides so the comparison is over equal-length buffers and the
  // passcode's length isn't leaked by timing.
  const a = crypto.createHash('sha256').update(supplied).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DAYS * 24 * 60 * 60,
}
