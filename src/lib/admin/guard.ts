import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE, sessionRole } from './session'
import { homeFor, type Role } from './roles'

/**
 * Per-route authorization check.
 *
 * Middleware already gates /admin and /api/admin, but every route calls
 * one of these too. Defence in depth: a matcher typo, a future route
 * mounted outside the matched prefix, or a middleware bypass shouldn't
 * be enough to expose a write endpoint. Cheap to call, and it means
 * each route is safe on its own.
 *
 * WITH TWO ROLES, "authorized" IS NO LONGER ONE QUESTION. `isAuthorized`
 * now means only "holds a valid session of some kind" — true for the
 * door phone. It is the right check for the door's own routes and the
 * WRONG check everywhere else. Anything that edits the menu, the shows,
 * or reads purchaser details must call `isAdmin`.
 */

/** The role on the current request's cookie, or null. */
export function currentRole(): Role | null {
  try {
    return sessionRole(cookies().get(ADMIN_COOKIE)?.value)
  } catch {
    return null
  }
}

/** Any valid session — admin OR door. Correct only for door routes. */
export function isAuthorized(): boolean {
  return currentRole() !== null
}

/** Full access. The check for everything that is not the door. */
export function isAdmin(): boolean {
  return currentRole() === 'admin'
}

/**
 * Page-level gate for the admin-only screens.
 *
 * Two different failures, two different destinations. Someone with no
 * session is sent to sign in and brought back to `next` afterwards.
 * Someone holding a valid DOOR session is not logged out and must not
 * be sent to the login page -- signing in again would hand them the
 * same cookie and the same refusal. They go to their own home instead,
 * which is where middleware already sends them; this runs only if
 * middleware was bypassed, and it must agree with it.
 */
export function requireAdminPage(next: string): void {
  const role = currentRole()
  if (role === 'admin') return
  redirect(role ? homeFor(role) : `/admin/login?next=${encodeURIComponent(next)}`)
}
