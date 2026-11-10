import Link from 'next/link'
import type { ReactNode } from 'react'
import Wordmark from './Wordmark'
import { BRAND } from '@/lib/data'
import styles from './LegalPage.module.css'

/**
 * The frame for reading pages (/privacy, /terms): a slim bar with the
 * wordmark and a way home, a single comfortable column, and a small
 * footer. Not the homepage Topbar/Footer -- their links are in-page
 * anchors (#events ...) that would point nowhere from here, and the
 * footer carries a sign-up form that has no business on a legal page.
 * No age gate: these pages have to be readable by anyone, Stripe's
 * reviewers included.
 */
export default function LegalPage({
  kicker,
  title,
  effective,
  children,
}: {
  kicker: string
  title: string
  effective: string
  children: ReactNode
}) {
  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link href="/" className={styles.home} aria-label={`${BRAND.name} home`}>
          <Wordmark variant="inline" size={18} />
        </Link>
        <Link href="/" className={styles.back}>← Back to the saloon</Link>
      </header>

      <main className={styles.main}>
        <article className={styles.article}>
          <span className={styles.kicker}>◆ {kicker}</span>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.effective}>Effective {effective}</p>
          {children}
        </article>
      </main>

      <footer className={styles.foot}>
        <nav className={styles.footLinks} aria-label="Legal">
          <Link href="/">Home</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
        <p className={styles.footContact}>
          {BRAND.name} · {BRAND.address.line1}, {BRAND.address.line2} ·{' '}
          <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a> · <a href={BRAND.phoneHref}>{BRAND.phone}</a>
        </p>
      </footer>
    </div>
  )
}
