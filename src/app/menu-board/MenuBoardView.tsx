import type { DrinkData } from '@/lib/data'
import { orderDrinkCategories } from '@/lib/queries'
// Column placement and the board-only exclusion list live in their own
// module so /admin/menu can read them without importing this component.
import { buildColumns, FEATURE_COLUMN, FEATURE_REPLACES } from './board-columns'
import { boardFeatureName, type CocktailFeature } from '@/lib/cocktail-of-month'
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
  feature = null,
}: {
  drinks: Record<string, DrinkData[]>
  /** Inline SVG from getBoardQrSvg(), or null — null renders no panel. */
  qrSvg?: string | null
  /**
   * The Cocktail of the Month from getCocktailOfMonth(). Null when it can't
   * be shown: column 1 then lists every Saloon Cocktail, as before.
   */
  feature?: CocktailFeature | null
}) {
  const columns = buildColumns(
    drinks,
    orderDrinkCategories(drinks),
    feature ? { reserved: FEATURE_COLUMN } : { restore: [FEATURE_REPLACES] }
  )

  return (
    // No trailing space in the fallback: its markup is the old board's, byte for byte.
    <div className={feature ? `${styles.columns} ${styles.columnsFeature}` : styles.columns}>
      {columns.map((categories, i) => (
        // data-board-* hooks are read by OverflowGuard. They're plain
        // attributes rather than class names on purpose: CSS module classes
        // are hashed, so matching on them would break the moment the build
        // hashes differently.
        <div key={i} className={styles.column} data-board-column={i}>
          {i === FEATURE_COLUMN && feature && <Feature feature={feature} />}

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

/**
 * Column 1 when there is a Cocktail of the Month: label, artwork, name,
 * description, price, stacked and centred. The artwork takes whatever
 * height the text leaves (it is the star of the board), so a longer
 * description shrinks the picture rather than pushing anything off the
 * bottom -- the board clips silently.
 */
function Feature({ feature }: { feature: CocktailFeature }) {
  return (
    <section
      className={feature.art ? styles.feature : `${styles.feature} ${styles.featureNoArt}`}
      data-board-category="Cocktail of the Month"
    >
      <span className={styles.featureLabel}>Cocktail of the Month</span>
      {feature.art && (
        <div className={styles.featureArt}>
          {/* A plain <img>: next/image would re-encode the artwork, and it
              must be shown as supplied. Its real size is on the tag, so the
              box exists before the bytes arrive and nothing moves. The art is
              drawn on pure black, which mix-blend-mode: lighten turns into
              the board's own background -- no square shows around it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.featureImg}
            src={feature.art.src}
            width={feature.art.w}
            height={feature.art.h}
            alt=""
            decoding="async"
          />
        </div>
      )}
      {/* data-board-item keeps the stored name (OverflowGuard reports it);
          only the visible text keeps its last two words together. */}
      <h2 className={styles.featureName} data-board-item={feature.name}>
        {boardFeatureName(feature.name)}
      </h2>
      {feature.description && <p className={styles.featureDesc}>{feature.description}</p>}
      <span className={styles.featurePrice}>{feature.price}</span>
    </section>
  )
}
