'use client'
import { useState } from 'react'
import styles from './GiftCards.module.css'

export default function GiftCards() {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <section className={styles.section}>
      <div className="container">
        <div className={styles.card}>
          <div className={styles.art}>
            <div className={styles.artContent}>
              <span className={styles.artTop}>THE O.K. CORRAL</span>
              <span className={styles.artTitle}>GIFT CARD</span>
              <span className={styles.artNoExp}>◆ NO EXPIRATION ◆</span>
              <div className={styles.artBottom}>
                <div>
                  <span className={styles.artSmall}>COTTONWOOD · CA</span>
                  <span className={styles.artSmall}>EST. 2025</span>
                </div>
                <span className={styles.artAmount}>$100</span>
              </div>
            </div>
          </div>

          <div className={styles.copy}>
            <span className={styles.kicker}>◆ 🎁 GIFT CARDS</span>
            <h3 className={styles.title}>
              A round, on you,<br /><em>from you.</em>
            </h3>
            <p className={styles.desc}>
              <em>Digital and physical cards good for drinks, food, merch, and tickets. Any amount, any time, no expiration.</em>
            </p>
            <button className="btn btn-primary" onClick={() => setModalOpen(true)}>
              Buy a Gift Card →
            </button>
          </div>
        </div>
      </div>

      {modalOpen && <GiftCardModal onClose={() => setModalOpen(false)} />}
    </section>
  )
}

function GiftCardModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1)
  const [amount, setAmount] = useState(100)
  const [to, setTo] = useState('')
  const [from, setFrom] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const presets = [25, 50, 100, 200]

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const step2Valid = to.trim().length > 0 && emailValid

  const tryAdvanceFromStep2 = () => {
    if (!step2Valid) {
      setTouched(true)
      return
    }
    setStep(3)
  }

  const handleCheckout = async () => {
    setCheckingOut(true)
    setCheckoutError(null)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'gift_card',
          amount,
          to_name: to,
          to_email: email,
          from_name: from || undefined,
          note: note || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Checkout failed.')
      if (!json.url) throw new Error('No checkout URL returned.')
      window.location.href = json.url as string
    } catch (e: any) {
      setCheckoutError(e?.message || 'Something went wrong. Try again.')
      setCheckingOut(false)
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose}>✕</button>

        {step === 1 && (
          <>
            <span className={styles.stepLabel}>◆ STEP 1 / 3 · AMOUNT</span>
            <h3 className={styles.modalTitle}>How much?</h3>
            <div className={styles.amountGrid}>
              {presets.map(p => (
                <button key={p} className={`${styles.amountBtn} ${amount === p ? styles.amountActive : ''}`} onClick={() => setAmount(p)}>
                  ${p}
                </button>
              ))}
            </div>
            <input
              className={`input ${styles.customInput}`}
              type="number"
              min={10}
              max={500}
              placeholder="Custom amount"
              onChange={e => setAmount(Number(e.target.value))}
            />
            <div className={styles.modalFoot}>
              <span className={styles.total}>Total: <strong>${amount}</strong></span>
              <button className="btn btn-primary" onClick={() => setStep(2)}>Next →</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <span className={styles.stepLabel}>◆ STEP 2 / 3 · RECIPIENT</span>
            <h3 className={styles.modalTitle}>Who&apos;s it for?</h3>
            <div className={styles.gcForm}>
              <div>
                <label className="form-label">To <span className={styles.required}>*</span></label>
                <input
                  className="input"
                  placeholder="Their name"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  required
                  aria-invalid={touched && to.trim().length === 0 ? 'true' : undefined}
                />
              </div>
              <div>
                <label className="form-label">From</label>
                <input className="input" placeholder="Your name" value={from} onChange={e => setFrom(e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Their Email <span className={styles.required}>*</span></label>
                <input
                  className="input"
                  type="email"
                  placeholder="them@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  aria-invalid={touched && !emailValid ? 'true' : undefined}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">A note (optional)</label>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="Happy birthday, now go get a Scorpion Shot."
                  value={note}
                  onChange={e => setNote(e.target.value)}
                />
              </div>
            </div>
            {touched && !step2Valid && (
              <p className={styles.validationMsg}>
                <em>Recipient name and a valid email are required.</em>
              </p>
            )}
            <div className={styles.modalFoot}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={tryAdvanceFromStep2}
                disabled={touched && !step2Valid}
                aria-disabled={touched && !step2Valid}
              >
                Next →
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <span className={styles.stepLabel}>◆ STEP 3 / 3 · CHECKOUT</span>
            <h3 className={styles.modalTitle}>
              Review &amp;<br /><em>send it.</em>
            </h3>
            <ul className={styles.review}>
              <li>
                <span className={styles.reviewLabel}>Amount</span>
                <span className={styles.reviewValue}>${amount}</span>
              </li>
              <li>
                <span className={styles.reviewLabel}>To</span>
                <span className={styles.reviewValue}>{to}</span>
              </li>
              <li>
                <span className={styles.reviewLabel}>Email</span>
                <span className={styles.reviewValue}>{email}</span>
              </li>
              {from && (
                <li>
                  <span className={styles.reviewLabel}>From</span>
                  <span className={styles.reviewValue}>{from}</span>
                </li>
              )}
              {note && (
                <li>
                  <span className={styles.reviewLabel}>Note</span>
                  <span className={styles.reviewValue}>{note}</span>
                </li>
              )}
            </ul>
            <p className={styles.reviewFine}>
              <em>You&apos;ll be redirected to Stripe to complete payment. The card is delivered to {email} as soon as the charge clears.</em>
            </p>
            {checkoutError && (
              <p className={styles.validationMsg}><em>{checkoutError}</em></p>
            )}
            <div className={styles.modalFoot}>
              <button className="btn btn-ghost" onClick={() => setStep(2)} disabled={checkingOut}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={handleCheckout}
                disabled={checkingOut}
              >
                {checkingOut ? 'Redirecting…' : `Pay $${amount} →`}
              </button>
            </div>
            <p className={styles.secureNote}>◆ Secure checkout · powered by Stripe</p>
          </>
        )}
      </div>
    </div>
  )
}
