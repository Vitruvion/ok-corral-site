import type { Metadata } from 'next'
import { requireAdminPage } from '@/lib/admin/guard'
import { listEvents, type AdminEvent } from '@/lib/admin/events-repo'
import EventsEditor from './EventsEditor'
import styles from './events.module.css'

/**
 * /admin/events — add and edit shows from a phone.
 *
 * Gated by the SAME middleware and the SAME corral_admin cookie as
 * /admin/menu. No separate login: a second one is a second thing to
 * leak, forget and rotate.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Shows — OK Corral',
  robots: { index: false, follow: false },
}

export default async function AdminEventsPage() {
  // Middleware already gates this; the page checks too, same reasoning
  // as the API routes.
  requireAdminPage('/admin/events')

  let events: AdminEvent[] = []
  let loadError: string | null = null
  try {
    events = await listEvents()
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Could not load shows.'
  }

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <div>
          <span className={styles.kicker}>◆ Shows</span>
          <h1 className={styles.title}>What&rsquo;s On</h1>
        </div>
      </header>

      {loadError && <p className={styles.loadError}>{loadError}</p>}

      <EventsEditor initial={events} />
    </main>
  )
}
