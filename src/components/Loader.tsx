'use client'
import { useEffect, useState } from 'react'
import styles from './Loader.module.css'

const LETTERS = ['T', 'H', 'E', ' ', 'O', 'K', ' ', 'C', 'O', 'R', 'R', 'A', 'L']

export default function Loader() {
  const [phase, setPhase] = useState<'in' | 'out' | 'gone'>('in')

  useEffect(() => {
    const reduced = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setPhase('gone')
      return
    }
    const t1 = setTimeout(() => setPhase('out'), 900)
    const t2 = setTimeout(() => setPhase('gone'), 1700)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  if (phase === 'gone') return null

  return (
    <div className={`${styles.loader} ${phase === 'out' ? styles.out : ''}`} aria-hidden="true">
      <div className={styles.curtainTop} />
      <div className={styles.curtainBottom} />
      <div className={styles.inner}>
        <span className={styles.label}>◆ EST. 2025 ◆</span>
        <h1 className={styles.wordmark}>
          {LETTERS.map((l, i) => (
            <span
              key={i}
              className={l === ' ' ? styles.space : styles.letter}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {l === ' ' ? '\u00A0' : l}
            </span>
          ))}
        </h1>
        <span className={styles.subtitle}>Cottonwood, California</span>
      </div>
    </div>
  )
}
