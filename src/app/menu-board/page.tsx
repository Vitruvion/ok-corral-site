import type { Metadata } from 'next'
import { getCocktailOfMonth, getDrinks } from '@/lib/queries'
import { getBoardQrSvg } from './qr'
import MenuBoardView from './MenuBoardView'
import OverflowGuard from './OverflowGuard'
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
 * Column placement and the board-only exclusion list live in
 * ./board-columns (COLUMN_MAP, BOARD_EXCLUDED_CATEGORIES). Column 1 is the
 * Cocktail of the Month (lib/cocktail-of-month.ts), or the full Saloon
 * Cocktails list when that can't be shown.
 */

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Menu Board — The OK Corral',
  robots: { index: false, follow: false },
}

export default async function MenuBoardPage() {
  // All resolved server-side; the QR is inlined into the HTML so the panel
  // needs no network of its own. A failed query throws, so ISR keeps the
  // last good board.
  const [drinks, qrSvg, feature] = await Promise.all([
    getDrinks(),
    getBoardQrSvg(),
    getCocktailOfMonth(),
  ])

  return (
    // data-board marks the element OverflowGuard measures the floor against.
    <main className={styles.board} data-board>
      <RefreshLoop />
      <OverflowGuard />

      <header className={styles.header}>
        <span className={styles.markThe}>The</span>
        <span className={styles.markName}>O.K. Corral</span>
      </header>

      <MenuBoardView drinks={drinks} qrSvg={qrSvg} feature={feature} />
    </main>
  )
}
