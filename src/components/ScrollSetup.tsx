'use client'
import { useEffect } from 'react'

/**
 * Two jobs, both about a page opened with a #hash (a shared link like
 * okcorralsaloon.com/#stay):
 *
 * 1. Smooth scrolling is OFF until the page has landed. The browser's own
 *    jump to a hash happens while the page is still loading. If it is
 *    smooth, Chromium flies down the whole page towards a target position
 *    fixed at the start -- and the web fonts arriving mid-flight push the
 *    section further down, so it finishes short, the label 80-150px low.
 *    Instant, it lands at once and scroll anchoring keeps it there as the
 *    fonts swap in. `html.smooth-scroll` (globals.css) is added here, so
 *    every click after that -- nav, CTAs, the dot rail -- is smooth as
 *    before.
 *
 * 2. ONE re-scroll to the hash target once fonts have loaded and the page
 *    has hydrated -- only if the page was opened with a hash, and only if
 *    the visitor hasn't started scrolling themselves (wheel, touch drag,
 *    keys). It lands with the section's scroll-margin-top, so the label
 *    clears the bar. If the browser already put it there, this moves
 *    nothing. No loop, no second correction.
 */
export default function ScrollSetup() {
  useEffect(() => {
    const root = document.documentElement
    const enableSmooth = () => root.classList.add('smooth-scroll')

    const hash = window.location.hash
    let target: HTMLElement | null = null
    if (hash.length > 1) {
      try {
        target = document.getElementById(decodeURIComponent(hash.slice(1)))
      } catch {
        target = null
      }
    }
    if (!target) {
      enableSmooth()
      return
    }

    let userScrolled = false
    let cancelled = false
    const onUser = () => { userScrolled = true }
    const inputs = ['wheel', 'touchmove', 'keydown'] as const
    const opts: AddEventListenerOptions = { passive: true, capture: true }
    inputs.forEach(e => window.addEventListener(e, onUser, opts))
    const stopListening = () => inputs.forEach(e => window.removeEventListener(e, onUser, opts))

    // "Fonts loaded" = document.fonts.status turns 'loaded', checked once
    // a frame (capped at 4s). NOT document.fonts.ready or the loadingdone
    // event: in WebKit, for fonts a stylesheet asked for, ready settles
    // only with the page's load event (after every image), loadingdone
    // never fires, and faces still downloading report 'error' rather than
    // 'loading' -- measured: fonts in at ~1.0s, ready at ~3.7s. Waiting
    // for ready is exactly the late visible jump this exists to prevent.
    // The status is right in both engines.
    const fontsLoaded = new Promise<void>(resolve => {
      const fonts = document.fonts
      const start = performance.now()
      const check = () => {
        if (cancelled) return
        if (!fonts || fonts.status === 'loaded' || performance.now() - start > 4000) resolve()
        else requestAnimationFrame(check)
      }
      check()
    })
    fontsLoaded
      .then(() => {
        if (cancelled) return
        requestAnimationFrame(() => {
          if (cancelled) return
          stopListening()
          // Smooth is still off, so this is instant.
          if (!userScrolled && window.location.hash === hash) target!.scrollIntoView({ block: 'start' })
          enableSmooth()
        })
      })

    return () => {
      cancelled = true
      stopListening()
    }
  }, [])

  return null
}
