import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE, sessionRoleEdge } from '@/lib/admin/edge-session'
import { canAccess, homeFor } from '@/lib/admin/roles'

/**
 * Gate for /admin and /api/admin.
 *
 * This is a first line of defence only — every admin route re-checks the
 * cookie AND THE ROLE itself, so a middleware misconfiguration can't
 * silently open the API. Page requests get redirected to the login
 * screen; API requests get a 401 JSON body, because a redirect to HTML
 * is useless to fetch().
 *
 * Two failures are distinguished, because they are different problems:
 *   no session          -> /admin/login, with ?next= to come back to
 *   wrong role          -> that role's own home, with no ?next=
 * Sending a door-role holder to the login page would be a loop: their
 * cookie is perfectly valid and signing in again would produce the same
 * one. They are not logged out, they are in the wrong place.
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
  //
  // Roles change nothing here: these were already unauthenticated, and
  // both roles need them.
  if (pathname === '/admin/door/manifest.webmanifest' || pathname === '/admin/door/sw.js') {
    return NextResponse.next()
  }

  const role = await sessionRoleEdge(req.cookies.get(ADMIN_COOKIE)?.value)

  if (!role) {
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

  if (!canAccess(role, pathname)) {
    if (isApi) {
      // 401 as specified, though the session is valid and this is really
      // a 403 -- re-authenticating with the same passcode would produce
      // the same cookie and the same refusal. Nothing in this codebase
      // retries a 401 by prompting, so the distinction is currently
      // cosmetic; the body says which of the two it actually is.
      return NextResponse.json(
        { error: 'Not authorized for this area.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const url = req.nextUrl.clone()
    url.pathname = homeFor(role)
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
