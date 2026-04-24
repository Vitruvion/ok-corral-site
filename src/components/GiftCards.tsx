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
  const presets = [25, 50, 100, 200]

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
                <label className="form-label">To</label>
                <input className="input" placeholder="Their name" value={to} onChange={e => setTo(e.target.value)} />
              </div>
              <div>
                <label className="form-label">From</label>
                <input className="input" placeholder="Your name" value={from} onChange={e => setFrom(e.target.value)} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Their Email</label>
                <input className="input" type="email" placeholder="you@example.com" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">A note (optional)</label>
                <textarea className="textarea" rows={3} placeholder="Happy birthday, now go get a Scorpion Shot." />
              </div>
            </div>
            <div className={styles.modalFoot}>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn btn-primary" onClick={() => setStep(3)}>Next →</button>
            </div>
          </>
        )}

        {step === 3 && (
          <div className={styles.delivered}>
            <span className={styles.stepLabel}>◆ DELIVERED</span>
            <h3 className={styles.modalTitle}>On its way.</h3>
            <p className={styles.deliveredDesc}>
              <em>We&apos;ll email <strong>{to || 'them'}</strong> a <strong>${amount}</strong> gift card from <strong>{from || 'you'}</strong> — good at the bar, online, and everywhere in between.</em>
            </p>
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  )
}
