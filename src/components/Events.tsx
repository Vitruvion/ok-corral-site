'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { EVENTS, RECURRING, type EventData, type RelatedLink } from '@/lib/data'
import ImageOrPlaceholder from './ImageOrPlaceholder'
import { downloadIcs } from '@/lib/ics'
import { shareOrCopy } from '@/lib/share'
import { InstagramIcon, FacebookIcon, TikTokIcon } from './SocialIcons'
import styles from './Events.module.css'

type RecurringData = { day: string; name: string; support: string; time: string; tickets: string }

type Props = {
  events?: EventData[]
  recurring?: RecurringData[]
}

export default function Events({ events = EVENTS, recurring = RECURRING }: Props = {}) {
  // Pick which row should be open on first render: an event explicitly
  // flagged featured, or the only event when the schedule has just one show.
  // Lazy useState so this runs only on mount.
  const [openId, setOpenId] = useState<string>(() => {
    const featured = events.find(e => e.featured)
    if (featured) return featured.id
    if (events.length === 1) return events[0].id
    return ''
  })

  // Single-slot toast for action feedback ("Link copied!", ".ics downloaded", etc.)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2000)
    return () => clearTimeout(t)
  }, [toast])

  const onAddToCalendar = (ev: EventData) => {
    const ok = downloadIcs(ev)
    setToast(ok ? 'Calendar file saved' : 'Could not generate calendar file')
  }

  const onShare = async (ev: EventData) => {
    const fallbackUrl = typeof window !== 'undefined' ? window.location.origin + '#events' : ''
    const url = ev.eventbrite_url || fallbackUrl
    const result = await shareOrCopy({
      title: `${ev.name} at The OK Corral`,
      text: ev.support ? `${ev.name} ${ev.support}` : ev.name,
      url,
    })
    if (result.kind === 'copied') setToast('Link copied!')
    else if (result.kind === 'failed') setToast('Couldn’t copy link')
    // 'shared' and 'canceled' → no toast (native UI already gave feedback)
  }

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
            const { day, month } = parseEventDate(ev.date)
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
                    <span className={styles.support}>
                      {linkify(ev.support, ev.related_links)}
                    </span>
                  </div>
                  <div className={styles.meta}>
                    <span><strong>{ev.time}</strong></span>
                    {ev.genre && <span>{ev.genre}</span>}
                    {ev.tickets && <span>{ev.tickets}</span>}
                  </div>
                  <button className={`btn btn-ghost ${styles.cta}`}>
                    {isOpen ? 'Close' : 'Details'}
                    <span className={`${styles.plus} ${isOpen ? styles.plusOpen : ''}`}>+</span>
                  </button>
                </div>

                {isOpen && (
                  <div className={styles.expand}>
                    <div className={styles.expandLeft}>
                      {ev.poster_url ? (
                        <ImageOrPlaceholder
                          src={ev.poster_url}
                          alt={`${ev.name} poster`}
                          label={`${ev.name} · Poster`}
                          cover
                          loading="eager"
                          className={styles.poster}
                          style={{ aspectRatio: '3/4', borderRadius: 4 }}
                        />
                      ) : (
                        <div className="placeholder" style={{ aspectRatio: '3/4', borderRadius: 4 }}>
                          <span className="placeholder-label">{ev.name} · Poster 3:4</span>
                        </div>
                      )}

                      {/* Optional YouTube embed — only renders when youtube_url
                          is set on the event. Lazy-loaded so it doesn't block
                          first paint for visitors who don't expand the row. */}
                      {ev.youtube_url && (() => {
                        const id = youtubeIdFromUrl(ev.youtube_url)
                        if (!id) return null
                        return (
                          <div className={styles.video}>
                            <iframe
                              src={`https://www.youtube.com/embed/${id}`}
                              title={`${ev.name} on YouTube`}
                              loading="lazy"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )
                      })()}

                      {/* Related-artist sidebar — one card per related_links
                          entry. Entries with an image show the photo on the
                          left; entries without an image show a platform icon
                          (auto-detected from the URL host) so the layout stays
                          consistent. */}
                      {ev.related_links && ev.related_links.length > 0 && (
                        <div className={styles.related}>
                          {ev.related_links.map(link => (
                            <a
                              key={link.url}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.relatedCard}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {link.image ? (
                                <div className={styles.relatedThumb}>
                                  <ImageOrPlaceholder
                                    src={link.image}
                                    alt={link.name}
                                    label={link.name}
                                    loading="lazy"
                                  />
                                </div>
                              ) : (
                                <div className={styles.relatedIcon} aria-hidden="true">
                                  <SocialGlyph url={link.url} />
                                </div>
                              )}
                              <div className={styles.relatedMeta}>
                                <span className={styles.relatedName}>{link.name}</span>
                                {link.role && (
                                  <span className={styles.relatedRole}>{link.role}</span>
                                )}
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className={styles.expandRight}>
                      <h4 className={styles.expandHeading}>◆ About the night</h4>
                      <p className={styles.expandDesc}>
                        {linkify(ev.description, ev.related_links)}
                      </p>
                      <div className={styles.expandActions}>
                        {ev.eventbrite_url ? (
                          <a
                            href={ev.eventbrite_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-primary"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Get Tickets →
                          </a>
                        ) : (
                          <span
                            className={styles.freeBadge}
                            onClick={(e) => e.stopPropagation()}
                          >
                            ◆ Free Admission · No Cover
                          </span>
                        )}
                        <button
                          className="btn btn-ghost"
                          onClick={(e) => { e.stopPropagation(); onAddToCalendar(ev) }}
                        >
                          Add to Calendar
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={(e) => { e.stopPropagation(); onShare(ev) }}
                        >
                          Share
                        </button>
                      </div>
                      {ev.tags.length > 0 && (
                        <div className={styles.tags}>
                          {ev.tags.map(t => (
                            <span key={t} className={styles.tag}>◆ {t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {events.length < 3 && (
            <div className={styles.comingSoon}>
              <span className={styles.comingSoonLabel}>◆ More shows coming soon</span>
              <p className={styles.comingSoonBody}>
                <em>New dates land every couple of weeks. Want a heads-up when they drop? Sign up for the bulletin at the bottom of the page.</em>
              </p>
            </div>
          )}
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

      {toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          ◆ {toast}
        </div>
      )}
    </section>
  )
}

/**
 * Parses an event's date string for display. Handles both formats:
 *   - "YYYY-MM-DD" (from Supabase) → would be interpreted as UTC midnight
 *     by the Date constructor, causing getDate() in negative-offset zones
 *     to roll back one day. We build the Date with explicit local args so
 *     "2026-06-25" stays June 25 regardless of viewer timezone.
 *   - "Month DD YYYY" (from data.ts) → constructor parses as local time
 *     already, so no special handling needed.
 */
function parseEventDate(s: string): { day: number; month: string } {
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const d = iso
    ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
    : new Date(s)
  return {
    day: d.getDate(),
    month: d.toLocaleString('en-US', { month: 'long' }),
  }
}

/**
 * Extracts the video ID from any common YouTube URL form:
 *   - https://www.youtube.com/watch?v=ID
 *   - https://youtu.be/ID
 *   - https://www.youtube.com/embed/ID
 *   - https://www.youtube.com/shorts/ID
 * Returns null if the URL isn't recognizably YouTube.
 */
function youtubeIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.toLowerCase()
    if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
      const seg = u.pathname.replace(/^\//, '').split('/')[0]
      return seg || null
    }
    if (host.endsWith('youtube.com')) {
      if (u.pathname === '/watch') return u.searchParams.get('v')
      const m = u.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)
      if (m) return m[1]
    }
  } catch {
    // fall through
  }
  return null
}

/**
 * Picks a platform icon to display in a related-link card when the entry
 * has no image. Returns a generic external-link arrow if the URL isn't
 * one of the recognized social platforms.
 */
function SocialGlyph({ url }: { url: string }) {
  let host = ''
  try { host = new URL(url).hostname.toLowerCase() } catch {}
  if (host.includes('instagram.com')) return <InstagramIcon />
  if (host.includes('facebook.com'))  return <FacebookIcon />
  if (host.includes('tiktok.com'))    return <TikTokIcon />
  return <span aria-hidden="true">→</span>
}

/**
 * Splits a string on any of the names in `links` and wraps the matching
 * portions in anchor tags. Plain text passes through untouched when no
 * links are supplied or no names match.
 */
function linkify(text: string, links?: RelatedLink[]): ReactNode {
  if (!text) return text
  if (!links || links.length === 0) return text
  const names = links.filter(l => l.name && text.includes(l.name))
  if (names.length === 0) return text
  const escaped = names.map(l => l.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'g')
  const parts = text.split(re)
  return parts.map((part, i) => {
    const link = links.find(l => l.name === part)
    if (!link) return part
    return (
      <a
        key={i}
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.descLink}
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    )
  })
}
