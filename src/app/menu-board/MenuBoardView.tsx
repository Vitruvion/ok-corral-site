import type { DrinkData } from '@/lib/data'
import { orderDrinkCategories } from '@/lib/queries'
import { BOARD_QR_LABEL } from './qr'
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
 * Categories that exist in Supabase and render on the homepage, but are
 * deliberately kept OFF the TV board.
 *
 * This is a display exclusion, not a data change: the drinks stay active in
 * the database and the homepage drinks section is untouched. TO PUT ONE BACK
 * ON THE BOARD, delete it from this list — nothing else. Its position is
 * still recorded in COLUMN_MAP above, so it returns to exactly where it was.
 *
 * The name is intentionally left in COLUMN_MAP rather than quietly deleted
 * from it. Removing it from the map would NOT remove it from the board:
 * unmapped categories fall through to the lightest column, so it would simply
 * reappear somewhere else. The exclusion is therefore checked BEFORE that
 * fallback — see buildColumns.
 */
export const BOARD_EXCLUDED_CATEGORIES: readonly string[] = ['Featured Beer']

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
  const excluded = new Set(BOARD_EXCLUDED_CATEGORIES)

  COLUMN_MAP.forEach((categories, i) => {
    for (const category of categories) {
      if (excluded.has(category)) continue
      if (drinks[category]?.length) columns[i].push(category)
    }
  })

  for (const category of ordered) {
    // Checked BEFORE the lightest-column fallback: otherwise an excluded
    // category would be treated as unmapped and placed back on the board.
    if (excluded.has(category)) continue
    if (mapped.has(category)) continue
    const weights = columns.map(col =>
      col.reduce((total, c) => total + weigh(drinks, c), 0)
    )
    columns[weights.indexOf(Math.min(...weights))].push(category)
  }

  return columns
}

/**
 * Column the QR panel is pinned to the bottom of (0-based). Column 2 holds
 * the two shortest categories, so it's the one with dead space to fill —
 * keep this in step if COLUMN_MAP is rearranged.
 */
const QR_COLUMN = 1

export default function MenuBoardView({
  drinks,
  qrSvg = null,
}: {
  drinks: Record<string, DrinkData[]>
  /** Inline SVG from getBoardQrSvg(), or null — null renders no panel. */
  qrSvg?: string | null
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

          {i === QR_COLUMN && qrSvg && (
            <div className={styles.qrPanel}>
              <span className={styles.qrLead}>Visit our website</span>
              <div
                className={styles.qrCode}
                // Server-generated markup from the qrcode library, not user
                // input — nothing here comes from the database or a request.
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
              <span className={styles.qrUrl}>{BOARD_QR_LABEL}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
