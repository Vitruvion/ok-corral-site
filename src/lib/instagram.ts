import type { InstagramPost } from './data'
import { getServiceSupabase } from './supabase'

/**
 * Fetches the latest N media items for the authenticated Instagram user.
 *
 * Uses the Instagram Graph API endpoint at `graph.instagram.com/me/media`.
 *
 * Auth: long-lived Instagram access token stored in Supabase
 * `service_tokens` table under id='instagram'. The token is refreshed every
 * ~50 days by a Vercel cron job (`/api/cron/refresh-instagram-token`) so
 * it never lapses. Falling back to `INSTAGRAM_ACCESS_TOKEN` env var if
 * Supabase is unavailable — this lets local dev work without the DB.
 *
 * On any failure (no token, network, HTTP error, malformed response) this
 * returns null so callers can render a fallback. Errors are logged in dev.
 */
export async function fetchInstagramPosts(limit = 6): Promise<InstagramPost[] | null> {
  const token = await getInstagramToken()
  if (!token) return null

  const url = new URL('https://graph.instagram.com/me/media')
  url.searchParams.set('fields', 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('access_token', token)

  try {
    const res = await fetch(url.toString(), {
      // Cache at the data layer; the page already has revalidate: 60.
      next: { revalidate: 300 },
    })
    if (!res.ok) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[instagram] HTTP ${res.status}: ${await res.text().catch(() => '')}`)
      }
      return null
    }
    const json = (await res.json()) as { data?: RawMedia[] }
    if (!json.data || !Array.isArray(json.data)) return null
    const now = Date.now()
    return json.data
      .map<InstagramPost | null>((m) => {
        const image =
          m.media_type === 'VIDEO' ? (m.thumbnail_url || m.media_url) : m.media_url
        if (!image) return null
        const ts = m.timestamp ? new Date(m.timestamp).getTime() : 0
        const days = ts ? Math.max(0, Math.round((now - ts) / 86_400_000)) : undefined
        return {
          id: m.id,
          image,
          caption: cleanCaption(m.caption ?? ''),
          permalink: m.permalink,
          days,
        }
      })
      .filter((p): p is InstagramPost => p !== null)
      .slice(0, limit)
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[instagram] fetch failed -', err)
    }
    return null
  }
}

/**
 * Get the active Instagram access token. Tries Supabase first (the cron-
 * refreshed source of truth), falls back to the env var if Supabase is
 * unreachable (e.g. local dev without service-role key configured).
 */
async function getInstagramToken(): Promise<string | null> {
  const sb = getServiceSupabase()
  if (sb) {
    try {
      const { data, error } = await sb
        .from('service_tokens')
        .select('access_token')
        .eq('id', 'instagram')
        .single()
      if (!error && data?.access_token) return data.access_token
      if (error && process.env.NODE_ENV !== 'production') {
        console.warn('[instagram] supabase read failed, falling back to env -', error.message)
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[instagram] supabase exception, falling back to env -', err)
      }
    }
  }
  // Fallback: env var (legacy path / local dev without service-role)
  return process.env.INSTAGRAM_ACCESS_TOKEN || null
}

type RawMedia = {
  id: string
  caption?: string
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url?: string
  thumbnail_url?: string
  permalink: string
  timestamp?: string
}

/** Truncate captions to one line for grid hover overlays. */
function cleanCaption(raw: string, maxLen = 120): string {
  const firstLine = raw.split(/\r?\n/)[0]?.trim() ?? ''
  if (firstLine.length <= maxLen) return firstLine
  return firstLine.slice(0, maxLen - 1).trimEnd() + '…'
}