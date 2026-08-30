import { cookies } from 'next/headers'
import { ADMIN_COOKIE, verifySession } from './session'

/**
 * Per-route authorization check.
 *
 * Middleware already gates /api/admin/*, but every route calls this too.
 * Defence in depth: a matcher typo, a future route mounted outside the
 * matched prefix, or a middleware bypass shouldn't be enough to expose a
 * write endpoint. Cheap to call, and it means each route is safe on its own.
 */
export function isAuthorized(): boolean {
  try {
    return verifySession(cookies().get(ADMIN_COOKIE)?.value)
  } catch {
    return false
  }
}
