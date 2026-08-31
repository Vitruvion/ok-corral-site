import { NextResponse } from 'next/server'

/**
 * Service worker for the door scanner.
 *
 * ═══════════════════════════════════════════════════════════════════
 * SCOPE. This is served from /admin/door/sw.js, so its scope is
 * /admin/door/ and the browser will not even route requests from
 * elsewhere to it. On top of that, the fetch handler below refuses
 * anything whose path does not start with /admin/door — belt and
 * braces, because the failure mode is severe.
 *
 * okcorralsaloon.com is served through ISR. A service worker that
 * cached the public site would hand customers a stale homepage, a
 * stale menu, or a sold-out show still advertising tickets, and it
 * would keep doing it after a deploy. That is a far worse outcome than
 * the door lacking an offline shell, so the worker is confined rather
 * than merely configured.
 *
 * It caches only the scanner's own shell. It never caches API
 * responses: the manifest and scan endpoints are no-store, and a cached
 * guest list is exactly the thing IndexedDB is for, with a visible age
 * on it. A silently cached one would be a stale list nobody could see
 * the age of.
 * ═══════════════════════════════════════════════════════════════════
 *
 * Served from a route handler rather than /public because a worker's
 * scope comes from where the script is served, and /public serves at
 * the root — which would give it authority over the whole site.
 */

export const dynamic = 'force-static'

const SW = `/* OK Corral door scanner service worker. Scope: /admin/door/ only. */
const CACHE = 'okcorral-door-v1'
const SCOPE_PREFIX = '/admin/door'

// The shell only. No API responses, ever.
const SHELL = ['/admin/door', '/icon-192.png', '/icon-512.png', '/apple-icon.png']

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // Anything not ours is left entirely alone -- not cached, not even
  // responded to. The browser handles it as if no worker existed.
  if (url.origin !== self.location.origin) return
  if (!url.pathname.startsWith(SCOPE_PREFIX) && !isSharedAsset(url.pathname)) return

  // API traffic is always live. A cached manifest would be a stale
  // guest list with no visible age, which is worse than no manifest.
  if (url.pathname.startsWith('/api/')) return

  // Network first, cache as a fallback: online is the normal case at
  // this door, and a stale shell should only ever appear when there is
  // genuinely nothing better.
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone()
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {})
        }
        return res
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match('/admin/door')))
  )
})

function isSharedAsset(pathname) {
  // The home-screen icons live at the root but belong to the installed
  // app. Nothing else outside /admin/door is eligible.
  return (
    pathname === '/icon-192.png' ||
    pathname === '/icon-512.png' ||
    pathname === '/apple-icon.png'
  )
}
`

export function GET() {
  return new NextResponse(SW, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      // The worker itself must never be cached hard, or a fix to it
      // cannot reach a phone that already installed the old one.
      'Cache-Control': 'no-cache',
      // Scope is already /admin/door/ by path; stated explicitly so a
      // reviewer can see it was not left to chance.
      'Service-Worker-Allowed': '/admin/door/',
    },
  })
}
