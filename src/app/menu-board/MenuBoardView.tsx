import type { DrinkData } from '@/lib/data'
import { orderDrinkCategories } from '@/lib/queries'
// Column placement and the board-only exclusion list live in their own
// module so /admin/menu can read them without importing this component.
import { buildColumns } from './board-columns'
import { BOARD_QR_LABEL } from './qr'
import styles from './menu-board.module.css'

/**
 * The board itself, given drinks. Split out from page.tsx so the layout can
 * be rendered against a fixture (e.g. to measure a category that isn't in
 * the database yet) without duplicating the markup that ships.
 */

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
        // data-board-* hooks are read by OverflowGuard. They're plain
        // attributes rather than class names on purpose: CSS module classes
        // are hashed, so matching on them would break the moment the build
        // hashes differently.
        <div key={i} className={styles.column} data-board-column={i}>
          {categories.map(category => (
            <section
              key={category}
              className={styles.category}
              data-board-category={category}
            >
              <h2 className={styles.categoryName}>{category}</h2>
              <ul className={styles.items}>
                {drinks[category].map((drink, j) => {
                  const note = drink.tagline || drink.description
                  return (
                    <li
                      key={`${drink.name}-${j}`}
                      className={`${styles.item} ${note ? '' : styles.itemBare}`}
                      data-board-item={drink.name}
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
