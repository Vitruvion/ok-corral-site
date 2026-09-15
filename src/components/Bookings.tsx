'use client'
import { useState } from 'react'
import { BRAND } from '@/lib/data'
import { CONTACT_REASONS } from '@/lib/email/booking-inquiry'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import styles from './Bookings.module.css'

export default function Bookings() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  /**
   * Why they are writing. Required, and no default: a pre-selected
   * "booking" would be answered by silence and put us back where we
   * started, with every message in the inbox claiming to be a booking.
   */
  const [reason, setReason] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [notes, setNotes] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const sb = getSupabaseBrowser()
      if (sb) {
        const record = {
          name,
          email,
          phone: phone || null,
          event_type: null,
          party_size: null,
          preferred_date: preferredDate || null,
          notes: notes || null,
        }
        const { error: insertErr } = await sb
          .from('booking_inquiries')
          .insert({ ...record, reason: reason || null })

        if (insertErr) {
          /*
           * `reason` arrives with migration 0016, which Brady applies by
           * hand -- and this code deploys the moment it is pushed. In the
           * window between the two, an insert naming a column the table
           * does not have fails, and the only contact form on the site
           * would break for real visitors.
           *
           * So a missing-column error (PostgREST 'PGRST204' / Postgres
           * '42703') retries without it: the message still reaches us,
           * and the email still carries the reason because that goes
           * over the API, not through this table. Any other error is a
           * real failure and is thrown.
           */
          const missingColumn =
            insertErr.code === 'PGRST204' ||
            insertErr.code === '42703' ||
            /reason/i.test(insertErr.message || '')
          if (!missingColumn) throw insertErr
          console.warn('[bookings] reason column not present yet; saving without it')
          const retry = await sb.from('booking_inquiries').insert(record)
          if (retry.error) throw retry.error
        }
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
            reason: reason || undefined,
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
                    {/* Optional for every reason: a question about a lost
                        jacket has no date, and demanding one would be a
                        wall in front of the only way to reach us. */}
                    <label className="form-label">When are you thinking?</label>
                    <input className="input" type="date" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="contact-reason">What&apos;s this about?</label>
                    <select
                      id="contact-reason"
                      className="input"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                      required
                    >
                      <option value="" disabled>Pick one…</option>
                      {CONTACT_REASONS.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Tell us more</label>
                    <textarea className="textarea" rows={4} placeholder="Birthday, work crew, road trip stopover, a question, anything we should know — and how many of you, if that applies." value={notes} onChange={e => setNotes(e.target.value)} />
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
