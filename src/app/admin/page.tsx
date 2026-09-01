import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdminPage } from '@/lib/admin/guard'
import { loadDashboard, type DashboardSummary } from '@/lib/admin/dashboard'
import SignOut from './SignOut'
import styles from './dashboard.module.css'

/**
 * /admin — the way in.
 *
 * Until this existed, /admin was a 404 and the four editors were four
 * URLs to remember. Same cookie, same middleware, same per-route check
 * as every other admin screen.
 *
 * DOOR ROLE NEVER SEES THIS. Three of the four cards would bounce them
 * straight back, so middleware sends a door session to /admin/door and
 * requireAdminPage agrees with it if middleware is ever bypassed.
 *
 * The summary above the cards is the point of the page. A screen that
 * only links elsewhere is worth less than the bookmark it replaces --
 * opening this should tell you something before you tap anything.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admin — OK Corral',
  robots: { index: false, follow: false },
}

const CARDS = [
  { href: '/admin/menu', label: 'Menu', hint: 'Drinks and prices' },
  { href: '/admin/events', label: 'Shows', hint: 'Dates, posters, tickets' },
  { href: '/admin/tickets', label: 'Tickets', hint: 'Sales and will-call' },
  { href: '/admin/door', label: 'Door', hint: 'Scan and sell at the door' },
] as const

export default async function AdminHomePage() {
  requireAdminPage('/admin')

  let summary: DashboardSummary | null = null
  let loadError: string | null = null
  try {
    summary = await loadDashboard()
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'Could not load the summary.'
  }

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <div>
          <span className={styles.kicker}>◆ Staff</span>
          <h1 className={styles.title}>The O.K. Corral</h1>
        </div>
      </header>

      {loadError && <p className={styles.loadError}>{loadError}</p>}

      {summary && <Summary summary={summary} />}

      <nav className={styles.cards}>
        {CARDS.map(c => (
          <Link key={c.href} href={c.href} className={styles.card}>
            <span className={styles.cardLabel}>{c.label}</span>
            <span className={styles.cardHint}>{c.hint}</span>
            <span className={styles.cardChevron} aria-hidden="true">›</span>
          </Link>
        ))}
      </nav>

      <SignOut />
    </main>
  )
}

function Summary({ summary }: { summary: DashboardSummary }) {
  const { nextShow, notTicketReady } = summary

  return (
    <section className={styles.summary}>
      {nextShow ? (
        <>
          <span className={styles.summaryKicker}>Next up</span>
          <p className={styles.summaryName}>{nextShow.name}</p>
          <p className={styles.summaryDate}>{nextShow.dateLabel}</p>
          <p className={styles.summaryLine}>{describe(nextShow)}</p>
        </>
      ) : (
        // Plainly, rather than an empty shell with dashes in it.
        <>
          <span className={styles.summaryKicker}>Next up</span>
          <p className={styles.summaryNone}>No upcoming shows.</p>
          <p className={styles.summaryLine}>
            <Link href="/admin/events" className={styles.summaryLink}>
              Add one
            </Link>
          </p>
        </>
      )}

      {notTicketReady > 0 && (
        <Link href="/admin/tickets#not-selling" className={styles.nag}>
          {notTicketReady} upcoming {notTicketReady === 1 ? 'show is' : 'shows are'} not
          selling tickets ›
        </Link>
      )}
    </section>
  )
}

/**
 * The one line under the date.
 *
 * A free show is the normal case at this bar, not a problem, so it says
 * so flatly. Capacity is nullable and null means unlimited -- never
 * render "38 of 0".
 */
function describe(show: NonNullable<DashboardSummary['nextShow']>): string {
  if (!show.ticketsOnSale) return 'Free admission — no tickets on sale'
  const o = show.occupancy
  if (!o) return 'Selling tickets'
  if (o.capacity === null) return `Selling tickets · ${o.admitted} admitted`
  return `Selling tickets · ${o.admitted} of ${o.capacity} admitted`
}
