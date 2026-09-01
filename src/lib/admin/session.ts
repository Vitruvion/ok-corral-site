import crypto from 'node:crypto'
import { isRole, type Role } from './roles'

/**
 * Admin session: shared passcodes for three brothers, deliberately small.
 *
 * The cookie holds `<issuedAt>.<expiresAt>.<role>.<hmac>` — never the
 * passcode itself. The HMAC is over the timestamps AND THE ROLE with
 * ADMIN_COOKIE_SECRET, so a client can't extend its own expiry, and a
 * door session can't promote itself by editing one segment.
 *
 * ═══════════════════════════════════════════════════════════════════
 * LEGACY TOKENS. Before roles there were three segments and no role:
 * `<issuedAt>.<expiresAt>.<hmac>`, signed over `<issuedAt>.<expiresAt>`.
 * Those cookies are still in the owners' phones with up to 30 days to
 * run, and invalidating them would sign everyone out for a change that
 * gives them nothing. So a three-segment token still verifies, against
 * the old payload, and resolves to 'admin' — which is the access it
 * already had. Nothing is widened: it is the same holder with the same
 * rights until it expires and is reissued in the new shape.
 *
 * This is not a downgrade path an attacker can take. Dropping the role
 * segment from a door token leaves a three-part token whose MAC was
 * computed over `issued.expires.door`, but the legacy check recomputes
 * over `issued.expires` — different string, different MAC, rejected.
 * ═══════════════════════════════════════════════════════════════════
 *
 * Node crypto only — this module must not be imported from middleware,
 * which runs on the edge runtime. See src/lib/admin/edge-session.ts.
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
export function issueSession(role: Role = 'admin', now: number = Date.now()): string {
  const expires = now + SESSION_MS
  const payload = `${now}.${expires}.${role}`
  return `${payload}.${sign(payload)}`
}

/**
 * The role this token proves, or null if it proves nothing.
 *
 * Returns the role rather than a boolean because every caller needs to
 * know which of the two it is holding — a bare "is signed in" is what
 * this codebase had before, and it is exactly the check that let the
 * door phone edit the menu.
 */
export function sessionRole(token: string | undefined, now: number = Date.now()): Role | null {
  if (!token) return null
  const parts = token.split('.')

  // <issued>.<expires>.<role>.<mac> — current. Role is inside the payload.
  // <issued>.<expires>.<mac>        — legacy, pre-roles. Admin.
  let issued: string, expires: string, mac: string, payload: string, role: Role
  if (parts.length === 4) {
    ;[issued, expires] = parts
    mac = parts[3]
    if (!isRole(parts[2])) return null
    role = parts[2]
    payload = `${issued}.${expires}.${role}`
  } else if (parts.length === 3) {
    ;[issued, expires, mac] = parts
    role = 'admin'
    payload = `${issued}.${expires}`
  } else {
    return null
  }

  if (!/^\d+$/.test(issued) || !/^\d+$/.test(expires)) return null

  const expected = sign(payload)
  // Length check first: timingSafeEqual throws on a length mismatch.
  if (mac.length !== expected.length) return null
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null

  return Number(expires) > now ? role : null
}

/** True when the token's signature checks out and it hasn't expired. */
export function verifySession(token: string | undefined, now: number = Date.now()): boolean {
  return sessionRole(token, now) !== null
}

/**
 * Which role this passcode unlocks, or null.
 *
 * BOTH are always compared, and the admin result is preferred, so the
 * work done is identical whichever passcode was typed — a door
 * passcode must not be identifiable by answering faster than an admin
 * one. The person signing in never picks a role; the passcode decides.
 */
export function passcodeRole(supplied: string): Role | null {
  const admin = matches(supplied, process.env.ADMIN_PASSCODE)
  const door = matches(supplied, process.env.DOOR_PASSCODE)
  if (admin) return 'admin'
  if (door) return 'door'
  return null
}

/** Constant-time passcode comparison — no early return on first wrong byte. */
function matches(supplied: string, expected: string | undefined): boolean {
  // An unset passcode must never match, and must never match "" either.
  if (!expected) return false

  // Hash both sides so the comparison is over equal-length buffers and the
  // passcode's length isn't leaked by timing.
  const a = crypto.createHash('sha256').update(supplied).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

/** Kept for callers that only care whether the admin passcode was given. */
export function passcodeMatches(supplied: string): boolean {
  return passcodeRole(supplied) === 'admin'
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_DAYS * 24 * 60 * 60,
}
