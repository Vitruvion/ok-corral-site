import type { InstagramPost } from './data'

/**
 * Fetches the latest N media items for the authenticated Instagram user.
 *
 * Uses the Instagram Graph API endpoint at `graph.instagram.com/me/media`
 * — works for both classic Instagram accounts (Instagram Login flow,
 * formerly Basic Display) and Business/Creator accounts.
 *
 * Auth: long-lived `INSTAGRAM_ACCESS_TOKEN` env var (60-day TTL, must be
 * refreshed before expiry — see docs/instagram-setup.md).
 *
 * On any failure (no token, network, HTTP error, malformed response) this
 * returns null so callers can render a fallback. Errors are logged in dev.
 */
export async function fetchInstagramPosts(limit = 6): Promise<InstagramPost[] | null> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
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
      // VIDEO posts have media_url pointing at the video; thumbnail_url has the still
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
      console.warn('[instagram] fetch failed —', err)
    }
    return null
  }
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
