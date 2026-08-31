import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAuthorized } from '@/lib/admin/guard'
import {
  loadTicketEvents,
  loadUnconfiguredEvents,
  type EventTickets,
  type UnconfiguredEvent,
} from '@/lib/tickets/manifest'
import TicketsView from './TicketsView'
import styles from './tickets.module.css'

/**
 * /admin/tickets — sales and will-call.
 *
 * Gated by the SAME middleware matcher and the SAME cookie as
 * /admin/menu. No new auth: a second login is a second thing to leak, a
 * second thing to forget, and a second thing to rotate.
 *
 * Until the Phase 2 scanner ships, the search box on this page IS the
 * door process.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tickets — OK Corral',
  robots: { index: false, follow: false },
}

export default async function AdminTicketsPage() {
  // Middleware already gates this; the page checks too, same reasoning
  // as the API routes.
  if (!isAuthorized()) redirect('/admin/login?next=/admin/tickets')

  let events: EventTickets[] = []
  let unconfigured: UnconfiguredEvent[] = []
  let loadError: string | null = null
  try {
    ;[events, unconfigured] = await Promise.all([
      loadTicketEvents(),
      loadUnconfiguredEvents(),
    ])
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Could not load ticket sales.'
  }

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <div>
          <span className={styles.kicker}>◆ Tickets</span>
          <h1 className={styles.title}>At the Door</h1>
        </div>
      </header>

      {loadError && <p className={styles.loadError}>{loadError}</p>}

      <TicketsView events={events} unconfigured={unconfigured} />
    </main>
  )
}
