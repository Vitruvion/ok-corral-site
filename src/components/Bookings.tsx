'use client'
import { useState } from 'react'
import { BRAND } from '@/lib/data'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import styles from './Bookings.module.css'

export default function Bookings() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const sb = getSupabaseBrowser()
      if (sb) {
        const { error: insertErr } = await sb.from('booking_inquiries').insert({
          name,
          email,
          phone: phone || null,
          event_type: null,
          party_size: null,
          preferred_date: preferredDate || null,
          notes: notes || null,
        })
        if (insertErr) throw insertErr
      }
      // Fire-and-forget email notification. Failure here doesn't block the
      // user — the inquiry was already saved to Supabase.
      try {
        await fetch('/api/booking-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            phone: phone || undefined,
            preferred_date: preferredDate || undefined,
            notes: notes || undefined,
          }),
        })
      } catch (notifyErr) {
        console.warn('[booking-notify] call failed', notifyErr)
      }
      setSubmitted(true)
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Try again or email us direct.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="section" id="bookings" style={{ borderTop: '1px solid rgba(235,228,212,0.08)', borderBottom: '1px solid rgba(235,228,212,0.08)' }}>
      <div className="container">
        <div className="section-head">
          <div>
            <span className="section-label">06 · Groups & Get-Togethers</span>
            <h2 className="section-title">Bring the<br /><em>whole crew</em></h2>
          </div>
          <p className="section-intro">
            Got a group coming through? A birthday, a celebration, or just a big night out? Let us know and we&apos;ll make sure you&apos;re taken care of.
          </p>
        </div>

        <div className={styles.grid}>
          <div className={styles.bullets}>
            <div className={styles.intro}>
              <p className={styles.introBody}>
                <em>
                  No formal booking system yet — we keep things easy. Drop us a
                  line a few days ahead and we&apos;ll make sure there&apos;s a table
                  saved, a tab open, and enough seats for the whole party.
                </em>
              </p>
              <p className={styles.comingSoon}>◆ Private event room coming soon</p>
            </div>

            <div className={styles.directContact}>
              <span className={styles.directLabel}>◆ Or Reach Out Direct</span>
              <p className={styles.directInfo}>
                <a href={`mailto:${BRAND.email}`} className={styles.directLink}>{BRAND.email}</a>
                <br />
                <a href={BRAND.phoneHref} className={styles.directLink}>{BRAND.phone}</a>
              </p>
            </div>
          </div>

          <div className={styles.form}>
            {!submitted ? (
              <>
                <span className={styles.formLabel}>◆ Give Us a Heads Up</span>
                <h3 className={styles.formTitle}>Tell us about it</h3>
                <form onSubmit={handleSubmit} className={styles.fields}>
                  <div>
                    <label className="form-label">Your Name</label>
                    <input className="input" placeholder="Jane Doe" value={name} onChange={e => setName(e.target.value)} required />
                  </div>
                  <div className={styles.row}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Email</label>
                      <input className="input" type="email" placeholder="jane@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Phone</label>
                      <input className="input" type="tel" placeholder="(530) 555-0142" value={phone} onChange={e => setPhone(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">When are you thinking?</label>
                    <input className="input" type="date" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">What&apos;s the occasion?</label>
                    <textarea className="textarea" rows={4} placeholder="Birthday, work crew, road trip stopover, just a big group… anything we should know? How many of you?" value={notes} onChange={e => setNotes(e.target.value)} />
                  </div>
                  {error && <p className={styles.errorMsg}><em>{error}</em></p>}
                  <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                    {submitting ? 'Sending…' : 'Send It →'}
                  </button>
                </form>
              </>
            ) : (
              <div className={styles.success}>
                <span className={styles.successLabel}>◆ MUCH OBLIGED ◆</span>
                <h3 className={styles.successTitle}>We&apos;ll Be In Touch</h3>
                <p className={styles.successDesc}>
                  <em>Thanks, {name.split(' ')[0] || 'friend'}. We&apos;ll get back to you within a day or two.</em>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
