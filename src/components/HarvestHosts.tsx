'use client'
import { useEffect, useRef, type ReactNode, type SVGProps } from 'react'
import { HARVEST_HOSTS, dailyHours } from '@/lib/data'
import type { HostBadge } from '@/lib/host-badge'
import { excludeFromGrain } from '@/lib/grain-hole'
import styles from './HarvestHosts.module.css'

/**
 * "Stay the Night" -- the Corral as a Harvest Hosts stop.
 *
 * Members of Harvest Hosts (an RV membership) park overnight free at host
 * businesses and book through Harvest Hosts' own app or site. The copy says
 * so plainly, because the thing to avoid is the bar's phone ringing with
 * people trying to reserve a spot.
 *
 * Nothing here is Harvest Hosts' artwork: no logo, no colours, nothing
 * loaded from their site. Their name in text, a link to our listing, and
 * -- once supplied -- their official host badge, shown exactly as given.
 */

type Props = { badge: HostBadge | null }

/* Line icons in the site's style: 24 grid, 1.8 stroke, round joins,
   currentColor (same as SocialIcons). */
function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

const ICONS = {
  rig: (
    <Icon>
      <rect x="2" y="6" width="14" height="10" rx="1.5" />
      <path d="M16 9h3l3 3.5V16h-6" />
      <path d="M5 9h4v3H5z" />
      <circle cx="6.5" cy="17.5" r="1.8" />
      <circle cx="17.5" cy="17.5" r="1.8" />
    </Icon>
  ),
  length: (
    <Icon>
      <path d="M3 7v10M21 7v10M4 12h16" />
      <path d="M7 9l-3 3 3 3M17 9l3 3-3 3" />
    </Icon>
  ),
  pullThrough: (
    <Icon>
      <path d="M4 8h15M15 4l4 4-4 4" />
      <path d="M20 16H5M9 12l-4 4 4 4" />
    </Icon>
  ),
  tow: (
    <Icon>
      <path d="M3 16v-3.5L5.5 8h9l3.5 4.5H21V16" />
      <path d="M3 16h1.5M9.5 16h5M19.5 16H21" />
      <circle cx="7" cy="16.5" r="2" />
      <circle cx="17" cy="16.5" r="2" />
    </Icon>
  ),
  pets: (
    <Icon>
      <circle cx="6.5" cy="10" r="1.6" />
      <circle cx="10" cy="6.5" r="1.6" />
      <circle cx="14" cy="6.5" r="1.6" />
      <circle cx="17.5" cy="10" r="1.6" />
      <path d="M12 12.5c-2.8 0-4.8 3.2-4.8 5.1 0 1.4 1.3 2 2.4 1.5.9-.4 1.6-.6 2.4-.6s1.5.2 2.4.6c1.1.5 2.4-.1 2.4-1.5 0-1.9-2-5.1-4.8-5.1z" />
    </Icon>
  ),
  generator: (
    <Icon>
      <path d="M13 3L5.5 13H11l-1 8 7.5-10H12l1-8z" />
    </Icon>
  ),
  slideout: (
    <Icon>
      <rect x="3" y="5" width="12" height="14" rx="1.5" />
      <path d="M15 9h5v6h-5" />
    </Icon>
  ),
  nights: (
    <Icon>
      <path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.2 6.2 0 0 0 10 10z" />
    </Icon>
  ),
  sameDay: (
    <Icon>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M9 15.5l2 2 4-4" />
    </Icon>
  ),
  hours: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </Icon>
  ),
}

export default function HarvestHosts({ badge }: Props) {
  const hours = dailyHours()
  // Shown as supplied means no film grain over it either.
  const badgeRef = useRef<HTMLImageElement>(null)
  useEffect(() => (badgeRef.current ? excludeFromGrain(badgeRef.current) : undefined), [badge])
  const specs: { icon: ReactNode; title: string; detail: string }[] = [
    { icon: ICONS.rig, title: `${HARVEST_HOSTS.spaces} RV spaces`, detail: HARVEST_HOSTS.surface },
    { icon: ICONS.length, title: 'Big rigs', detail: HARVEST_HOSTS.rigLength },
    { icon: ICONS.pullThrough, title: 'Pull-through', detail: 'or back-in' },
    { icon: ICONS.tow, title: 'Tow vehicle', detail: 'Separate parking' },
    { icon: ICONS.pets, title: 'Pets', detail: 'Welcome' },
    { icon: ICONS.generator, title: 'Generators', detail: 'Allowed' },
    { icon: ICONS.slideout, title: 'Slideouts', detail: 'Allowed' },
    { icon: ICONS.nights, title: 'Stay longer', detail: `Up to ${HARVEST_HOSTS.extraNights} extra nights` },
    { icon: ICONS.sameDay, title: 'Same-day', detail: 'Requests accepted' },
    { icon: ICONS.hours, title: 'Open daily', detail: hours ?? 'See hours above' },
  ]

  return (
    <section className={`section ${styles.section}`} id="stay">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="section-label"><span className="section-num">Stay the Night</span></span>
            <h2 className="section-title">Park the rig,<br /><em>pull up a stool</em></h2>
          </div>
          <p className="section-intro">
            We&apos;re a Harvest Hosts stop. Pull into our lot for the night, come in for a
            cold one, and sleep it off right outside.
          </p>
        </div>

        <div className={styles.grid}>
          <div className={styles.story}>
            <figure className={styles.photo}>
              {/* Real pixel size on the tag: the box is reserved before the
                  photo arrives, so nothing below it moves (the anchor-jump
                  fix from 2af4ac8). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/gallery/car-show.jpg"
                alt="The OK Corral and its lot, with classic cars lined up out front"
                width={2400}
                height={1659}
                loading="lazy"
                decoding="async"
              />
            </figure>

            <p className={styles.lead}>
              <em>
                Harvest Hosts is a membership for folks who travel by RV: overnight stays at
                wineries, farms, breweries &mdash; and now one Western bar in Cottonwood.
                Members stay free. The custom is to come in and spend a little with your host,
                and around here that means a round at the bar.
              </em>
            </p>

            <div className={styles.notes}>
              <span className={styles.notesLabel}>◆ Good to Know</span>
              <p className={styles.note}>
                <strong>21 and over, all the time.</strong> Inside, outside, anywhere on the
                property &mdash; so this one&apos;s for grown-up crews only.
              </p>
              <p className={styles.note}>
                <strong>It&apos;s a bar.</strong> A lively one, open till 2 AM, and it can get
                loud late. Light sleepers, pack the earplugs.
              </p>
            </div>
          </div>

          <div className={styles.card}>
            <span className={styles.cardLabel}>◆ The Spot</span>
            <ul className={styles.specs}>
              {specs.map(s => (
                <li key={s.title} className={styles.spec}>
                  <span className={styles.specIcon}>{s.icon}</span>
                  <span className={styles.specText}>
                    <span className={styles.specTitle}>{s.title}</span>
                    <span className={styles.specDetail}>{s.detail}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className={styles.book}>
              <div className={styles.bookRow}>
                <a
                  href={HARVEST_HOSTS.listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`btn btn-primary ${styles.bookBtn}`}
                >
                  Book on Harvest Hosts →
                </a>
                {badge && (
                  // The official host badge, exactly as supplied. Its real
                  // size is on the tag, so it never shifts the layout; the
                  // film grain is masked off it (lib/grain-hole.ts).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    ref={badgeRef}
                    className={styles.badge}
                    src={badge.src}
                    width={badge.w}
                    height={badge.h}
                    alt="Harvest Hosts host"
                    loading="lazy"
                    decoding="async"
                  />
                )}
              </div>
              <p className={styles.bookNote}>
                Stays are booked through the Harvest Hosts app or website only &mdash; the bar
                can&apos;t take RV reservations over the phone.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
