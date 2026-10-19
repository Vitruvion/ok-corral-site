'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { MARQUEE_ITEMS, type RecurringEvent } from '@/lib/data'
import { dayName } from '@/lib/recurring'
import styles from './Marquee.module.css'

const SCROLL_SPEED_PX_PER_SEC = 50

type Props = {
  /**
   * Active weekly specials, already Monday-first -- the same array the
   * "Every Week" section renders (see fetchRecurring), so the two can
   * never disagree about what runs when, or in what order.
   */
  weekly?: RecurringEvent[]
}

export default function Marquee({ weekly = [] }: Props) {
  // Weekly specials first, then the fixed items (hours etc.) unchanged.
  // Each item carries its own trailing diamond, so dropping every weekly
  // row leaves no gap and no stray separator -- just fewer items.
  const items = useMemo(
    () => [
      ...weekly.map(r => ({
        text: dayName(r.day),
        accent: [r.name, r.time].filter(Boolean).join(' · '),
      })),
      ...MARQUEE_ITEMS,
    ],
    [weekly]
  )

  const [hovered, setHovered] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const trackRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  /** Width of ONE copy of the items, gap included: the loop length. */
  const periodRef = useRef(0)
  const itemCountRef = useRef(items.length)
  itemCountRef.current = items.length
  /**
   * How many copies of the items the track holds. At least two, and
   * enough that the track always covers the viewport plus one period --
   * otherwise a short list (say, only the hours line) would leave an
   * empty stretch on a wide screen before the loop came round.
   */
  const [copies, setCopies] = useState(2)
  const draggingRef = useRef(false)
  const hoveredRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartOffsetRef = useRef(0)
  const [dragging, setDragging] = useState(false)

  // Status banner for hover state
  useEffect(() => {
    const check = () => {
      const now = new Date()
      const h = now.getHours()
      const m = now.getMinutes()
      const open = h >= 8 || h < 2
      if (open) {
        const minsToClose = h >= 8 ? (26 - h) * 60 - m : (2 - h) * 60 - m
        const hoursLeft = Math.floor(minsToClose / 60)
        const minsLeft = minsToClose % 60
        setStatusMsg(`\u25C6 OPEN NOW \u00B7 ${hoursLeft}h ${minsLeft}m left \u25C6`)
      } else {
        const minsToOpen = (8 - h) * 60 - m
        const hoursLeft = Math.floor(minsToOpen / 60)
        const minsLeft = minsToOpen % 60
        setStatusMsg(`\u25C6 CLOSED \u00B7 Opens in ${hoursLeft}h ${minsLeft}m \u25C6`)
      }
    }
    check()
    const iv = setInterval(check, 30000)
    return () => clearInterval(iv)
  }, [])

  // Keep refs in sync with state (refs are needed inside the rAF loop)
  useEffect(() => { hoveredRef.current = hovered }, [hovered])

  // The loop length is measured, not derived: the distance from the first
  // item to the first item of the second copy. (scrollWidth / 2 is half a
  // gap short of that, which showed as a small jump on every wrap.)
  const measure = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    const first = track.children[0] as HTMLElement | undefined
    const nextCopy = track.children[itemCountRef.current] as HTMLElement | undefined
    if (!first || !nextCopy) return
    const period = nextCopy.offsetLeft - first.offsetLeft
    if (period <= 0) return
    periodRef.current = period
    const needed = Math.max(2, Math.ceil(window.innerWidth / period) + 1)
    setCopies(c => (c === needed ? c : needed))
  }, [])

  // Re-measure whenever the items change (an edit at /admin/events) or
  // the copy count does.
  useEffect(() => { measure() }, [items, copies, measure])

  // Animation loop: advances offset over time unless paused (hover) or
  // suspended (drag). Reads from refs so it never restarts on rerender.
  useEffect(() => {
    if (!trackRef.current) return

    // The track holds `copies` identical copies of the items, so scrolling
    // exactly one period lands on a visually identical frame. Loop the
    // offset modulo the period.
    measure()
    // Re-measure on resize and after fonts load (font metrics change widths)
    window.addEventListener('resize', measure)
    if (document.fonts) document.fonts.ready.then(measure)

    let raf = 0
    let lastTime = performance.now()
    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000
      lastTime = now
      if (!draggingRef.current && !hoveredRef.current) {
        offsetRef.current -= SCROLL_SPEED_PX_PER_SEC * dt
        // Wrap so offset stays in (-period, 0]
        if (periodRef.current > 0) {
          while (offsetRef.current <= -periodRef.current) {
            offsetRef.current += periodRef.current
          }
        }
      }
      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  // Drag handlers: while dragging, the rAF loop sees draggingRef=true
  // and stops advancing the offset; we set the offset directly from the
  // drag delta. On release, the rAF loop resumes from wherever the user left it.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!trackRef.current) return
    draggingRef.current = true
    setDragging(true)
    dragStartXRef.current = e.clientX
    dragStartOffsetRef.current = offsetRef.current
    trackRef.current.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    const delta = e.clientX - dragStartXRef.current
    offsetRef.current = dragStartOffsetRef.current + delta
    // Keep offset wrapped so the user can drag in either direction infinitely
    if (periodRef.current > 0) {
      while (offsetRef.current <= -periodRef.current) {
        offsetRef.current += periodRef.current
      }
      while (offsetRef.current > 0) {
        offsetRef.current -= periodRef.current
      }
    }
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !trackRef.current) return
    draggingRef.current = false
    setDragging(false)
    trackRef.current.releasePointerCapture(e.pointerId)
  }

  const repeated = Array.from({ length: copies }, () => items).flat()

  if (items.length === 0) return null

  return (
    <div
      className={styles.marquee}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        ref={trackRef}
        className={styles.track}
        style={{ opacity: hovered ? 0.3 : 1, transition: 'opacity 300ms ease' }}
      >
        {repeated.map((item, i) => (
          <div key={i} className={styles.item}>
            <span className={styles.text}>{item.text}</span>
            <span className={styles.accent}>{item.accent}</span>
            <span className={styles.diamond} />
          </div>
        ))}
      </div>
      {hovered && !dragging && (
        <div className={styles.hoverMsg}>{statusMsg}</div>
      )}
    </div>
  )
}