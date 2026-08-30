import type { Metadata } from 'next'
import { getDrinks } from '@/lib/queries'
import { getBoardQrSvg } from './qr'
import MenuBoardView from './MenuBoardView'
import RefreshLoop from './RefreshLoop'
import styles from './menu-board.module.css'

/**
 * /menu-board — the TV display.
 *
 * Built for a 3840x2160 panel read from across the room: one viewport, no
 * scroll, everything sized in vw so it scales to whatever screen is bolted to
 * the wall. Renders outside the site chrome by simply not using ClientShell,
 * which is where Topbar/Footer/ProgressRail/CartDrawer actually live.
 *
 * Column placement lives in MenuBoardView (COLUMN_MAP).
 */

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Menu Board — The OK Corral',
  robots: { index: false, follow: false },
}

export default async function MenuBoardPage() {
  // Both resolved server-side; the QR is inlined into the HTML so the panel
  // needs no network of its own.
  const [drinks, qrSvg] = await Promise.all([getDrinks(), getBoardQrSvg()])

  return (
    <main className={styles.board}>
      <RefreshLoop />

      <header className={styles.header}>
        <span className={styles.markThe}>The</span>
        <span className={styles.markName}>O.K. Corral</span>
      </header>

      <MenuBoardView drinks={drinks} qrSvg={qrSvg} />
    </main>
  )
}
