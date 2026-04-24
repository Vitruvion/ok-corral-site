'use client'
import { useEffect } from 'react'
import { NAV_LINKS, BRAND } from '@/lib/data'
import styles from './MobileMenu.module.css'

export default function MobileMenu({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <span className={styles.headLabel}>◆ Menu</span>
          <button className={styles.close} onClick={onClose} aria-label="Close menu">×</button>
        </div>
        <nav className={styles.nav}>
          {NAV_LINKS.map(link => (
            <a key={link.href} href={link.href} className={styles.navLink} onClick={onClose}>
              <span>{link.label}</span>
              <span className={styles.navArrow}>→</span>
            </a>
          ))}
        </nav>
        <div className={styles.foot}>
          <span className={styles.footLabel}>◆ Find Us</span>
          <p className={styles.footAddr}>
            {BRAND.address.line1}<br />{BRAND.address.line2}
          </p>
          <div className={styles.footActions}>
            <a href={BRAND.phoneHref} className="btn btn-primary">{BRAND.phone}</a>
            <a href={BRAND.instagramUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
              @{BRAND.instagram}
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
