'use client'
import { useEffect, useState } from 'react'
import { useCart } from '@/lib/cart'
import { SHOW_MERCH, BRAND } from '@/lib/data'
import styles from './StripeReturnHandler.module.css'

type Status = 'idle' | 'success-merch' | 'success-gift_card' | 'cancel'

type OrderSummary = {
  fulfillment: 'ship' | 'pickup'
  total: number
  shippingCost: number
  items: Array<{ name: string; qty: number }>
}

/**
 * Reads `?stripe=success&kind=...&session_id=...` (or `?stripe=cancel`) on
 * mount, shows a confirmation/cancel modal, clears the cart for successful
 * merch orders, and strips the params from the URL so a refresh doesn't
 * re-trigger the modal.
 *
 * Order details come from /api/order-summary (backed by the Stripe session),
 * NOT from the merch catalog — the catalog isn't sent to the browser while
 * SHOW_MERCH is off, and Stripe is the authoritative record regardless. The
 * fetch is best-effort: if it fails, the modal falls back to wording that is
 * true of every order rather than guessing at a fulfillment method.
 *
 * The order row is marked paid by /api/stripe/webhook; this is display only.
 */
export default function StripeReturnHandler() {
  const { clear } = useCart()
  const [status, setStatus] = useState<Status>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [summary, setSummary] = useState<OrderSummary | null>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    const flag = url.searchParams.get('stripe')
    if (!flag) return

    const kind = url.searchParams.get('kind')
    const sid = url.searchParams.get('session_id')

    if (flag === 'success' && kind === 'merch') {
      clear()
      setStatus('success-merch')
      setSessionId(sid)
    } else if (flag === 'success' && kind === 'gift_card') {
      setStatus('success-gift_card')
      setSessionId(sid)
    } else if (flag === 'cancel') {
      setStatus('cancel')
    }

    // Strip the params so refreshing the page doesn't re-show the modal.
    url.searchParams.delete('stripe')
    url.searchParams.delete('kind')
    url.searchParams.delete('session_id')
    window.history.replaceState({}, '', url.pathname + (url.search ? `?${url.searchParams}` : '') + url.hash)
  }, [clear])

  // Pull the real order details once we know we're on a merch success.
  // Best-effort: any failure just leaves `summary` null and the modal shows
  // the generic wording.
  useEffect(() => {
    if (status !== 'success-merch' || !sessionId) return
    let cancelled = false
    fetch(`/api/order-summary?session_id=${encodeURIComponent(sessionId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (!cancelled && data) setSummary(data as OrderSummary) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [status, sessionId])

  useEffect(() => {
    if (status === 'idle') return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setStatus('idle') }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [status])

  if (status === 'idle') return null

  const close = () => setStatus('idle')

  return (
    <div className={styles.overlay} onClick={close} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.close} onClick={close} aria-label="Close">✕</button>

        {status === 'success-merch' && (
          <>
            <span className={styles.label}>
              ◆ {summary?.fulfillment === 'pickup' ? 'READY FOR PICKUP' : 'ORDER CONFIRMED'}
            </span>
            <h3 className={styles.title}>Much<br /><em>obliged.</em></h3>
            <p className={styles.body}>
              <em>
                {summary?.fulfillment === 'pickup' ? (
                  <>
                    Your order&apos;s paid for and set aside. Come grab it any time
                    we&apos;re open — {BRAND.address.line1}, {BRAND.address.line2}.
                    Confirmation&apos;s on its way to your inbox.
                  </>
                ) : summary?.fulfillment === 'ship' ? (
                  <>
                    Your order&apos;s in and we&apos;re getting it boxed up. We&apos;ll
                    email a confirmation shortly, and let you know the moment it ships.
                  </>
                ) : (
                  // No summary yet (or the lookup failed) — say only what's true
                  // of every order, rather than promising a truck that may not
                  // be coming.
                  <>
                    Your order&apos;s in. We&apos;ll get a confirmation to your inbox
                    shortly with the details.
                  </>
                )}
              </em>
            </p>
            {summary && summary.items.length > 0 && (
              <ul className={styles.items}>
                {summary.items.map((it, i) => (
                  <li key={i}>{it.qty} × {it.name}</li>
                ))}
                <li className={styles.itemsTotal}>Total paid — ${summary.total.toFixed(2)}</li>
              </ul>
            )}
            {sessionId && (
              <p className={styles.sessionId}>Confirmation: {sessionId.slice(-12)}</p>
            )}
            <button className={`btn btn-primary ${styles.cta}`} onClick={close}>Done</button>
          </>
        )}

        {status === 'success-gift_card' && (
          <>
            <span className={styles.label}>◆ GIFT CARD SENT</span>
            <h3 className={styles.title}>On its<br /><em>way.</em></h3>
            <p className={styles.body}>
              <em>
                Payment cleared. The gift card will land in their inbox within
                a few minutes — receipt is on yours.
              </em>
            </p>
            {sessionId && (
              <p className={styles.sessionId}>Confirmation: {sessionId.slice(-12)}</p>
            )}
            <button className={`btn btn-primary ${styles.cta}`} onClick={close}>Done</button>
          </>
        )}

        {status === 'cancel' && (
          <>
            <span className={styles.labelMuted}>◆ CHECKOUT CANCELED</span>
            <h3 className={styles.title}>No charge,<br /><em>no harm.</em></h3>
            <p className={styles.body}>
              <em>
                You backed out before payment cleared.
                {SHOW_MERCH
                  ? ' Your cart is still here when you’re ready.'
                  : ` The shop’s closed for now — give us a call at ${BRAND.phone} if there was something you were after.`}
              </em>
            </p>
            <button className={`btn btn-ghost ${styles.cta}`} onClick={close}>Close</button>
          </>
        )}
      </div>
    </div>
  )
}
