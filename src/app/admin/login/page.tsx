import type { Metadata } from 'next'
import { Suspense } from 'react'
import LoginForm from './LoginForm'
import styles from './login.module.css'

export const metadata: Metadata = {
  title: 'Sign in — OK Corral',
  robots: { index: false, follow: false },
}

export default function AdminLoginPage() {
  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <span className={styles.kicker}>◆ Staff Only</span>
        <h1 className={styles.title}>The O.K. Corral</h1>
        <p className={styles.sub}>Menu editor</p>
        {/* useSearchParams needs a Suspense boundary to prerender. */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  )
}
