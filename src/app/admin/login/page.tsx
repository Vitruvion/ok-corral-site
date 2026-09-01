import type { Metadata } from 'next'
import { Suspense } from 'react'
import { currentRole } from '@/lib/admin/guard'
import LoginForm from './LoginForm'
import SignedInNotice from './SignedInNotice'
import styles from './login.module.css'

export const metadata: Metadata = {
  title: 'Sign in — OK Corral',
  robots: { index: false, follow: false },
}

// The cookie has to be read per request for the notice below to be
// right, so this page cannot be static any more.
export const dynamic = 'force-dynamic'

export default function AdminLoginPage() {
  const role = currentRole()

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
        {role && <SignedInNotice role={role} />}
      </div>
    </main>
  )
}
