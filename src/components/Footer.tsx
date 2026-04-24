'use client'
import { useState } from 'react'
import Wordmark from './Wordmark'
import { BRAND } from '@/lib/data'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import styles from './Footer.module.css'

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <Newsletter />
      <div className={styles.top}>
        <div className={styles.brand}>
          <Wordmark variant="stacked" />
          <p className={styles.brandDesc}>
            <em>Home of the Scorpion Shot. Cottonwood, California. Since 2025.</em>
          </p>
        </div>
        <div className={styles.col}>
          <h5 className={styles.colTitle}>Explore</h5>
          <ul>
            <li><a href="#events">Events</a></li>
            <li><a href="#merch">Merch</a></li>
            <li><a href="#gallery">Gallery</a></li>
            <li><a href="#bookings">Private Bookings</a></li>
            <li><a href="#visit">Visit</a></li>
          </ul>
        </div>
        <div className={styles.col}>
          <h5 className={styles.colTitle}>Shop</h5>
          <ul>
            <li><a href="#">Shipping &amp; Returns</a></li>
            <li><a href="#">Size Guide</a></li>
            <li><a href="#">Wholesale</a></li>
            <li><a href="#">Gift Cards</a></li>
          </ul>
        </div>
        <div className={styles.col}>
          <h5 className={styles.colTitle}>Say Howdy</h5>
          <ul>
            <li><a href={BRAND.instagramUrl} target="_blank" rel="noopener noreferrer">Instagram · @{BRAND.instagram}</a></li>
            <li><a href={`mailto:${BRAND.email}`}>{BRAND.email}</a></li>
            <li><a href={BRAND.phoneHref}>{BRAND.phone}</a></li>
          </ul>
        </div>
      </div>
      <div className={styles.bottom}>
        <span>© 2026 The OK Corral · All rights reserved</span>
        <span>◆ Drink responsibly · 21+ every day, all day</span>
      </div>
    </footer>
  )
}

function Newsletter() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    if (!email.includes('@')) return
    setSubmitting(true)
    try {
      const sb = getSupabaseBrowser()
      if (sb) {
        const { error } = await sb.from('newsletter').insert({ email })
        // 23505 = unique violation; treat as success (already subscribed)
        if (error && error.code !== '23505') throw error
      }
      setDone(true)
    } catch (e) {
      // Still mark done so user gets feedback; in production wire toast/log
      console.warn('newsletter subscribe failed', e)
      setDone(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.newsletter}>
      <div className={styles.newsInner}>
        <div className={styles.newsLeft}>
          <span className={styles.newsKicker}>◆ The Bulletin</span>
          <h3 className={styles.newsTitle}>
            Upcoming shows.<br /><em>No spam, ever.</em>
          </h3>
          <p className={styles.newsDesc}>
            <em>One email a month. Shows, specials, and the occasional tip on when a new scorpion is in the jar.</em>
          </p>
        </div>
        <div className={styles.newsRight}>
          {!done ? (
            <div className={styles.newsForm}>
              <input
                className={styles.newsInput}
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
              <button className={styles.newsBtn} onClick={submit} disabled={submitting}>{submitting ? 'Sending…' : 'Subscribe'}</button>
            </div>
          ) : (
            <div className={styles.newsDone}>
              <span className={styles.newsDoneLabel}>◆ YOU&apos;RE ON THE LIST</span>
              <span className={styles.newsDoneMsg}><em>See you soon.</em></span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
