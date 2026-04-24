'use client'
import { useEffect, useState } from 'react'
import styles from './ProgressRail.module.css'

const SECTIONS = [
  { id: 'events',   label: 'Events' },
  { id: 'drinks',   label: 'Bar' },
  { id: 'merch',    label: 'Merch' },
  { id: 'gallery',  label: 'Gallery' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'visit',    label: 'Visit' },
]

export default function ProgressRail() {
  const [activeId, setActiveId] = useState<string>('events')

  useEffect(() => {
    const targets = SECTIONS
      .map(s => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el))

    if (targets.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] }
    )

    targets.forEach(t => observer.observe(t))
    return () => observer.disconnect()
  }, [])

  const onClick = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav className={styles.rail} aria-label="Section navigation">
      <ul className={styles.list}>
        {SECTIONS.map(s => (
          <li key={s.id} className={styles.item}>
            <button
              className={`${styles.dot} ${activeId === s.id ? styles.dotActive : ''}`}
              onClick={() => onClick(s.id)}
              aria-label={`Jump to ${s.label}`}
              aria-current={activeId === s.id ? 'true' : undefined}
            />
            <span className={styles.tip}>{s.label}</span>
          </li>
        ))}
      </ul>
    </nav>
  )
}
