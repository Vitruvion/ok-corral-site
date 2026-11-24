import { COCKTAIL_CATEGORY } from './cocktail-of-month'
import { isBoardExcluded } from '../app/menu-board/board-columns'

/**
 * Where a drink's short line (`tagline`) and description actually appear,
 * by category -- for the labels and hints in /admin/menu, so nobody fills in
 * a box whose text never reaches a screen.
 *
 * Derived from the same lists the pages render from, never typed separately:
 *
 *   Homepage drinks section (components/Drinks.tsx): one tab for EVERY
 *     category with an active drink (lib/drink-categories.ts), each card
 *     showing the short line AND the description. So for a drink that is on,
 *     both always reach the website, whatever its category.
 *   TV board list rows (menu-board/MenuBoardView.tsx): only the categories
 *     COLUMN_MAP places and does not exclude (isBoardExcluded() is false) --
 *     today Shots & Bombs and Cigars; any other category, including one made
 *     at /admin/menu, is website only. A row shows the short line, or the
 *     description only when the short line is empty.
 *   Cocktail of the Month (lib/cocktail-of-month.ts): the featured Saloon
 *     Cocktail's description, large, under its name on the TV.
 *
 * Nothing else shows either field: no structured data, email or other page
 * reads them. If one of those rules changes, change it here too.
 *
 * Client-safe: plain data and pure functions.
 */

export type FieldHint = {
  /** False when the text shows nowhere: the editor hides the box. */
  shown: boolean
  /** Plain words, for the line under the box. */
  hint: string
}

export function drinkTextHints(category: string): { shortLine: FieldHint; description: FieldHint } {
  const cat = category.trim()
  // Every category with an active drink has a homepage tab, so both fields
  // always reach the website; the TV is what varies by category.
  const onTvList = !isBoardExcluded(cat)
  const isFeature = cat === COCKTAIL_CATEGORY

  const shortLine: FieldHint = onTvList
    ? { shown: true, hint: 'Shows under the name on the TV and the website.' }
    : { shown: true, hint: 'Shows under the name on the website.' }

  const places = ["on the website's drink card"]
  if (isFeature) places.push('under the name on the TV when this drink is the Cocktail of the Month')
  else if (onTvList) places.push('on the TV only if the short line is empty')

  // Always shown today (the website shows every description); the flag stays
  // so the editor hides the box by itself if a display rule ever changes.
  const description: FieldHint = { shown: true, hint: 'Shows ' + places.join(', and ') + '.' }

  return { shortLine, description }
}
