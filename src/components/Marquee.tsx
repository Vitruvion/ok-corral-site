'use client'
import { useState, useEffect } from 'react'
import { MARQUEE_ITEMS } from '@/lib/data'
import styles from './Marquee.module.css'

export default function Marquee() {
  const [hovered, setHovered] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  useEffect(() => {
    const check = () => {
      const now = new Date()
      const h = now.getHours()
      const m = now.getMinutes()
      const open = h >= 8 || h < 2
      if (open) {
        // Minutes until 2 AM
        const minsToClose = h >= 8 ? (26 - h) * 60 - m : (2 - h) * 60 - m
        const hoursLeft = Math.floor(minsToClose / 60)
        const minsLeft = minsToClose % 60
        setStatusMsg(`◆ OPEN NOW · ${hoursLeft}h ${minsLeft}m left ◆`)
      } else {
        const minsToOpen = (8 - h) * 60 - m
        const hoursLeft = Math.floor(minsToOpen / 60)
        const minsLeft = minsToOpen % 60
        setStatusMsg(`◆ CLOSED · Opens in ${hoursLeft}h ${minsLeft}m ◆`)
      }
    }
    check()
    const iv = setInterval(check, 30000)
    return () => clearInterval(iv)
  }, [])

  const items = MARQUEE_ITEMS
  // Doubled so translating the track by -50% lands on an identical frame (seamless loop)
  const repeated = [...items, ...items]

  return (
    <div
      className={styles.marquee}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`${styles.track} ${hovered ? styles.paused : ''}`}>
        {repeated.map((item, i) => (
          <div key={i} className={styles.item}>
            <span className={styles.text}>{item.text}</span>
            <span className={styles.accent}>{item.accent}</span>
            <span className={styles.diamond} />
          </div>
        ))}
      </div>
      {hovered && (
        <div className={styles.hoverMsg}>{statusMsg}</div>
      )}
    </div>
  )
}
