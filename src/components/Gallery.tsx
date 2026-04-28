'use client'
import { useState } from 'react'
import { GALLERY, BRAND } from '@/lib/data'
import ImageOrPlaceholder from './ImageOrPlaceholder'
import styles from './Gallery.module.css'

export default function GallerySection() {
  const [lightbox, setLightbox] = useState<number | null>(null)

  const openLb = (i: number) => setLightbox(i)
  const closeLb = () => setLightbox(null)
  const prevLb = () => setLightbox(i => i !== null ? (i - 1 + GALLERY.length) % GALLERY.length : null)
  const nextLb = () => setLightbox(i => i !== null ? (i + 1) % GALLERY.length : null)

  return (
    <section className="section" id="gallery">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="section-label">05 · The Room</span>
            <h2 className="section-title">How it<br /><em>actually feels</em></h2>
          </div>
          <p className="section-intro">
            No filters. No stage lights in the photos. Just the room, on an average Saturday.
          </p>
        </div>

        <div className={styles.grid}>
          {GALLERY.map((item, i) => (
            <button
              key={item.id}
              className={styles.item}
              style={{
                gridColumn: `span ${item.cols}`,
                gridRow: `span ${item.rows}`,
              }}
              onClick={() => openLb(i)}
            >
              <ImageOrPlaceholder
                src={item.image}
                alt={item.label}
                label={item.label}
                loading={i < 4 ? 'eager' : 'lazy'}
              />
              <span className={styles.caption}>{item.label}</span>
              <span className={styles.zoom}>⤢</span>
            </button>
          ))}
        </div>

        <div className={styles.follow}>
          <div className={styles.followLeft}>
            <span className={styles.followTitle}>
              See more on <em>Instagram</em>
            </span>
            <span className={styles.followSub}>New photos every week · tag us to be featured</span>
          </div>
          <a href={BRAND.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
            @{BRAND.instagram} →
          </a>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div className={styles.lightbox} onClick={closeLb}>
          <div className={styles.lbStage} onClick={e => e.stopPropagation()}>
            <div className={styles.lbImageWrap}>
              <ImageOrPlaceholder
                src={GALLERY[lightbox].image}
                alt={GALLERY[lightbox].label}
                label={GALLERY[lightbox].label}
                cover={false}
                loading="eager"
              />
            </div>
            <span className={styles.lbCaption}>{GALLERY[lightbox].label}</span>
          </div>
          <button className={styles.lbClose} onClick={closeLb}>✕</button>
          <button className={`${styles.lbNav} ${styles.lbPrev}`} onClick={(e) => { e.stopPropagation(); prevLb(); }}>←</button>
          <button className={`${styles.lbNav} ${styles.lbNext}`} onClick={(e) => { e.stopPropagation(); nextLb(); }}>→</button>
        </div>
      )}
    </section>
  )
}
