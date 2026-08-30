import type { Metadata } from 'next'
import { getDrinks, orderDrinkCategories } from '@/lib/queries'
import RefreshLoop from './RefreshLoop'
import styles from './menu-board.module.css'

/**
 * /menu-board — the TV display.
 *
 * Built for a 3840x2160 panel read from across the room: one viewport, no
 * scroll, everything sized in vw so it scales to whatever screen is bolted to
 * the wall. Renders outside the site chrome by simply not using ClientShell,
 * which is where Topbar/Footer/ProgressRail/CartDrawer actually live.
 */

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Menu Board — The OK Corral',
  robots: { index: false, follow: false },
}

export default async function MenuBoardPage() {
  const drinks = await getDrinks()
  const categories = orderDrinkCategories(drinks)

  return (
    <main className={styles.board}>
      <RefreshLoop />

      <header className={styles.header}>
        <span className={styles.markThe}>The</span>
        <span className={styles.markName}>O.K. Corral</span>
      </header>

      <div className={styles.columns}>
        {categories.map(category => (
          <section key={category} className={styles.category}>
            <h2 className={styles.categoryName}>{category}</h2>
            <ul className={styles.items}>
              {drinks[category].map((drink, i) => (
                <li key={`${drink.name}-${i}`} className={styles.item}>
                  <div className={styles.itemHead}>
                    <span className={styles.itemName}>{drink.name}</span>
                    <span className={styles.leader} aria-hidden="true" />
                    <span className={styles.itemPrice}>{drink.price}</span>
                  </div>
                  {/* Tagline, not description: the paragraph-length description
                      is unreadable at TV distance and tall enough to push a
                      category across a column break. Falls back to the
                      description when a drink has no tagline. */}
                  {(drink.tagline || drink.description) && (
                    <p className={styles.itemDesc}>
                      {drink.tagline || drink.description}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
