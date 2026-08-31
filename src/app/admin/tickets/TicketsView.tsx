'use client'

import { useMemo, useState } from 'react'
import type { EventTickets, TicketOrderRow, UnconfiguredEvent } from '@/lib/tickets/manifest'
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

export default function TicketsView({
  events,
  unconfigured = [],
}: {
  events: EventTickets[]
  unconfigured?: UnconfiguredEvent[]
}) {
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

  const nag = <NotSelling events={unconfigured} />

  if (events.length === 0) {
    return (
      <>
        {nag}
        <p className={styles.empty}>
          No events are selling tickets yet. Set <code>tickets_on_sale</code> and{' '}
          <code>ticket_price</code> on an event to start.
        </p>
      </>
    )
  }

  return (
    <>
      {nag}
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
                {/* Everyone holding a seat: online tickets plus door
                    admissions. The two used to be counted separately and
                    disagreed. */}
                <Stat label="Admitted" value={String(ev.admitted)} />
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

              {/* Where the admitted figure came from. Only worth showing
                  once a door sale exists -- before that it is just the
                  online number said twice. */}
              {ev.doorAdmissions > 0 && (
                <div className={styles.channelSplit}>
                  <span>{ev.issued} online</span>
                  <span aria-hidden="true">·</span>
                  <span>{ev.doorAdmissions} at the door</span>
                </div>
              )}

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
                            {/* "admitted", never "tickets": a door sale has a
                                quantity but issues no ticket records, so half
                                these rows have no tickets to speak of. */}
                            {r.admitted} admitted · {r.orders} order
                            {r.orders === 1 ? '' : 's'}
                          </span>
                          <span className={styles.revenueAmount}>{money(r.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className={styles.reconcileNote}>
                    Reconcile each line against its own source: Stripe lands in the
                    bank on its own, Square and cash against the register at close.
                    These are not added up on purpose — one combined figure would be
                    counted twice.
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

/**
 * Upcoming shows with no ticket setup.
 *
 * INFORMATIONAL, and styled to say so: muted, no red, no warning icon,
 * no call to action. Most of these are free shows or door-only nights
 * and are perfectly fine. It is here so that a show which was meant to
 * sell tickets cannot sit unnoticed with no way to buy -- with
 * Eventbrite retired there is no fallback link to catch it.
 *
 * Deliberately NO toggle. Switching sales on is a decision made with a
 * price in hand, not a tap from a list.
 */
function NotSelling({ events }: { events: UnconfiguredEvent[] }) {
  if (events.length === 0) return null

  return (
    <section className={styles.notSelling}>
      <h2 className={styles.notSellingHead}>Not selling tickets</h2>
      <ul className={styles.notSellingList}>
        {events.map(e => (
          <li key={e.id} className={styles.notSellingRow}>
            <span className={styles.notSellingName}>{e.name}</span>
            <span className={styles.notSellingDate}>{e.dateLabel}</span>
            <span className={styles.notSellingWhy}>{e.reason}</span>
          </li>
        ))}
      </ul>
      <p className={styles.notSellingNote}>
        Free and door-only shows belong here. Listed so a show that was meant to
        sell tickets doesn&rsquo;t sit unnoticed.
      </p>
    </section>
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
