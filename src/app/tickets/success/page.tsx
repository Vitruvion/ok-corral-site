import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND } from '@/lib/data'
import styles from './success.module.css'

/**
 * /tickets/success — where Stripe returns a buyer after payment.
 *
 * Deliberately does NOT show the ticket codes. The webhook is what
 * issues them, and it routinely lands after the buyer is already back
 * here; a page that tried to list codes would show an empty box on a
 * successful purchase, which reads as a failure. The codes go to email,
 * and this page's whole job is to say so.
 *
 * It also does not look the session up. The session id is echoed for
 * support ("I paid but nothing arrived"), nothing more — there is no
 * lookup to get wrong and no order data on a page whose URL lands in
 * browser history.
 */

export const metadata: Metadata = {
  title: 'Tickets confirmed — The OK Corral',
  robots: { index: false, follow: false },
}

export default function TicketSuccessPage({
  searchParams,
}: {
  searchParams: { session_id?: string }
}) {
  // Shape-checked before display so a crafted ?session_id= can't render
  // arbitrary text on a page that looks official.
  const raw = searchParams.session_id ?? ''
  const sessionId = /^cs_[A-Za-z0-9_]{1,150}$/.test(raw) ? raw : null

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.kicker}>◆ You&rsquo;re in</div>
        <h1 className={styles.title}>Tickets confirmed</h1>

        <p className={styles.body}>
          Your tickets are on their way to your inbox — one QR code per ticket.
          Show the email at the door and we&rsquo;ll scan you in.
        </p>
        <p className={styles.body}>
          It usually lands within a minute. If it doesn&rsquo;t, check your spam
          folder before worrying — and if it still isn&rsquo;t there, call us and
          we&rsquo;ll find you on the list.
        </p>

        <div className={styles.contact}>
          <a href={BRAND.phoneHref}>{BRAND.phone}</a>
          <span aria-hidden="true">·</span>
          <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
        </div>

        {sessionId && (
          <div className={styles.reference}>
            Reference: <code>{sessionId}</code>
          </div>
        )}

        <Link href="/" className="btn btn-primary">
          Back to the saloon
        </Link>
      </div>
    </main>
  )
}
