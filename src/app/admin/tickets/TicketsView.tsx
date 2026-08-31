'use client'

import { useMemo, useState } from 'react'
import type { EventTickets, TicketOrderRow } from '@/lib/tickets/manifest'
import styles from './tickets.module.css'

/**
 * Ticket sales, phone first.
 *
 * Two jobs, and the second one matters more: see how a show is selling,
 * and find one person's order while they are standing at the door. The
 * search filters across every event at once for exactly that reason -- at
 * the door nobody wants to first pick which show they are working.
 */

const money = (n: number) => `$${n.toFixed(2)}`

/** How the money got taken, spelled out for whoever reads the sheet. */
const METHOD_LABEL: Record<string, string> = {
  stripe: 'Online (Stripe)',
  square: 'Square at door',
  cash: 'Cash at door',
  comp: 'Comped',
}

const methodLabel = (m: string) => METHOD_LABEL[m] ?? m

export default function TicketsView({ events }: { events: EventTickets[] }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const needle = query.trim().toLowerCase()

  // With a search active, every event opens and shows only its matches;
  // an event with no match drops out entirely. Without one, the page is
  // a collapsed list of shows.
  const filtered = useMemo(() => {
    if (!needle) return events
    return events
      .map(ev => ({ ...ev, orders: ev.orders.filter(o => matches(o, needle)) }))
      .filter(ev => ev.orders.length > 0)
  }, [events, needle])

  if (events.length === 0) {
    return (
      <p className={styles.empty}>
        No events are selling tickets yet. Set <code>tickets_on_sale</code> and{' '}
        <code>ticket_price</code> on an event to start.
      </p>
    )
  }

  return (
    <>
      <input
        className={styles.search}
        type="search"
        inputMode="search"
        placeholder="Search name or email…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        aria-label="Search orders by purchaser name or email"
      />

      {needle && filtered.length === 0 && (
        <p className={styles.empty}>No orders match &ldquo;{query.trim()}&rdquo;.</p>
      )}

      <div className={styles.events}>
        {filtered.map(ev => {
          const isOpen = needle ? true : (open[ev.id] ?? false)
          return (
            <section key={ev.id} className={styles.event}>
              <button
                className={styles.eventToggle}
                onClick={() => setOpen(prev => ({ ...prev, [ev.id]: !isOpen }))}
                aria-expanded={isOpen}
                disabled={Boolean(needle)}
              >
                <span className={styles.eventHead}>
                  <span className={styles.eventName}>{ev.name}</span>
                  <span className={styles.eventDate}>{ev.dateLabel}</span>
                  {!ev.ticketsOnSale && <span className={styles.tag}>sales closed</span>}
                </span>
                <span className={styles.chevron}>{isOpen ? '−' : '+'}</span>
              </button>

              <div className={styles.counts}>
                <Stat label="Sold" value={String(ev.issued)} />
                <Stat
                  label="Capacity"
                  // "No cap" rather than "unlimited": the stat strip is four
                  // columns wide on a 390px phone, and the longer word broke
                  // mid-syllable ("unlimite/d").
                  value={ev.capacity === null ? 'No cap' : String(ev.capacity)}
                />
                <Stat
                  label="Remaining"
                  value={ev.remaining === null ? '—' : String(ev.remaining)}
                  alert={ev.remaining !== null && ev.remaining < 0}
                />
                <Stat label="Price" value={ev.price === null ? '—' : money(ev.price)} />
              </div>

              {isOpen && (
                <div className={styles.body}>
                  {/*
                    Split by payment method and NEVER summed. Stripe money
                    lands in the bank by itself; Square and cash get
                    reconciled against the register at close. One combined
                    number would be double-counted against the Square
                    close-out, which is worse than no number.
                  */}
                  <h2 className={styles.sectionTitle}>Revenue by payment method</h2>
                  {ev.revenue.length === 0 ? (
                    <p className={styles.muted}>Nothing paid yet.</p>
                  ) : (
                    <ul className={styles.revenue}>
                      {ev.revenue.map(r => (
                        <li key={r.payment_method} className={styles.revenueRow}>
                          <span className={styles.revenueMethod}>
                            {methodLabel(r.payment_method)}
                          </span>
                          <span className={styles.revenueCount}>
                            {r.tickets} ticket{r.tickets === 1 ? '' : 's'} · {r.orders} order
                            {r.orders === 1 ? '' : 's'}
                          </span>
                          <span className={styles.revenueAmount}>{money(r.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className={styles.reconcileNote}>
                    Reconcile each line against its own source. These are not added up
                    on purpose.
                  </p>

                  <h2 className={styles.sectionTitle}>
                    Orders{needle ? ` matching “${query.trim()}”` : ''}
                  </h2>
                  {ev.orders.length === 0 ? (
                    <p className={styles.muted}>No orders yet.</p>
                  ) : (
                    <ul className={styles.orders}>
                      {ev.orders.map(o => (
                        <li key={o.id} className={styles.order}>
                          <div className={styles.orderTop}>
                            <span className={styles.orderName}>
                              {o.purchaser_name || 'No name given'}
                            </span>
                            <span className={styles.orderQty}>
                              ×{o.quantity}
                            </span>
                          </div>
                          {o.purchaser_email && (
                            <div className={styles.orderEmail}>{o.purchaser_email}</div>
                          )}
                          {o.purchaser_phone && (
                            <div className={styles.orderEmail}>{o.purchaser_phone}</div>
                          )}
                          <div className={styles.orderMeta}>
                            <span
                              className={o.status === 'paid' ? styles.statusPaid : styles.statusOther}
                            >
                              {o.status}
                            </span>
                            <span>{o.channel}</span>
                            <span>{methodLabel(o.payment_method)}</span>
                            <span>{money(o.total)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}

function Stat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={alert ? styles.statValueAlert : styles.statValue}>{value}</span>
    </div>
  )
}

function matches(o: TicketOrderRow, needle: string): boolean {
  return (
    (o.purchaser_name ?? '').toLowerCase().includes(needle) ||
    (o.purchaser_email ?? '').toLowerCase().includes(needle)
  )
}
