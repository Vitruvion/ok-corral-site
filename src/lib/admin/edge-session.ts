/**
 * Edge-runtime half of the admin session check.
 *
 * Next middleware runs on the edge runtime, where `node:crypto` doesn't
 * exist — so verification there has to go through Web Crypto. The token
 * format and secret are identical to src/lib/admin/session.ts; only the
 * primitive differs. Keep the two in step.
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

export async function verifySessionEdge(
  token: string | undefined,
  now: number = Date.now()
): Promise<boolean> {
  if (!token) return false
  const secret = process.env.ADMIN_COOKIE_SECRET
  if (!secret) return false

  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [issued, expires, mac] = parts
  if (!/^\d+$/.test(issued) || !/^\d+$/.test(expires)) return false

  const expected = await hmacHex(`${issued}.${expires}`, secret)
  if (!safeEqual(mac, expected)) return false

  return Number(expires) > now
}
