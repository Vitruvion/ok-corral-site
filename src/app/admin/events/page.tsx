import type { Metadata } from 'next'
import { requireAdminPage } from '@/lib/admin/guard'
import { listEvents, type AdminEvent } from '@/lib/admin/events-repo'
import { listRecurring, type AdminRecurring } from '@/lib/admin/recurring-repo'
import BackToDashboard from '../BackToDashboard'
import EventsEditor from './EventsEditor'
import styles from './events.module.css'

/**
 * /admin/events — add and edit shows, and the weekly specials, from a
 * phone.
 *
 * Gated by the SAME middleware and the SAME corral_admin cookie as
 * /admin/menu. No separate login: a second one is a second thing to
 * leak, forget and rotate.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Shows & Events — OK Corral',
  robots: { index: false, follow: false },
}

export default async function AdminEventsPage() {
  // Middleware already gates this; the page checks too, same reasoning
  // as the API routes.
  requireAdminPage('/admin/events')

  // Loaded independently: a failure reading one list should not hide
  // the other.
  const [shows, weekly] = await Promise.allSettled([listEvents(), listRecurring()])
  const events: AdminEvent[] = shows.status === 'fulfilled' ? shows.value : []
  const recurring: AdminRecurring[] = weekly.status === 'fulfilled' ? weekly.value : []
  const why = (r: PromiseSettledResult<unknown>, fallback: string) =>
    r.status === 'rejected' ? (r.reason instanceof Error ? r.reason.message : fallback) : null
  const loadError = [why(shows, 'Could not load shows.'), why(weekly, 'Could not load weekly events.')]
    .filter((m, i, all) => m && all.indexOf(m) === i)
    .join(' ') || null

  return (
    <main className={styles.page}>
      <BackToDashboard />

      <header className={styles.head}>
        <div>
          <span className={styles.kicker}>◆ Shows &amp; Events</span>
          <h1 className={styles.title}>What&rsquo;s On</h1>
        </div>
      </header>

      {loadError && <p className={styles.loadError}>{loadError}</p>}

      <EventsEditor initial={events} initialRecurring={recurring} />
    </main>
  )
}
