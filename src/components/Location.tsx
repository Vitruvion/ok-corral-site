'use client'
import { BRAND, HOURS } from '@/lib/data'
import styles from './Location.module.css'

export default function Location() {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  return (
    <section className="section" id="visit" style={{ background: 'var(--ink-2)', borderTop: '1px solid rgba(235,228,212,0.08)' }}>
      <div className="container">
        <div className="section-head">
          <div>
            <span className="section-label">05 · Come Find Us</span>
            <h2 className="section-title">Visit<br /><em>the corral</em></h2>
          </div>
          <p className="section-intro">
            Just off I-5, exit 630. Free parking out back. We&apos;ll leave a light on.
          </p>
        </div>

        <div className={styles.grid}>
          <div className={styles.info}>
            <div className={styles.block}>
              <h4 className={styles.blockLabel}>◆ Address</h4>
              <p className={styles.blockText}>
                {BRAND.address.line1}<br />{BRAND.address.line2}
              </p>
            </div>

            <div className={styles.block}>
              <h4 className={styles.blockLabel}>◆ Hours</h4>
              <div className={styles.hoursGrid}>
                {HOURS.map(h => (
                  <div key={h.day} className={`${styles.hoursRow} ${h.day === today ? styles.hoursToday : ''}`}>
                    <span className={styles.dayName}>{h.abbr}</span>
                    <span>{h.open} — {h.close}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.block}>
              <h4 className={styles.blockLabel}>◆ Get In Touch</h4>
              <p className={styles.blockText}>
                <a href={BRAND.phoneHref}>{BRAND.phone}</a><br />
                <span style={{ color: 'var(--bone-dim)' }}>{BRAND.email}</span>
              </p>
            </div>

            <div className={styles.actions}>
              <a href={BRAND.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                Get Directions →
              </a>
              <a href="#bookings" className="btn btn-ghost">Private Bookings</a>
            </div>
          </div>

          <div className={styles.mapWrap}>
            <iframe
              className={styles.map}
              src={BRAND.mapsEmbed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="The OK Corral location"
            />
            <div className={styles.mapOverlay}>
              <span className={styles.mapLabel}>◆ 3633 MAIN ST · COTTONWOOD CA</span>
              <a href={BRAND.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '9px' }}>
                Directions →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
