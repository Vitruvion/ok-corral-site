import type { DrinkData } from '@/lib/data'
import { orderDrinkCategories } from '@/lib/queries'
import styles from './menu-board.module.css'

/**
 * The board itself, given drinks. Split out from page.tsx so the layout can
 * be rendered against a fixture (e.g. to measure a category that isn't in
 * the database yet) without duplicating the markup that ships.
 */

/**
 * Which category goes in which column, top to bottom.
 *
 * Deliberately explicit rather than auto-flowed. Auto-flow only looked right
 * while there were exactly three categories — a fourth wrapped onto a second
 * row underneath Saloon Cocktails. This is the one place to edit when the
 * menu changes shape.
 */
export const COLUMN_MAP: readonly (readonly string[])[] = [
  ['Saloon Cocktails'],
  ['Shots & Bombs', 'Featured Beer'],
  ['Cigars'],
]

/**
 * Rough height weight for a category: its rows, plus a constant for the
 * header and its margin. Only used to pick the emptiest column, so an
 * approximation is fine.
 */
const weigh = (drinks: Record<string, DrinkData[]>, category: string) =>
  (drinks[category]?.length ?? 0) + 3

/**
 * Resolves categories into columns.
 *
 * Mapped categories land where COLUMN_MAP says. Anything unmapped — someone
 * adds a category at /admin/menu and forgets to touch this file — goes to
 * whichever column is currently lightest, so it always appears somewhere
 * instead of silently vanishing off the board.
 */
export function buildColumns(
  drinks: Record<string, DrinkData[]>,
  ordered: string[]
): string[][] {
  const columns: string[][] = Array.from({ length: COLUMN_MAP.length }, () => [])
  const mapped = new Set(COLUMN_MAP.flat())

  COLUMN_MAP.forEach((categories, i) => {
    for (const category of categories) {
      if (drinks[category]?.length) columns[i].push(category)
    }
  })

  for (const category of ordered) {
    if (mapped.has(category)) continue
    const weights = columns.map(col =>
      col.reduce((total, c) => total + weigh(drinks, c), 0)
    )
    columns[weights.indexOf(Math.min(...weights))].push(category)
  }

  return columns
}

export default function MenuBoardView({
  drinks,
}: {
  drinks: Record<string, DrinkData[]>
}) {
  const columns = buildColumns(drinks, orderDrinkCategories(drinks))

  return (
    <div className={styles.columns}>
      {columns.map((categories, i) => (
        <div key={i} className={styles.column}>
          {categories.map(category => (
            <section key={category} className={styles.category}>
              <h2 className={styles.categoryName}>{category}</h2>
              <ul className={styles.items}>
                {drinks[category].map((drink, j) => {
                  const note = drink.tagline || drink.description
                  return (
                    <li
                      key={`${drink.name}-${j}`}
                      className={`${styles.item} ${note ? '' : styles.itemBare}`}
                    >
                      <div className={styles.itemHead}>
                        <span className={styles.itemName}>{drink.name}</span>
                        <span className={styles.leader} aria-hidden="true" />
                        <span className={styles.itemPrice}>{drink.price}</span>
                      </div>
                      {/* Tagline, not description: the paragraph-length
                          description is unreadable at TV distance. Nothing is
                          rendered at all when a drink has neither — cigars
                          are name and price only. */}
                      {note && <p className={styles.itemDesc}>{note}</p>}
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      ))}
    </div>
  )
}
