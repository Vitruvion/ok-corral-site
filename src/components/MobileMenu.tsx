'use client'
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { NAV_LINKS, BRAND } from '@/lib/data'
import { FacebookIcon, InstagramIcon, TikTokIcon } from './SocialIcons'
import styles from './MobileMenu.module.css'

/**
 * Pins the page where it is while the drawer is open, and puts it back
 * exactly there on close.
 *
 * `overflow: hidden` on <body> is not a scroll lock on iOS Safari -- the
 * page behind keeps scrolling under a finger. Fixing <body> in place at
 * -scrollY is: nothing behind the drawer can move, and the visible page
 * does not shift. Returns the release function, which is idempotent.
 */
function lockPageScroll(): () => void {
  const y = window.scrollY
  const body = document.body
  const prev = { position: body.style.position, top: body.style.top, left: body.style.left, right: body.style.right, width: body.style.width }
  body.style.position = 'fixed'
  body.style.top = `-${y}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.width = '100%'
  let released = false
  return () => {
    if (released) return
    released = true
    Object.assign(body.style, prev)
    // The site scrolls smoothly (globals.css); this jump back must not
    // animate, or the page visibly slides from the top on every close.
    const html = document.documentElement
    const behavior = html.style.scrollBehavior
    html.style.scrollBehavior = 'auto'
    window.scrollTo(0, y)
    html.style.scrollBehavior = behavior
  }
}

export default function MobileMenu({ onClose }: { onClose: () => void }) {
  const releaseRef = useRef<(() => void) | null>(null)

  // Layout effect: locked before the first paint of the drawer, released
  // in the same commit that removes it.
  useLayoutEffect(() => {
    const release = lockPageScroll()
    releaseRef.current = release
    return release
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /**
   * A nav link releases the lock HERE, synchronously, before the browser
   * follows the link. The anchor jump then runs on an unlocked page from
   * the restored position -- exactly as it did before the lock existed --
   * instead of against a pinned body it cannot scroll.
   */
  const go = useCallback(() => {
    releaseRef.current?.()
    onClose()
  }, [onClose])

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Menu" onClick={e => e.stopPropagation()}>
        {/* Stays put: the close button is on screen however far the
            content below has been scrolled. */}
        <div className={styles.head}>
          <span className={styles.headLabel}>◆ Menu</span>
          <button className={styles.close} onClick={onClose} aria-label="Close menu">×</button>
        </div>
        {/* The only part that scrolls. */}
        <div className={styles.scroll}>
          <nav className={styles.nav}>
            {NAV_LINKS.map(link => (
              <a key={link.href} href={link.href} className={styles.navLink} onClick={go}>
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
            </div>

            <div className={styles.socials}>
              <span className={styles.socialsLabel}>◆ Follow</span>
              <div className={styles.socialsRow}>
                <a
                  href={BRAND.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label={`Instagram @${BRAND.instagram}`}
                >
                  <InstagramIcon />
                  <span>Instagram</span>
                </a>
                <a
                  href={BRAND.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label="Facebook"
                >
                  <FacebookIcon />
                  <span>Facebook</span>
                </a>
                <a
                  href={BRAND.tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                  aria-label={`TikTok @${BRAND.tiktok}`}
                >
                  <TikTokIcon />
                  <span>TikTok</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
