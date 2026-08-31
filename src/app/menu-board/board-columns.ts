import type { DrinkData } from '@/lib/data'

/**
 * How the TV board lays categories out, and which ones it leaves off.
 *
 * Lives in its own module rather than inside MenuBoardView so that anything
 * needing to KNOW about the board's layout rules can import them without
 * pulling in the board's rendering. The admin editor at /admin/menu is a
 * client component; importing MenuBoardView there would drag the board's CSS
 * module and, through qr.ts, the whole `qrcode` package into the browser
 * bundle. This file is plain data and one pure function.
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
 *
 * Also read by the admin editor, which labels these categories "website only"
 * so nobody reads "1/1 live" as "on the board" and starts toggling rows off
 * trying to fix a TV that was never going to show them.
 */
export const BOARD_EXCLUDED_CATEGORIES: readonly string[] = ['Featured Beer']

/** Whether a category is deliberately kept off the board. */
export const isBoardExcluded = (category: string) =>
  BOARD_EXCLUDED_CATEGORIES.includes(category)

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
