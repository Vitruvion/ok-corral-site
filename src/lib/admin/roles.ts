/**
 * Who may reach what.
 *
 * ═══════════════════════════════════════════════════════════════════
 * Two roles, one cookie, one policy table.
 *
 *   admin -- everything, exactly as before this file existed.
 *   door  -- /admin/door and its APIs. Nothing else.
 *
 * The door role exists because the phone at the door is the most
 * exposed device we have: it is handed between people, it sits on a
 * stool, and it holds a 30-day cookie. Before this, that cookie could
 * also rewrite the menu, move a show's date, or read every purchaser's
 * email. Now it cannot.
 *
 * THIS MODULE MUST STAY EDGE-SAFE. It is imported by middleware, which
 * runs on the edge runtime -- no node:crypto, no fs, no next/headers.
 * It is also imported by the login form in the browser, so it must
 * contain no secrets. It is a pure string-prefix policy and nothing
 * else; the signing lives in session.ts and edge-session.ts.
 * ═══════════════════════════════════════════════════════════════════
 */

export type Role = 'admin' | 'door'

export const ROLES: readonly Role[] = ['admin', 'door']

export function isRole(v: unknown): v is Role {
  return v === 'admin' || v === 'door'
}

/**
 * Where each role goes when it has nowhere particular to be.
 *
 * A door person should never see the dashboard: it is four cards, three
 * of which would bounce them straight back here.
 */
export function homeFor(role: Role): string {
  return role === 'door' ? '/admin/door' : '/admin'
}

/**
 * The door role's entire world.
 *
 * Prefixes, not exact matches, so /api/admin/door/scan is covered by
 * the same entry as /api/admin/door/manifest. Kept deliberately short:
 * anything not on this list is admin-only, so a route added tomorrow is
 * closed to the door phone by default rather than open by default.
 */
const DOOR_ALLOWED: readonly string[] = [
  '/admin/door',
  '/api/admin/door',
  // Signing out must work from the door phone, or the only way off a
  // shared device is clearing site data.
  '/api/admin/logout',
]

/**
 * True when `role` may reach `pathname`.
 *
 * Pure and synchronous on purpose -- middleware, every API route, and
 * the login form all ask the same function, so there is one answer to
 * "may this role open this URL" rather than three that can drift.
 */
export function canAccess(role: Role, pathname: string): boolean {
  if (role === 'admin') return true
  return DOOR_ALLOWED.some(
    prefix => pathname === prefix || pathname.startsWith(prefix + '/')
  )
}
