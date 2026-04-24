'use client'
import { useEffect, useMemo, useState } from 'react'
import { DRINKS, DRINK_TABS, type DrinkData } from '@/lib/data'
import styles from './Drinks.module.css'

type Props = {
  drinks?: Record<string, DrinkData[]>
}

export default function DrinkMenu({ drinks = DRINKS }: Props = {}) {
  const tabs = useMemo(() => {
    const present = DRINK_TABS.filter(t => drinks[t]?.length)
    return present.length > 0 ? present : DRINK_TABS
  }, [drinks])
  const [tab, setTab] = useState(tabs[0] || 'Signature')
  const [scorpModalOpen, setScorpModalOpen] = useState(false)

  useEffect(() => {
    if (!scorpModalOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setScorpModalOpen(false) }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [scorpModalOpen])

  return (
    <section className="section" id="drinks" style={{ borderTop: '1px solid rgba(235,228,212,0.08)' }}>
      <div className="container">
        <div className="section-head">
          <div>
            <span className="section-label">03 · The Pour</span>
            <h2 className="section-title">At the <em>bar</em></h2>
          </div>
          <p className="section-intro">
            A short list done right. Local beer on draft, the classics as they were written, and a house shot we&apos;re not going to tell you anything about.
          </p>
        </div>

        {/* Scorpion Card */}
        <div className={styles.scorpCard}>
          <div className={styles.scorpInk} />
          <div className={styles.scorpGlow} />
          <div className={styles.scorpInner}>
            <div className={styles.scorpLeft}>
              <span className={styles.scorpLabel}>◆ HOUSE LEGEND</span>
              <h3 className={styles.scorpTitle}>
                The<br /><em>Scorpion</em><br />Shot
              </h3>
              <p className={styles.scorpBody}>
                <em>Invented on a Tuesday. Perfected on a Saturday. One ingredient list, one bartender who knows it, and exactly one per customer, per night.</em>
              </p>
              <div className={styles.scorpMeta}>
                <div className={styles.scorpCell}>
                  <span className={styles.scorpCellLabel}>PRICE</span>
                  <span className={styles.scorpCellValue}>$12</span>
                </div>
                <div className={styles.scorpCell}>
                  <span className={styles.scorpCellLabel}>LIMIT</span>
                  <span className={styles.scorpCellValue}>One per guest</span>
                </div>
                <div className={styles.scorpCell}>
                  <span className={styles.scorpCellLabel}>RECIPE</span>
                  <span className={styles.scorpCellValue}>Classified</span>
                </div>
              </div>
              <button className="btn btn-primary" onClick={() => setScorpModalOpen(true)}>
                What&apos;s in it? <em style={{ fontFamily: 'var(--ff-serif)', fontSize: '1.3em' }}>?</em>
              </button>
            </div>
            <div className={styles.scorpRight}>
              <svg className={styles.scorpGlass} viewBox="0 0 160 224" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M30 20 L20 200 L140 200 L130 20 Z" stroke="var(--bone)" strokeWidth="2.5" opacity="0.6" fill="none" />
                <path d="M32 22 L22 198 L138 198 L128 22 Z" fill="url(#liquid)" opacity="0.85" />
                <ellipse cx="80" cy="20" rx="50" ry="6" stroke="var(--bone)" strokeWidth="2" fill="var(--ink-2)" />
                <line x1="30" y1="20" x2="130" y2="20" stroke="var(--bone)" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
                <text x="80" y="150" textAnchor="middle" fill="var(--ink)" fontSize="40" fontFamily="serif">☠</text>
                <defs>
                  <linearGradient id="liquid" x1="80" y1="22" x2="80" y2="198" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="var(--ember)" stopOpacity="0.9" />
                    <stop offset="1" stopColor="var(--ember-deep)" />
                  </linearGradient>
                </defs>
              </svg>
              <span className={styles.scorpStamp}>◆ NO TELLING ◆</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          {tabs.map(t => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Drink Grid */}
        <div className={styles.grid}>
          {drinks[tab]?.map((drink, i) => (
            <div key={i} className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <span className={styles.cardName}>{drink.name}</span>
                  <span className={styles.cardTagline}>{drink.tagline}</span>
                </div>
                <span className={styles.cardPrice}>{drink.price}</span>
              </div>
              <div className={styles.cardRule}>
                <span className={styles.cardRuleDiamond}>◆</span>
              </div>
              <p className={styles.cardDesc}>{drink.description}</p>
            </div>
          ))}
        </div>

        <div className={styles.foot}>
          ◆ Full bar · ID required · 21 &amp; over ◆
        </div>
      </div>

      {/* Scorpion Modal */}
      {scorpModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setScorpModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button className={styles.modalClose} onClick={() => setScorpModalOpen(false)}>✕</button>
            <span className={styles.modalLabel}>◆ CLASSIFIED ◆</span>
            <h3 className={styles.modalTitle}>
              Nice try,<br /><em>partner.</em>
            </h3>
            <p className={styles.modalDesc}>
              <em>The recipe stays at the bar. Come in, ask for one, drink it down. That&apos;s the whole ceremony.</em>
            </p>
            <div className={styles.modalActions}>
              <a href="#visit" className="btn btn-primary" onClick={() => setScorpModalOpen(false)}>Find Us →</a>
              <button className="btn btn-ghost" onClick={() => setScorpModalOpen(false)}>Fine, keep your secret</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
