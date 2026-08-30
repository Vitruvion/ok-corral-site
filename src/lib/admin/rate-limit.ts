/**
 * Login throttle: 5 attempts per IP per 15 minutes, held in memory.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ READ THIS BEFORE RELYING ON IT.                                     │
 * │                                                                     │
 * │ This is NOT real brute-force protection in production.              │
 * │                                                                     │
 * │ The Map lives in one serverless instance's memory. On Vercel there  │
 * │ is no single long-lived process: requests are spread across         │
 * │ instances, instances are recycled, and every cold start begins with │
 * │ an empty Map. An attacker doing nothing cleverer than requesting in │
 * │ parallel will land on different instances and get far more than 5   │
 * │ attempts — the real ceiling is unbounded, not 5 per 15 minutes.     │
 * │ Local testing looks far stronger than production actually is.       │
 * │                                                                     │
 * │ It is kept because it costs nothing and does stop the casual case   │
 * │ (someone repeatedly guessing from one browser). The load-bearing    │
 * │ defence is elsewhere: a long shared passcode, and the fixed delay   │
 * │ on every failed login in the login route, which survives cold       │
 * │ starts because it is per-request rather than per-instance.          │
 * │                                                                     │
 * │ If this ever guards something worth attacking, replace it with a    │
 * │ shared store (Upstash/Redis) or a real auth provider. Don't just    │
 * │ raise the numbers here — they are not the constraint.               │
 * └─────────────────────────────────────────────────────────────────────┘
 */

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

/** Drop expired buckets so the map can't grow without bound. */
function sweep(now: number) {
  if (buckets.size < 512) return
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k)
  }
}

export type RateResult = { allowed: boolean; remaining: number; retryAfterSec: number }

export function checkRateLimit(ip: string, now: number = Date.now()): RateResult {
  sweep(now)
  const b = buckets.get(ip)

  if (!b || b.resetAt <= now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, retryAfterSec: 0 }
  }

  if (b.count >= MAX_ATTEMPTS) {
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) }
  }

  b.count += 1
  return { allowed: true, remaining: MAX_ATTEMPTS - b.count, retryAfterSec: 0 }
}

/** Called on success so a correct passcode doesn't leave the IP throttled. */
export function clearRateLimit(ip: string) {
  buckets.delete(ip)
}

/** Best-effort client IP. Vercel sets x-forwarded-for; take the first hop. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return headers.get('x-real-ip')?.trim() || 'unknown'
}
