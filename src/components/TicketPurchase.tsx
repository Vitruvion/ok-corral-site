'use client'

import { useEffect, useState } from 'react'
import type { Availability } from '@/app/api/tickets/availability/route'
import styles from './TicketPurchase.module.css'

/**
 * Buy-tickets widget for an event card.
 *
 * Only rendered when an event has tickets_on_sale — every other event
 * keeps its Eventbrite link or Free Admission badge untouched, because
 * the cutover happens one show at a time.
 *
 * Availability is fetched on mount rather than passed down. The event
 * data comes through ISR with a 60-second window, so a cached page can
 * be a minute stale — fine for a date or a price, not fine for "sold
 * out". The price is passed in only so the button can render a real
 * number before the fetch lands; the fetched value replaces it, and the
 * server prices the order regardless of both.
 */

type Props = {
  /** Slug or uuid — whatever EventData.id happens to be. */
  eventId: string
  eventName: string
  /** From the event row, for first paint only. */
  price: number | null
  blurb?: string | null
}

const money = (n: number) => `$${n.toFixed(n % 1 === 0 ? 0 : 2)}`

export default function TicketPurchase({ eventId, eventName, price, blurb }: Props) {
  const [availability, setAvailability] = useState<Availability | null>(null)
  const [qty, setQty] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/tickets/availability?event=${encodeURIComponent(eventId)}`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled && data && !data.error) setAvailability(data as Availability)
      })
      .catch(() => {
        // Leave availability null: the button still works and the server
        // re-checks everything anyway. A network blip shouldn't hide the
        // only way to buy a ticket.
      })
    return () => {
      cancelled = true
    }
  }, [eventId])

  const unit = availability?.price ?? price
  const maxQty = availability?.max_per_order ?? 10
  const soldOut = availability?.sold_out === true
  const remaining = availability?.remaining ?? null
  const note = availability?.blurb ?? blurb ?? null

  // Availability can land after someone has already picked a number.
  useEffect(() => {
    if (maxQty > 0 && qty > maxQty) setQty(maxQty)
  }, [maxQty, qty])

  const buy = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/tickets/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Event and quantity only. There is deliberately no price in this
        // body — the server reads it from the events row.
        body: JSON.stringify({ event_id: eventId, quantity: qty }),
      })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Could not start checkout.')
      window.location.href = data.url
    } catch (err: any) {
      setError(err?.message || 'Could not start checkout.')
      setBusy(false)
    }
  }

  if (soldOut) {
    return (
      <div className={styles.soldOut} onClick={e => e.stopPropagation()}>
        ◆ Sold Out
      </div>
    )
  }

  const total = unit === null ? null : unit * qty

  return (
    <div className={styles.wrap} onClick={e => e.stopPropagation()}>
      <div className={styles.row}>
        <div className={styles.stepper}>
          <button
            type="button"
            className={styles.step}
            onClick={() => setQty(q => Math.max(1, q - 1))}
            disabled={qty <= 1 || busy}
            aria-label="One fewer ticket"
          >
            −
          </button>
          <span className={styles.qty} aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            className={styles.step}
            onClick={() => setQty(q => Math.min(maxQty, q + 1))}
            disabled={qty >= maxQty || busy}
            aria-label="One more ticket"
          >
            +
          </button>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={buy}
          disabled={busy}
          aria-label={`Get tickets for ${eventName}`}
        >
          {busy
            ? 'Taking you to checkout…'
            : total === null
              ? 'Get Tickets →'
              : `Get Tickets · ${money(total)} →`}
        </button>
      </div>

      <div className={styles.meta}>
        {unit !== null && (
          <span className={styles.price}>
            {money(unit)} each
            {qty > 1 && total !== null ? ` · ${qty} for ${money(total)}` : ''}
          </span>
        )}
        {/* Only shown when the count is small enough to mean something.
            "43 left" on a 300-cap room is noise; "3 left" is a reason to
            buy now. */}
        {remaining !== null && remaining <= 20 && (
          <span className={styles.remaining}>
            {remaining === 1 ? 'Last ticket' : `${remaining} left`}
          </span>
        )}
      </div>

      {note && <div className={styles.blurb}>{note}</div>}

      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
    </div>
  )
}
