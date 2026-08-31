import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, verifySessionEdge } from '@/lib/admin/edge-session'

/**
 * Gate for /admin and /api/admin.
 *
 * This is a first line of defence only — every admin route re-checks the
 * cookie itself, so a middleware misconfiguration can't silently open the
 * API. Page requests get redirected to the login screen; API requests get a
 * 401 JSON body, because a redirect to HTML is useless to fetch().
 *
 * /menu-board is intentionally NOT matched: the TV has no keyboard and no
 * login. The matcher below is the only thing standing between the kiosk and
 * a redirect loop, so keep it narrow.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const isApi = pathname.startsWith('/api/admin')

  // The login page and its endpoint must stay reachable without a session,
  // or there'd be no way to get one.
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return NextResponse.next()
  }

  // The door scanner's PWA plumbing. Both are static metadata -- a name,
  // some icon paths, and cache logic -- and neither can reach any data.
  //
  // They are exempt because gating them breaks installation rather than
  // protecting anything: a web app manifest is fetched with credentials
  // omitted, so a gated one is redirected to the login page and fails to
  // parse, and a service worker whose script 302s cannot update on a
  // phone whose cookie lapsed mid-shift. The manifest DATA -- codes and
  // purchaser names -- is at /api/admin/door/manifest and stays gated.
  if (pathname === '/admin/door/manifest.webmanifest' || pathname === '/admin/door/sw.js') {
    return NextResponse.next()
  }

  const ok = await verifySessionEdge(req.cookies.get(ADMIN_COOKIE)?.value)
  if (ok) return NextResponse.next()

  if (isApi) {
    return NextResponse.json(
      { error: 'Not authorized.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const url = req.nextUrl.clone()
  url.pathname = '/admin/login'
  url.search = ''
  // Bring them back where they were headed once they're in.
  if (pathname !== '/admin') url.searchParams.set('next', pathname + search)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
