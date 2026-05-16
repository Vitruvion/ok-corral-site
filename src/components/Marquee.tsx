'use client'

import { useState, useEffect, useRef } from 'react'
import { MARQUEE_ITEMS } from '@/lib/data'
import styles from './Marquee.module.css'

const SCROLL_SPEED_PX_PER_SEC = 50

export default function Marquee() {
  const [hovered, setHovered] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const trackRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const halfWidthRef = useRef(0)
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

  // Animation loop: advances offset over time unless paused (hover) or
  // suspended (drag). Reads from refs so it never restarts on rerender.
  useEffect(() => {
    if (!trackRef.current) return

    // Half-width: the track contains two copies of MARQUEE_ITEMS, so
    // scrolling exactly half the track length lands on a visually
    // identical frame. Loop the offset using modulo of half-width.
    const measure = () => {
      if (!trackRef.current) return
      halfWidthRef.current = trackRef.current.scrollWidth / 2
    }
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
        // Wrap so offset stays in (-halfWidth, 0]
        if (halfWidthRef.current > 0) {
          while (offsetRef.current <= -halfWidthRef.current) {
            offsetRef.current += halfWidthRef.current
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
  }, [])

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
    if (halfWidthRef.current > 0) {
      while (offsetRef.current <= -halfWidthRef.current) {
        offsetRef.current += halfWidthRef.current
      }
      while (offsetRef.current > 0) {
        offsetRef.current -= halfWidthRef.current
      }
    }
  }
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !trackRef.current) return
    draggingRef.current = false
    setDragging(false)
    trackRef.current.releasePointerCapture(e.pointerId)
  }

  const items = MARQUEE_ITEMS
  const repeated = [...items, ...items]

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