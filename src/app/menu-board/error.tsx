'use client'

import { useEffect } from 'react'
import styles from './menu-board.module.css'

/**
 * Backstop for the TV.
 *
 * getDrinks() throws on a query failure so ISR keeps serving the last good
 * page — this only renders when there is no cached page to fall back to
 * (first deploy, cold cache). A customer at the bar can see this screen, so
 * it says nothing about errors: no message, no stack, no retry button. Just
 * the wordmark and a line that reads as routine maintenance.
 *
 * The real reason goes to the server log, where it's useful.
 */
export default function MenuBoardError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error('[menu-board]', error)
  }, [error])

  return (
    <main className={styles.fallback}>
      <div className={styles.fallbackMark}>
        <span className={styles.markThe}>The</span>
        <span className={styles.markName}>O.K. Corral</span>
      </div>
      <p className={styles.fallbackNote}>Menu updating</p>
    </main>
  )
}
