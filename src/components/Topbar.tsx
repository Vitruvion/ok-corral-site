'use client'
import { useState, useEffect } from 'react'
import Wordmark from './Wordmark'
import MobileMenu from './MobileMenu'
import { NAV_LINKS, BRAND } from '@/lib/data'
import { useCart } from '@/lib/cart'
import styles from './Topbar.module.css'

export default function Topbar() {
  const { count: cartCount, setOpen: setCartOpen } = useCart()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header className={`${styles.topbar} ${scrolled ? styles.scrolled : ''}`}>
        <a href="#" className={styles.logo}>
          <Wordmark variant="inline" size={scrolled ? 18 : 20} />
        </a>

        <nav className={styles.nav}>
          {NAV_LINKS.map(link => (
            <a key={link.href} href={link.href} className={styles.navLink}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className={styles.right}>
          <div className={styles.hoursPill}>
            <HoursDot />
          </div>

          <a
            href={BRAND.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.igLink}
          >
            @{BRAND.instagram}
          </a>

          <button className={styles.cartBtn} onClick={() => setCartOpen(true)} aria-label="Open cart">
            <span className={styles.cartLabel}>Cart</span>
            {cartCount > 0 && <span className={styles.cartBadge}>{cartCount}</span>}
          </button>

          <button
            className={styles.menuBtn}
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <span className={styles.menuBar} />
            <span className={styles.menuBar} />
            <span className={styles.menuBar} />
          </button>
        </div>
      </header>

      {menuOpen && <MobileMenu onClose={() => setMenuOpen(false)} />}
    </>
  )
}

function HoursDot() {
  const [isOpen, setIsOpen] = useState(false)
  const [label, setLabel] = useState('')

  useEffect(() => {
    const check = () => {
      const now = new Date()
      const h = now.getHours()
      // Open 8 AM (8) to 2 AM (26 = next day 2)
      const open = h >= 8 || h < 2
      setIsOpen(open)
      if (open) {
        if (h >= 8) {
          const left = (26 - h)
          setLabel(`Open · Til 2 AM`)
        } else {
          const left = 2 - h
          setLabel(`Open · Til 2 AM`)
        }
      } else {
        setLabel('Closed · Opens 8 AM')
      }
    }
    check()
    const iv = setInterval(check, 60000)
    return () => clearInterval(iv)
  }, [])

  return (
    <>
      <span className={`${styles.dot} ${isOpen ? styles.dotOpen : styles.dotClosed}`} />
      <span>{label}</span>
    </>
  )
}
