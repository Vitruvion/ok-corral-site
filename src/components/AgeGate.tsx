'use client'
import { useState, useEffect } from 'react'
import Wordmark from './Wordmark'
import styles from './AgeGate.module.css'

export default function AgeGate() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const ok = localStorage.getItem('okc_age_ok')
    if (!ok) setShow(true)
  }, [])

  if (!show) return null

  const handleYes = () => {
    localStorage.setItem('okc_age_ok', 'true')
    setShow(false)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.inner}>
        <Wordmark variant="full" className={styles.wordmark} />
        <div className={styles.body}>
          <span className={styles.howdy}>◆ HOWDY ◆</span>
          <h2 className={styles.title}>
            Are you 21<br />or older?
          </h2>
          <p className={styles.legal}>
            <em>By entering you confirm that you are of legal drinking age in your jurisdiction.</em>
          </p>
          <div className={styles.actions}>
            <button className="btn btn-primary btn-door" onClick={handleYes}>
              Yes, I&apos;m 21+ <span className="arrow">→</span>
            </button>
            <a
              href="https://www.responsibility.org/"
              className="btn btn-ghost"
              rel="noopener noreferrer"
            >
              I&apos;m not
            </a>
          </div>
          <p className={styles.foot}>◆ Drink responsibly ◆</p>
        </div>
      </div>
    </div>
  )
}
