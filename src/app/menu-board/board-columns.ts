import type { DrinkData } from '@/lib/data'

/**
 * How the TV board lays categories out, and which ones it leaves off.
 *
 * Lives in its own module rather than inside MenuBoardView so that anything
 * needing to KNOW about the board's layout rules can import them without
 * pulling in the board's rendering. The admin editor at /admin/menu is a
 * client component; importing MenuBoardView there would drag the board's CSS
 * module and, through qr.ts, the whole `qrcode` package into the browser
 * bundle. This file is plain data and pure functions.
 */

/**
 * Which category goes in which column, top to bottom -- and THE list of
 * categories the board shows at all.
 *
 * Deliberately explicit rather than auto-flowed. The board cannot scroll and
 * every column is close to full, so nothing lands on it by accident: a
 * category that is not placed here is left off the TV (it still shows on the
 * website). That includes any category created later at /admin/menu -- until
 * November 2026 such a category fell through to the "lightest" column, which
 * was Shots & Bombs plus the QR panel, and one drink pushed that column off
 * the bottom of the board.
 *
 * TO PUT A NEW CATEGORY ON THE TV, give it a column here, deliberately, and
 * re-measure the board at 1920x1080 and 3840x2160 (the overflow guard warns).
 */
export const COLUMN_MAP: readonly (readonly string[])[] = [
  ['Saloon Cocktails'],
  ['Shots & Bombs', 'Featured Beer'],
  ['Cigars'],
]

/**
 * Categories that have a place in COLUMN_MAP but are kept OFF the board.
 *
 * A display exclusion, not a data change: the drinks stay active and the
 * homepage is untouched. TO PUT ONE BACK, delete it from this list -- its
 * position is still recorded in COLUMN_MAP, so it returns to exactly where
 * it was. (Removing a name from COLUMN_MAP also takes it off the board; this
 * list is for "has a place, not shown right now".)
 */
export const BOARD_EXCLUDED_CATEGORIES: readonly string[] = ['Featured Beer', 'Saloon Cocktails']

/**
 * Saloon Cocktails is on the list above because the board no longer LISTS
 * them: column 1 features one of them instead, the Cocktail of the Month
 * (lib/cocktail-of-month.ts), with artwork. When that feature can't be
 * shown -- its drink hidden or deleted -- the board restores the full list
 * through buildColumns' `restore` option, exactly as it looked before, so
 * the column is never empty. The homepage lists every cocktail regardless.
 */
export const FEATURE_REPLACES = 'Saloon Cocktails'
/** The column the feature occupies (Saloon Cocktails' own column). */
export const FEATURE_COLUMN = 0

const MAPPED = new Set(COLUMN_MAP.flat())

/**
 * Whether a category is kept off the board: excluded above, or given no
 * column at all. The admin editor labels these "website only" and its hints
 * leave the TV out (lib/drink-display.ts), so nobody reads "1/1 live" as
 * "on the TV" and starts toggling rows trying to fix a board that was never
 * going to show them.
 */
export const isBoardExcluded = (category: string) =>
  BOARD_EXCLUDED_CATEGORIES.includes(category) || !MAPPED.has(category)

/**
 * The categories in each column, in COLUMN_MAP order: only mapped, not
 * excluded, and with at least one active drink. Nothing else is placed --
 * there is no fallback column.
 */
export function buildColumns(
  drinks: Record<string, DrinkData[]>,
  {
    restore = [],
  }: {
    /** Excluded categories to put back for this render (the feature fallback). */
    restore?: readonly string[]
  } = {}
): string[][] {
  const excluded = new Set(BOARD_EXCLUDED_CATEGORIES.filter(c => !restore.includes(c)))
  return COLUMN_MAP.map(categories =>
    categories.filter(category => !excluded.has(category) && drinks[category]?.length)
  )
}
