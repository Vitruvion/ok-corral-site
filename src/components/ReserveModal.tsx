'use client'
import { useEffect, useState } from 'react'
import type { EventData } from '@/lib/data'
import styles from './ReserveModal.module.css'

type Props = {
  event: EventData | null
  onClose: () => void
}

export default function ReserveModal({ event, onClose }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [partySize, setPartySize] = useState('2')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!event) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [event, onClose])

  useEffect(() => {
    if (event) {
      setSubmitted(false)
      setName(''); setEmail(''); setPhone(''); setPartySize('2')
    }
  }, [event])

  if (!event) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
  }

  const d = new Date(event.date)
  const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label="Reserve tickets">
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>

        {!submitted ? (
          <>
            <span className={styles.label}>◆ RESERVE TICKETS</span>
            <h3 className={styles.title}>{event.name}</h3>
            <p className={styles.meta}>
              <em>{dateStr} · Doors {event.doors} · {event.tickets}</em>
            </p>

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label className="form-label">Your Name</label>
                <input
                  className="input"
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Full name"
                />
              </div>

              <div className={styles.field}>
                <label className="form-label">Email</label>
                <input
                  className="input"
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div className={styles.row}>
                <div className={styles.field}>
                  <label className="form-label">Phone</label>
                  <input
                    className="input"
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="(530) 555-0123"
                  />
                </div>

                <div className={styles.field}>
                  <label className="form-label">Party Size</label>
                  <select
                    className="select"
                    value={partySize}
                    onChange={e => setPartySize(e.target.value)}
                  >
                    {['1','2','3','4','5','6','7','8'].map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button type="submit" className={`btn btn-primary ${styles.submit}`}>
                Reserve {partySize} {partySize === '1' ? 'Spot' : 'Spots'} →
              </button>
              <p className={styles.fine}>
                <em>We&apos;ll hold your spot at the door. No charge until you arrive.</em>
              </p>
            </form>
          </>
        ) : (
          <div className={styles.done}>
            <span className={styles.label}>◆ YOU&apos;RE ON THE LIST</span>
            <h3 className={styles.title}>See you<br /><em>{event.weekday.slice(0,3)}.</em></h3>
            <p className={styles.doneDesc}>
              <em>{partySize} {partySize === '1' ? 'spot' : 'spots'} held for {name || 'you'}. Confirmation sent to {email}.</em>
            </p>
            <button className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  )
}
