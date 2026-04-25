'use client'
import { useState } from 'react'
import { EVENTS, RECURRING, type EventData } from '@/lib/data'
import styles from './Events.module.css'

type RecurringData = { day: string; name: string; support: string; time: string; tickets: string }

type Props = {
  events?: EventData[]
  recurring?: RecurringData[]
  onReserve?: (ev: EventData) => void
}

export default function Events({ events = EVENTS, recurring = RECURRING, onReserve }: Props = {}) {
  const [openId, setOpenId] = useState<string>('')

  return (
    <section className="section" id="events">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="section-label">02 · What&apos;s On</span>
            <h2 className="section-title">
              Upcoming<br /><em>at the corral</em>
            </h2>
          </div>
          <p className="section-intro">
            No cover on the door, ever — unless it&apos;s a ticketed special. Always 21+.
          </p>
        </div>

        <div className={styles.list}>
          {events.map(ev => {
            const d = new Date(ev.date)
            const day = d.getDate()
            const month = d.toLocaleString('en-US', { month: 'long' })
            const isOpen = openId === ev.id

            return (
              <div key={ev.id} className={`${styles.row} ${isOpen ? styles.rowOpen : ''}`} onClick={() => setOpenId(isOpen ? '' : ev.id)}>
                <div className={styles.rowInner}>
                  <div className={styles.date}>
                    <span className={styles.day}>{day}</span>
                    <span className={styles.month}>{month} · {ev.weekday}</span>
                  </div>
                  <div className={styles.info}>
                    <span className={styles.name}>{ev.name}</span>
                    <span className={styles.support}>{ev.support}</span>
                  </div>
                  <div className={styles.meta}>
                    <span><strong>{ev.time}</strong> · Doors {ev.doors}</span>
                    <span>{ev.genre}</span>
                    <span>{ev.tickets}</span>
                  </div>
                  <button className={`btn btn-ghost ${styles.cta}`}>
                    {isOpen ? 'Close' : 'Details'}
                    <span className={`${styles.plus} ${isOpen ? styles.plusOpen : ''}`}>+</span>
                  </button>
                </div>

                {isOpen && (
                  <div className={styles.expand}>
                    <div className={styles.expandLeft}>
                      <div className="placeholder" style={{ aspectRatio: '3/4', borderRadius: 4 }}>
                        <span className="placeholder-label">{ev.name} · Poster 3:4</span>
                      </div>
                    </div>
                    <div className={styles.expandRight}>
                      <h4 className={styles.expandHeading}>◆ About the night</h4>
                      <p className={styles.expandDesc}>{ev.description}</p>
                      <div className={styles.expandActions}>
                        <button
                          className="btn btn-primary"
                          onClick={(e) => { e.stopPropagation(); onReserve?.(ev) }}
                        >
                          Reserve Tickets →
                        </button>
                        <button className="btn btn-ghost" onClick={(e) => e.stopPropagation()}>Add to Calendar</button>
                        <button className="btn btn-ghost" onClick={(e) => e.stopPropagation()}>Share</button>
                      </div>
                      <div className={styles.tags}>
                        {ev.tags.map(t => (
                          <span key={t} className={styles.tag}>◆ {t}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Weekly Strip */}
        <div className={styles.weekly}>
          <div className={styles.weeklyHead}>
            <span className="section-label">Every Week</span>
            <span className={styles.weeklyLine} />
          </div>
          <div className={styles.weeklyGrid}>
            {recurring.map((r, i) => (
              <div key={r.day} className={styles.weeklyCard}>
                <div className={styles.weeklyCardLeft}>
                  <span className={styles.weeklyEvery}>Every</span>
                  <span className={styles.weeklyDay}>{r.day}</span>
                </div>
                <div className={styles.weeklyCardRight}>
                  <span className={styles.weeklyName}>{r.name}</span>
                  <span className={styles.weeklySupport}>{r.support}</span>
                  <span className={styles.weeklyMeta}>{r.time} · {r.tickets}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.foot}>
          <button className="btn btn-ghost">View Full Calendar →</button>
        </div>
      </div>
    </section>
  )
}
