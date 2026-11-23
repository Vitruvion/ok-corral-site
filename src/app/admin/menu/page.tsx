import type { Metadata } from 'next'
import { listDrinks, type AdminDrink } from '@/lib/admin/drinks-repo'
import { getCocktailSetting } from '@/lib/admin/cocktail-repo'
import { COCKTAIL_CATEGORY, DEFAULT_COCKTAIL, type CocktailSetting } from '@/lib/cocktail-of-month'
import CocktailCard from './CocktailCard'
import { requireAdminPage } from '@/lib/admin/guard'
import BackToDashboard from '../BackToDashboard'
import MenuEditor from './MenuEditor'
import styles from './menu.module.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Menu editor — OK Corral',
  robots: { index: false, follow: false },
}

export default async function AdminMenuPage() {
  // Middleware already gates this, but the page checks too — same reasoning
  // as the API routes.
  requireAdminPage('/admin/menu')

  let drinks: AdminDrink[]
  let loadError: string | null = null
  let cocktailError: string | null = null
  // Loaded separately: a problem with the Cocktail of the Month setting must
  // not take the whole drinks editor down with it.
  const [drinksResult, savedResult] = await Promise.allSettled([listDrinks(), getCocktailSetting()])
  if (drinksResult.status === 'fulfilled') drinks = drinksResult.value
  else {
    drinks = []
    loadError = drinksResult.reason instanceof Error ? drinksResult.reason.message : 'Could not load drinks.'
  }
  const saved: CocktailSetting | null = savedResult.status === 'fulfilled' ? savedResult.value : null
  if (savedResult.status === 'rejected') {
    cocktailError =
      'Could not load the Cocktail of the Month: ' +
      (savedResult.reason instanceof Error ? savedResult.reason.message : 'unknown error')
  }

  // The drink the board features right now, by the same rules as
  // getCocktailOfMonth(): the saved pick, else the default by name -- and
  // only while it is a live Saloon Cocktail.
  const featured = drinks.find(d =>
    (saved ? d.id === saved.drink_id : d.name === DEFAULT_COCKTAIL.name) &&
    d.active &&
    d.category === COCKTAIL_CATEGORY
  )

  return (
    <main className={styles.page}>
      <BackToDashboard />

      <header className={styles.head}>
        <div>
          <span className={styles.kicker}>◆ Menu Editor</span>
          <h1 className={styles.title}>The Bar</h1>
        </div>
      </header>

      {loadError && <p className={styles.loadError}>{loadError}</p>}

      {cocktailError && <p className={styles.loadError}>{cocktailError}</p>}
      {!loadError && !cocktailError && <CocktailCard drinks={drinks} saved={saved} />}

      <MenuEditor initialDrinks={drinks} featuredId={featured?.id ?? null} />
    </main>
  )
}
