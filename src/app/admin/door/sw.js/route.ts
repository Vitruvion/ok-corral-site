import fs from 'node:fs'
import path from 'node:path'
import { NextResponse } from 'next/server'

/**
 * Service worker for the door scanner.
 *
 * ═══════════════════════════════════════════════════════════════════
 * SCOPE. Served from /admin/door/sw.js, whose DEFAULT scope would be
 * '/admin/door/' -- with a trailing slash, which does not include
 * '/admin/door' itself. Scope matching is a plain URL-prefix string
 * compare, so the page this worker exists for would sit just outside it:
 * the worker registers, activates, and can never control anything. That
 * is exactly what left the installed app unable to open with no signal.
 *
 * So the scope is widened by one character, to '/admin/door', which the
 * Service-Worker-Allowed header below permits. As a prefix that would
 * also cover a hypothetical /admin/doorway; nothing of the sort exists,
 * and it would be harmless anyway -- the fetch handler passes through
 * everything that is not the shell, so an in-scope page that is not the
 * door is simply left alone.
 *
 * The browser only routes requests from clients under that path to this
 * worker. The public site, /menu-board, /admin/menu and
 * /admin/tickets are never controlled by this worker, so their requests
 * never reach it at all -- that is a browser guarantee, not a promise
 * made by the code below.
 *
 * Note the consequence: a request's URL does not have to start with
 * /admin/door to reach this worker. A CONTROLLED door page asking for
 * /_next/static/chunks/*.js goes through here, which is exactly how the
 * shell can be cached. The homepage asking for the same chunk does not,
 * because the homepage is not controlled. Scope is about clients.
 *
 * WHAT IS CACHED
 * The shell only: the /admin/door document, the JS and CSS chunks it
 * boots from, the icons, and the web manifest. Nothing else.
 *
 * WHAT IS NEVER CACHED
 * /api/** . A cached manifest would show a stale guest list with no
 * visible age -- exactly what the age indicator in the UI exists to
 * prevent -- and a cached scan response would fake a success for a
 * ticket that was never recorded. Those requests are passed straight
 * through, untouched, offline or not.
 *
 * WHY THE PRECACHE LIST CANNOT GO STALE
 * Next chunk filenames are content-hashed and change every deploy, so a
 * hardcoded list would serve URLs that no longer exist -- offline would
 * work and online would break, which is worse than the bug this fixes.
 * Five things prevent that:
 *
 *   1. The list is read from .next/app-build-manifest.json at request
 *      time -- the actual output of the build being served.
 *   2. The cache NAME contains the build stamp, so a new deploy writes
 *      to a new cache rather than inheriting the old one.
 *   3. The worker's own bytes change every deploy (stamp + list), which
 *      is what makes the browser re-install it. A byte-identical worker
 *      is never re-installed.
 *   4. This response is Cache-Control: no-cache, so the browser's
 *      update check always reaches the network.
 *   5. On activate, every cache that is not the current one is deleted.
 *
 * And a sixth, as a belt to that braces: at install the worker reads the
 * document it just cached and picks up any /_next/static URL the list
 * missed. If the manifest read ever fails -- a platform that does not
 * ship .next to the runtime, say -- the worker still derives a correct
 * shell from the HTML actually being served.
 * ═══════════════════════════════════════════════════════════════════
 */

export const dynamic = 'force-dynamic'

/**
 * Identifies this build.
 *
 * BUILD_ID is the honest answer and works locally and on most hosts.
 * The Vercel variables are the fallback for a runtime that did not ship
 * .next -- both change on every deploy, which is the only property
 * required. 'dev' is last so a missing stamp is visible rather than
 * silently constant.
 */
function buildStamp(): string {
  try {
    const id = fs.readFileSync(path.join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim()
    if (id) return id
  } catch {
    // Not fatal -- fall through.
  }
  return (
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    'dev'
  )
}

/**
 * The door page's own JS and CSS, straight from the build manifest.
 *
 * These are the files Next itself will put in the document's script and
 * link tags, so caching exactly this set is what lets the page boot
 * with no network.
 */
function shellAssets(): string[] {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), '.next', 'app-build-manifest.json'),
      'utf8'
    )
    const manifest = JSON.parse(raw) as { pages?: Record<string, string[]> }
    const files = manifest.pages?.['/admin/door/page'] ?? []
    return files.map(f => `/_next/${f}`)
  } catch (err) {
    console.warn('[door-sw] could not read app-build-manifest; falling back to HTML scan', err)
    return []
  }
}

function workerSource(stamp: string, assets: string[]): string {
  return `/* OK Corral door scanner service worker.
   Scope: /admin/door/ only. Build: ${stamp} */

const CACHE = 'okcorral-door-${stamp}'
const DOC = '/admin/door'

/* Derived from .next/app-build-manifest.json for THIS build. */
const ASSETS = ${JSON.stringify(assets)}

const EXTRAS = [
  '/admin/door/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-icon.png',
]

/* One failure must not abandon the whole shell, so these are cached
   individually rather than with addAll -- which rejects the lot if any
   single request fails. */
async function cacheAll(cache, urls) {
  await Promise.allSettled(
    urls.map(async url => {
      try {
        const res = await fetch(url, { credentials: 'same-origin', cache: 'reload' })
        if (res.ok) await cache.put(url, res.clone())
      } catch (err) {
        console.warn('[door-sw] could not precache', url, err)
      }
    })
  )
}

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)

      /* The document first: everything else is derived from it. */
      let html = ''
      try {
        const res = await fetch(DOC, { credentials: 'same-origin', cache: 'reload' })
        /* Only a real page. A 307 to the login screen is not the shell,
           and caching it would strand the doorman on a redirect. */
        if (res.ok) {
          html = await res.clone().text()
          await cache.put(DOC, res)
        }
      } catch (err) {
        console.warn('[door-sw] could not precache the document', err)
      }

      /* Anything in the served HTML that the manifest did not list.
         This is what makes the shell correct even if the build-manifest
         read failed on the server. */
      const found = new Set(ASSETS)
      /* Anchored on the extension so this cannot pick up trailing-slash
         variants or a fragment of some longer string. */
      for (const match of html.matchAll(/["'](\\/_next\\/static\\/[^"']+?\\.(?:js|css))["']/g)) {
        found.add(match[1])
      }

      await cacheAll(cache, [...found, ...EXTRAS])
      /* Take over now rather than on the next visit. Without this the
         first load runs uncontrolled, which is what left the installed
         app unable to open with no signal. */
      await self.skipWaiting()
    })()
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      /* Every previous build's cache. Chunk names are content-hashed,
         so keeping them would only pin dead URLs. */
      const names = await caches.keys()
      await Promise.all(names.filter(n => n !== CACHE).map(n => caches.delete(n)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  /* NEVER cached, never intercepted. A stale guest list or a faked scan
     acknowledgement is far worse than an honest network error. */
  if (url.pathname.startsWith('/api/')) return

  if (!isShell(url)) return

  /* Navigations: cache first so the app opens instantly and opens at
     all with no signal, then refresh in the background for next time. */
  if (req.mode === 'navigate' || url.pathname === DOC || url.pathname === DOC + '/') {
    event.respondWith(staleWhileRevalidate(req, DOC))
    return
  }

  /* Hashed build assets are immutable -- if the name matches, the bytes
     match, so the cache is always right and the network is never worth
     waiting for. */
  event.respondWith(cacheFirst(req))
})

function isShell(url) {
  return (
    url.pathname === DOC ||
    url.pathname === DOC + '/' ||
    url.pathname === '/admin/door/manifest.webmanifest' ||
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/icon-192.png' ||
    url.pathname === '/icon-512.png' ||
    url.pathname === '/apple-icon.png'
  )
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res && res.ok && res.type === 'basic') cache.put(req, res.clone())
  return res
}

async function staleWhileRevalidate(req, key) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(key)

  const network = fetch(req)
    .then(res => {
      if (res && res.ok) cache.put(key, res.clone())
      return res
    })
    .catch(() => null)

  /* Not awaited when there is a hit: the point is that the door opens
     immediately. The catch is already attached above. */
  if (hit) return hit

  const res = await network
  return res || new Response('Offline and nothing cached yet.', { status: 503 })
}
`
}

export function GET() {
  const stamp = buildStamp()
  const assets = shellAssets()

  return new NextResponse(workerSource(stamp, assets), {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      // The worker must never be cached hard, or a fix to it cannot
      // reach a phone that already installed the old one -- and the
      // update check that swaps the precache list would never run.
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      // Widens the allowed scope by one character, from the default
      // '/admin/door/' to '/admin/door'. Without this the registration
      // below is rejected, and with the default the page at
      // '/admin/door' falls outside its own worker's scope.
      'Service-Worker-Allowed': '/admin/door',
    },
  })
}
