import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Cron route: refreshes the long-lived Instagram access token.
 *
 * Schedule: see `vercel.json` — runs every ~50 days, comfortably before
 * the 60-day expiry window. Idempotent: running it more often than
 * necessary is fine (Instagram allows refreshing any token >24h old).
 *
 * Auth: requires `Authorization: Bearer <CRON_SECRET>` header. Vercel's
 * cron infrastructure sets this automatically when CRON_SECRET is
 * configured as an env var; manual hits must include it.
 *
 * Flow:
 *  1. Read current token from `service_tokens` where id='instagram'
 *  2. GET https://graph.instagram.com/refresh_access_token with grant_type=ig_refresh_token
 *  3. Update `service_tokens` with new token + expires_at + refreshed_at
 *  4. Return JSON status
 *
 * On failure: returns 500 with error JSON, does NOT update the row (so
 * the old token keeps working until manual intervention).
 */
export async function GET(request: Request) {
  // Auth
  const auth = request.headers.get('authorization') || ''
  const expected = `Bearer ${process.env.CRON_SECRET}`
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sb = getServiceSupabase()
  if (!sb) {
    return NextResponse.json(
      { error: 'supabase-unavailable', detail: 'Service-role client could not be initialized' },
      { status: 500 }
    )
  }

  // 1. Read current token
  const { data: row, error: readErr } = await sb
    .from('service_tokens')
    .select('access_token, expires_at, refreshed_at')
    .eq('id', 'instagram')
    .single()

  if (readErr || !row?.access_token) {
    return NextResponse.json(
      { error: 'read-failed', detail: readErr?.message || 'no row' },
      { status: 500 }
    )
  }

  // 2. Refresh via Instagram API
  const refreshUrl = new URL('https://graph.instagram.com/refresh_access_token')
  refreshUrl.searchParams.set('grant_type', 'ig_refresh_token')
  refreshUrl.searchParams.set('access_token', row.access_token)

  let refreshed: RefreshResponse
  try {
    const res = await fetch(refreshUrl.toString())
    const body = (await res.json()) as RefreshResponse | InstagramError
    if (!res.ok || 'error' in body) {
      return NextResponse.json(
        {
          error: 'refresh-failed',
          status: res.status,
          detail: 'error' in body ? body.error : 'unknown',
        },
        { status: 500 }
      )
    }
    refreshed = body
  } catch (err) {
    return NextResponse.json(
      { error: 'refresh-exception', detail: String(err) },
      { status: 500 }
    )
  }

  if (!refreshed.access_token || !refreshed.expires_in) {
    return NextResponse.json(
      { error: 'refresh-malformed', detail: 'missing access_token or expires_in' },
      { status: 500 }
    )
  }

  // 3. Update Supabase row
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()
  const { error: updateErr } = await sb
    .from('service_tokens')
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
      refreshed_at: new Date().toISOString(),
    })
    .eq('id', 'instagram')

  if (updateErr) {
    return NextResponse.json(
      { error: 'update-failed', detail: updateErr.message },
      { status: 500 }
    )
  }

  // 4. Success
  return NextResponse.json({
    ok: true,
    message: 'Instagram token refreshed',
    expires_at: newExpiresAt,
    token_length: refreshed.access_token.length,
    days_until_expiry: Math.round(refreshed.expires_in / 86400),
  })
}

type RefreshResponse = {
  access_token: string
  token_type: string
  expires_in: number
}

type InstagramError = {
  error: {
    message: string
    type: string
    code: number
  }
}