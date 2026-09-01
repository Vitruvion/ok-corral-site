import type { Metadata } from 'next'
import { listDrinks, type AdminDrink } from '@/lib/admin/drinks-repo'
import { requireAdminPage } from '@/lib/admin/guard'
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
  try {
    drinks = await listDrinks()
  } catch (err) {
    drinks = []
    loadError = err instanceof Error ? err.message : 'Could not load drinks.'
  }

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <div>
          <span className={styles.kicker}>◆ Menu Editor</span>
          <h1 className={styles.title}>The Bar</h1>
        </div>
      </header>

      {loadError && <p className={styles.loadError}>{loadError}</p>}

      <MenuEditor initialDrinks={drinks} />
    </main>
  )
}
