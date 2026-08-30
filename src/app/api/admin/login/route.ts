import { NextResponse } from 'next/server'
import { z } from 'zod'
import { ADMIN_COOKIE, cookieOptions, issueSession, passcodeMatches } from '@/lib/admin/session'
import { checkRateLimit, clearRateLimit, clientIp } from '@/lib/admin/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Body = z.object({
  passcode: z.string().min(1).max(200),
})

/**
 * Fixed cost on every failed login.
 *
 * The in-memory rate limiter is per-instance and evaporates on cold start
 * (see src/lib/admin/rate-limit.ts), so it can't be the thing that makes
 * guessing expensive. This can: it is charged per request, so it survives
 * cold starts and applies no matter which instance answers. 500ms is
 * imperceptible to the three people who know the passcode and turns an
 * exhaustive search into something that takes far longer than it is worth.
 *
 * It is deliberately a flat delay, not a comparison-time defence — the
 * passcode check is already constant-time (hashed, timingSafeEqual), so
 * success and failure paths don't leak timing on their own.
 */
const FAILED_LOGIN_DELAY_MS = 500
const penalize = () => new Promise(resolve => setTimeout(resolve, FAILED_LOGIN_DELAY_MS))

export async function POST(req: Request) {
  if (!process.env.ADMIN_PASSCODE || !process.env.ADMIN_COOKIE_SECRET) {
    console.error('[admin/login] ADMIN_PASSCODE or ADMIN_COOKIE_SECRET not set')
    return NextResponse.json({ error: 'Admin login is not configured.' }, { status: 503 })
  }

  const ip = clientIp(req.headers)
  const rate = checkRateLimit(ip)
  if (!rate.allowed) {
    await penalize()
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${Math.ceil(rate.retryAfterSec / 60)} minutes.` },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } }
    )
  }

  let parsed
  try {
    parsed = Body.safeParse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter the passcode.' }, { status: 400 })
  }

  if (!passcodeMatches(parsed.data.passcode)) {
    // Deliberately vague, it costs an attempt, and it costs wall-clock time.
    await penalize()
    return NextResponse.json(
      { error: `Wrong passcode. ${rate.remaining} attempt${rate.remaining === 1 ? '' : 's'} left.` },
      { status: 401 }
    )
  }

  clearRateLimit(ip)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, issueSession(), cookieOptions)
  return res
}
