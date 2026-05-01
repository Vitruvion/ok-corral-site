'use client'
import { useEffect, useState } from 'react'
import { useCart } from '@/lib/cart'
import styles from './StripeReturnHandler.module.css'

type Status = 'idle' | 'success-merch' | 'success-gift_card' | 'cancel'

/**
 * Reads `?stripe=success&kind=...&session_id=...` (or `?stripe=cancel`) on
 * mount, shows a confirmation/cancel modal, clears the cart for successful
 * merch orders, and strips the params from the URL so a refresh doesn't
 * re-trigger the modal.
 *
 * The actual order row was created server-side at session-creation time;
 * this just confirms to the user. Marking the row 'paid' should happen via
 * a Stripe webhook (not yet wired).
 */
export default function StripeReturnHandler() {
  const { clear } = useCart()
  const [status, setStatus] = useState<Status>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)

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
            <span className={styles.label}>◆ ORDER CONFIRMED</span>
            <h3 className={styles.title}>Much<br /><em>obliged.</em></h3>
            <p className={styles.body}>
              <em>
                Your order&apos;s in. We&apos;ll get a confirmation to your inbox shortly,
                and your goods on a truck within 2–3 business days.
              </em>
            </p>
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
              <em>You backed out before payment cleared. Your cart is still here when you&apos;re ready.</em>
            </p>
            <button className={`btn btn-ghost ${styles.cta}`} onClick={close}>Close</button>
          </>
        )}
      </div>
    </div>
  )
}
