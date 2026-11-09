/**
 * Keeps the page-wide film grain off one element -- used for the official
 * Harvest Hosts badge, which must be shown exactly as supplied.
 *
 * The grain is `body::before` in globals.css: fixed, z-index 9999, above
 * every piece of chrome on the page (Topbar 100, drawer 500, modals and
 * lightboxes up to 2000). Raising the badge above it would also raise it
 * above all of those -- it would paint over the Topbar as it scrolls under
 * it, and over an open drawer or lightbox. So nothing is re-stacked;
 * instead a mask cuts a hole in the grain (`html[data-grain-hole]
 * body::before` in globals.css) exactly where the element is visible:
 *
 *   - its box, rounded outward so no edge pixel keeps a speck of grain;
 *   - clipped to below the fixed Topbar, so the bar keeps its grain while
 *     the badge slides under it;
 *   - none at all when anything else is on top of it (drawer, modal,
 *     lightbox, loader) -- checked by hit-testing its visible centre.
 *
 * The box moves with scroll, so it is re-read on scroll and resize, when
 * the layout changes size, when an overlay opens (they lock the body's
 * style or mount new nodes), and when a transition or animation ends
 * (the drawer slides in without any scroll). All of it coalesces into one
 * read per frame, and only writes when the hole actually changes.
 *
 * Returns a cleanup function that removes every trace.
 */
export function excludeFromGrain(el: HTMLElement): () => void {
  const root = document.documentElement
  const body = document.body
  const style = document.createElement('style')
  style.setAttribute('data-grain-hole', '')
  document.head.appendChild(style)
  const topbar = [...document.querySelectorAll('header')].find(h => getComputedStyle(h).position === 'fixed') ?? null

  let raf = 0
  let last = ''
  const clear = () => {
    if (!last) return
    root.removeAttribute('data-grain-hole')
    last = ''
  }
  const update = () => {
    raf = 0
    const r = el.getBoundingClientRect()
    const top = Math.max(r.top, 0, topbar ? topbar.getBoundingClientRect().bottom : 0)
    const left = Math.max(r.left, 0)
    const right = Math.min(r.right, window.innerWidth)
    const bottom = Math.min(r.bottom, window.innerHeight)
    if (right <= left || bottom <= top) return clear()
    // Something else on top of it: leave the grain alone entirely.
    if (document.elementFromPoint((left + right) / 2, (top + bottom) / 2) !== el) return clear()

    const css = `body::before{--gh-x:${Math.floor(left)}px;--gh-y:${Math.floor(top)}px;--gh-r:${Math.ceil(r.right)}px;--gh-b:${Math.ceil(r.bottom)}px}`
    if (css === last) return
    style.textContent = css
    if (!last) root.setAttribute('data-grain-hole', '')
    last = css
  }
  const schedule = () => { if (!raf) raf = requestAnimationFrame(update) }

  update()
  const opts: AddEventListenerOptions = { passive: true, capture: true }
  window.addEventListener('scroll', schedule, opts)
  window.addEventListener('resize', schedule, opts)
  document.addEventListener('transitionend', schedule, opts)
  document.addEventListener('animationend', schedule, opts)
  const ro = new ResizeObserver(schedule)
  ro.observe(body)
  ro.observe(el)
  if (topbar) ro.observe(topbar)
  // Two observers: one observer re-observing the same node replaces its
  // options, and attributes across the subtree would fire every frame
  // (the marquee writes its transform per frame).
  const locks = new MutationObserver(schedule)
  locks.observe(body, { attributes: true, attributeFilter: ['style', 'class'] })
  const mounts = new MutationObserver(schedule)
  mounts.observe(body, { childList: true, subtree: true })

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('scroll', schedule, opts)
    window.removeEventListener('resize', schedule, opts)
    document.removeEventListener('transitionend', schedule, opts)
    document.removeEventListener('animationend', schedule, opts)
    ro.disconnect()
    locks.disconnect()
    mounts.disconnect()
    root.removeAttribute('data-grain-hole')
    style.remove()
  }
}
