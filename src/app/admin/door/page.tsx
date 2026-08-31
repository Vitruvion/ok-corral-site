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

export const metadata: Metadata = {
  title: 'Door — OK Corral',
  robots: { index: false, follow: false },
  // Overrides the site manifest declared in the root layout, whose
  // start_url is '/'. Installing from here must open the scanner, not
  // the homepage. use-credentials because a manifest is fetched with
  // credentials omitted by default and this one lives behind /admin.
  manifest: '/admin/door/manifest.webmanifest',
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
