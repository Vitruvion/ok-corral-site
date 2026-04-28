'use client'
import { useMemo, useState } from 'react'
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
  const [tab, setTab] = useState(tabs[0] || 'Saloon Cocktails')

  return (
    <section className="section" id="drinks" style={{ borderTop: '1px solid rgba(235,228,212,0.08)' }}>
      <div className="container">
        <div className="section-head">
          <div>
            <span className="section-label">03 · The Pour</span>
            <h2 className="section-title">At the <em>bar</em></h2>
          </div>
          <p className="section-intro">
            Handcrafted cocktails, cold shots, and an exclusive house beer brewed just for us. No filler, no fluff — just a damn good pour.
          </p>
        </div>

        {/* Hucklebeer Feature Card — exclusive Woody's Brewing collab */}
        <div className={styles.featCard}>
          <div className={styles.featGlow} />
          <div className={styles.featInner}>
            <div className={styles.featLeft}>
              <span className={styles.featLabel}>◆ EXCLUSIVE COLLAB</span>
              <h3 className={styles.featTitle}>
                I&apos;m Your<br /><em>Hucklebeer</em>
              </h3>
              <p className={styles.featBody}>
                <em>Brewed exclusively for The OK Corral by Woody&apos;s Brewing Company. A huckleberry wheat ale that&apos;s smooth, slightly sweet, and dangerously easy to drink. Only available here.</em>
              </p>
              <div className={styles.featMeta}>
                <div className={styles.featCell}>
                  <span className={styles.featCellLabel}>STYLE</span>
                  <span className={styles.featCellValue}>Huckleberry Wheat</span>
                </div>
                <div className={styles.featCell}>
                  <span className={styles.featCellLabel}>ABV</span>
                  <span className={styles.featCellValue}>5.2%</span>
                </div>
                <div className={styles.featCell}>
                  <span className={styles.featCellLabel}>IBU</span>
                  <span className={styles.featCellValue}>20</span>
                </div>
                <div className={styles.featCell}>
                  <span className={styles.featCellLabel}>PRICE</span>
                  <span className={styles.featCellValue}>$7</span>
                </div>
              </div>
              <a
                href="https://woodysbrewing.com"
                target="_blank"
                rel="noopener noreferrer"
                className={`btn btn-primary ${styles.featCta}`}
              >
                Learn More About Woody&apos;s →
              </a>
            </div>
            <div className={styles.featRight}>
              <img
                className={styles.featArt}
                src="/assets/merch/hucklebeer-art.png"
                alt="I'm Your Hucklebeer — cowboy on horseback illustration"
                loading="eager"
                decoding="async"
              />
              <span className={styles.featStamp}>◆ ONLY AT THE CORRAL ◆</span>
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
    </section>
  )
}
