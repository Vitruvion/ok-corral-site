import { NextResponse } from 'next/server'

/**
 * PWA manifest for the door scanner only.
 *
 * Served from a route handler rather than /public because it has to
 * live UNDER /admin/door — a manifest at the root would collide with
 * the site's own (start_url '/'), and installing the scanner would open
 * the homepage.
 *
 * Deliberately unauthenticated: it carries a name, some icons and a
 * start URL, and nothing else. Gating it would break installation on
 * browsers that fetch manifests without credentials, in exchange for
 * hiding nothing.
 */

export const dynamic = 'force-static'

export function GET() {
  return NextResponse.json(
    {
      name: 'OK Corral Door',
      short_name: 'Door',
      description: 'Ticket scanner for The OK Corral.',
      start_url: '/admin/door',
      scope: '/admin/door',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#0b0908',
      theme_color: '#0b0908',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } }
  )
}
