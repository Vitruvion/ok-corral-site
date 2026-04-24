'use client'
import { useState } from 'react'
import { MERCH, MERCH_CATEGORIES, type MerchItem } from '@/lib/data'
import { useCart } from '@/lib/cart'
import styles from './Merch.module.css'

type Props = {
  merch?: MerchItem[]
}

export default function MerchSection({ merch = MERCH }: Props = {}) {
  const [filter, setFilter] = useState('All')
  const { addItem } = useCart()

  const filtered = filter === 'All' ? merch : merch.filter(m => m.category === filter)

  return (
    <section className="section" id="merch" style={{ background: 'var(--ink-2)', borderTop: '1px solid rgba(235,228,212,0.08)', borderBottom: '1px solid rgba(235,228,212,0.08)' }}>
      <div className="container">
        <div className="section-head">
          <div>
            <span className="section-label">03 · The General Store</span>
            <h2 className="section-title">Corral<br /><em>provisions</em></h2>
          </div>
          <p className="section-intro">
            Small-batch goods, printed in California. Wear &apos;em well. Free shipping on orders over $75.
          </p>
        </div>

        <div className={styles.filters}>
          {MERCH_CATEGORIES.map(c => (
            <button
              key={c}
              className={`${styles.filter} ${filter === c ? styles.filterActive : ''}`}
              onClick={() => setFilter(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className={styles.grid}>
          {filtered.map(item => (
            <div key={item.id} className={styles.card}>
              <div className={`${styles.image} ${item.imageBg === 'bone' ? styles.imageBone : ''}`}>
                {item.image ? (
                  <div className={styles.imgPlaceholder}>
                    <span className="placeholder-label">{item.name}</span>
                  </div>
                ) : (
                  <div className="placeholder" style={{ width: '100%', height: '100%' }}>
                    <span className="placeholder-label">{item.name}</span>
                  </div>
                )}
                {item.badge && <span className={styles.badge}>{item.badge}</span>}
                <div className={styles.overlay}>
                  <span className={styles.overlayText}>View Details</span>
                </div>
              </div>
              <div className={styles.info}>
                <div>
                  <span className={styles.itemName}>{item.name}</span>
                  <span className={styles.itemCategory}>{item.category} · {item.color}</span>
                </div>
                <span className={styles.itemPrice}>${item.price}</span>
              </div>
              <button
                className={styles.quickAdd}
                onClick={(e) => { e.stopPropagation(); addItem(item) }}
                aria-label={`Add ${item.name} to cart`}
              >
                + Add
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
