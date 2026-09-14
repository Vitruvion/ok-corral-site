import Link from 'next/link'
import styles from './back-link.module.css'

/**
 * The way back to /admin, for the three full-access editors.
 *
 * Without it the only way out is the browser's back gesture, which does
 * not exist in a standalone PWA and is an awkward reach one-handed.
 *
 * NOT ON /admin/door, deliberately. That runs as its own home-screen app
 * and its role cannot open the dashboard at all -- middleware sends a
 * door session straight back to /admin/door. A link that bounces someone
 * to where they already are is worse than no link.
 *
 * It needs no role check of its own for the same reason: a door session
 * never renders these three pages, so the control is only ever seen by
 * someone it works for.
 *
 * Quiet on purpose. It is navigation, not an action, so it sits below the
 * kicker's ember in the visual order -- muted, mono, and smaller than
 * anything it sits above.
 */
export default function BackToDashboard() {
  return (
    <Link href="/admin" className={styles.back}>
      <span aria-hidden="true">←</span> Dashboard
    </Link>
  )
}
