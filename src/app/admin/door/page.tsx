import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAuthorized } from '@/lib/admin/guard'
import { listDoorEvents, type DoorEvent } from '@/lib/tickets/door'
import DoorClient from './DoorClient'
import DoorPwa from './DoorPwa'
import styles from './door.module.css'

/**
 * /admin/door — the door scanner.
 *
 * Gated by the SAME middleware and the SAME corral_admin cookie as the
 * rest of /admin. No separate login: the cookie lasts 30 days, so it is
 * entered once at home and never at the door with a line waiting.
 */

export const dynamic = 'force-dynamic'

/**
 * Installability metadata, scoped to THIS ROUTE ONLY.
 *
 * None of it may move to the root layout: the public site must not
 * advertise itself as an installable app called "Door". Page-level
 * metadata overrides the layout's per field, which is exactly the
 * granularity needed here.
 *
 * All of it is emitted server-side, at request time. A link injected
 * after hydration is unreliable -- Safari reads the document head at
 * the moment Share is tapped, and there is no guarantee client code has
 * run by then.
 */
export const metadata: Metadata = {
  title: 'Door — OK Corral',
  robots: { index: false, follow: false },

  // Overrides the site manifest declared in the root layout, whose
  // start_url is '/'. Installing from here must open the scanner, not
  // the homepage.
  //
  // Next emits this link with crossorigin="use-credentials", which is
  // what a gated manifest needs -- the default fetch omits credentials,
  // and a manifest behind /admin would otherwise be answered with the
  // login redirect and fail to parse. Worth knowing it comes from the
  // framework and not from here, in case that ever changes.
  manifest: '/admin/door/manifest.webmanifest',

  // iOS does not fully honour the web manifest for standalone launch.
  // Without apple-mobile-web-app-capable in particular, Add to Home
  // Screen produces an ordinary bookmark that opens in Safari with all
  // its chrome -- the manifest is read, then largely ignored. These
  // three are what actually make it launch as an app on an iPhone,
  // which is the only device this runs on.
  appleWebApp: {
    capable: true,
    // The name under the home-screen icon. Short on purpose: iOS
    // truncates hard, and "OK Corral Door" would not survive it.
    title: 'Door',
    // Lets the scanner's dark UI run under the status bar rather than
    // sitting below an opaque bar in a different colour.
    statusBarStyle: 'black-translucent',
  },

  // Stated explicitly rather than inherited. The apple-touch-icon is
  // what iOS puts on the home screen, and it should not depend on a
  // field in the root layout that someone could reasonably change.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any', type: 'image/x-icon' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export default async function DoorPage() {
  // Middleware gates this; the page checks too, same as every other
  // admin route. The manifest behind it is the guest list.
  if (!isAuthorized()) redirect('/admin/login?next=/admin/door')

  let events: DoorEvent[] = []
  let loadError: string | null = null
  try {
    events = await listDoorEvents()
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Could not load events.'
  }

  return (
    <main className={styles.page}>
      <DoorPwa />
      <header className={styles.head}>
        <span className={styles.kicker}>◆ Door</span>
        <h1 className={styles.title}>Scan In</h1>
      </header>

      {loadError && <p className={styles.loadError}>{loadError}</p>}

      <DoorClient events={events} />
    </main>
  )
}
