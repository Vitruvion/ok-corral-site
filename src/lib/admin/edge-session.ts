import { isRole, type Role } from './roles'

/**
 * Edge-runtime half of the admin session check.
 *
 * Next middleware runs on the edge runtime, where `node:crypto` doesn't
 * exist — so verification there has to go through Web Crypto. The token
 * format, the payload that gets signed, the legacy three-segment
 * fallback and the secret are identical to src/lib/admin/session.ts;
 * only the primitive differs. Keep the two in step — the role is part
 * of the signed payload, so a divergence here is not a cosmetic bug,
 * it is middleware and the route handlers disagreeing about who someone
 * is.
 */

export const ADMIN_COOKIE = 'corral_admin'

const encoder = new TextEncoder()

async function hmacHex(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Length-independent, non-short-circuiting comparison. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * The role this token proves, or null.
 *
 * A three-segment token predates roles and resolves to 'admin' — see
 * the LEGACY TOKENS note in session.ts for why that is safe.
 */
export async function sessionRoleEdge(
  token: string | undefined,
  now: number = Date.now()
): Promise<Role | null> {
  if (!token) return null
  const secret = process.env.ADMIN_COOKIE_SECRET
  if (!secret) return null

  const parts = token.split('.')

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

  const expected = await hmacHex(payload, secret)
  if (!safeEqual(mac, expected)) return null

  return Number(expires) > now ? role : null
}

export async function verifySessionEdge(
  token: string | undefined,
  now: number = Date.now()
): Promise<boolean> {
  return (await sessionRoleEdge(token, now)) !== null
}
