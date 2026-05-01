'use client'
import { useState } from 'react'
import { BRAND, BOOKING_TYPES, PARTY_SIZES } from '@/lib/data'
import { getSupabaseBrowser } from '@/lib/supabase-browser'
import styles from './Bookings.module.css'

export default function Bookings() {
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [eventType, setEventType] = useState('')
  const [partySize, setPartySize] = useState('')
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
          event_type: eventType || null,
          party_size: partySize || null,
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
            event_type: eventType || undefined,
            party_size: partySize || undefined,
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
            <span className="section-label">06 · Private Bookings</span>
            <h2 className="section-title">Host at<br /><em>the corral</em></h2>
          </div>
          <p className="section-intro">
            Birthdays, buyouts, wrap parties, rehearsal dinners. Full room or a corner by the pool tables.
          </p>
        </div>

        <div className={styles.grid}>
          <div className={styles.bullets}>
            <div className={styles.bullet}>
              <span className={styles.bulletLabel}>◆ Full Buyout</span>
              <h4 className={styles.bulletTitle}>The whole saloon</h4>
              <p className={styles.bulletDesc}>200-person capacity · private bar · PA &amp; stage · pool tables and jukebox included.</p>
            </div>
            <div className={styles.bullet}>
              <span className={styles.bulletLabel}>◆ Patio Buyout</span>
              <h4 className={styles.bulletTitle}>Up to 60 guests</h4>
              <p className={styles.bulletDesc}>Reserve the full patio. Outdoor bar service, string lights, and plenty of elbow room for a crowd. Great for birthdays, anniversaries, and warm Cottonwood nights.</p>
            </div>
            <div className={styles.bullet}>
              <span className={styles.bulletLabel}>◆ Tab Reservations</span>
              <h4 className={styles.bulletTitle}>Parties of 10+</h4>
              <p className={styles.bulletDesc}>Reserve pool tables and tables of six. Pre-arrange a bar tab, a taco tower, a keg. We&apos;ll keep them waiting.</p>
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
                <span className={styles.formLabel}>◆ Inquire</span>
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
                  <div className={styles.row}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Event Type</label>
                      <select className="select" value={eventType} onChange={e => setEventType(e.target.value)} required>
                        <option value="">Select…</option>
                        {BOOKING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">Party Size</label>
                      <select className="select" value={partySize} onChange={e => setPartySize(e.target.value)} required>
                        <option value="">Select…</option>
                        {PARTY_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Preferred Date</label>
                    <input className="input" type="date" value={preferredDate} onChange={e => setPreferredDate(e.target.value)} required />
                  </div>
                  <div>
                    <label className="form-label">Notes</label>
                    <textarea className="textarea" rows={3} placeholder="Bar tab, food, live music, theme… tell us what you're dreaming up." value={notes} onChange={e => setNotes(e.target.value)} />
                  </div>
                  {error && <p className={styles.errorMsg}><em>{error}</em></p>}
                  <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}>
                    {submitting ? 'Sending…' : 'Send Inquiry →'}
                  </button>
                </form>
              </>
            ) : (
              <div className={styles.success}>
                <span className={styles.successLabel}>◆ MUCH OBLIGED ◆</span>
                <h3 className={styles.successTitle}>We&apos;ll Be In Touch</h3>
                <p className={styles.successDesc}>
                  <em>Thanks, {name.split(' ')[0] || 'friend'}. We&apos;ll follow up within a day or two to lock it in.</em>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
