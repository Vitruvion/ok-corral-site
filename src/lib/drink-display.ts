import { DRINK_TABS } from './data'
import { COCKTAIL_CATEGORY } from './cocktail-of-month'
import { isBoardExcluded } from '../app/menu-board/board-columns'

/**
 * Where a drink's short line (`tagline`) and description actually appear,
 * by category -- for the labels and hints in /admin/menu, so nobody fills in
 * a box whose text never reaches a screen.
 *
 * Derived from the same lists the pages render from, never typed separately:
 *
 *   Homepage drinks section (components/Drinks.tsx): one tab per DRINK_TABS
 *     category, each card showing the short line AND the description.
 *     A category not in DRINK_TABS gets no tab, so nothing of it shows.
 *   TV board list rows (menu-board/MenuBoardView.tsx): every category not in
 *     BOARD_EXCLUDED_CATEGORIES; a row shows the short line, or the
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
  const onWebsite = DRINK_TABS.includes(cat)
  const onTvList = !isBoardExcluded(cat)
  const isFeature = cat === COCKTAIL_CATEGORY

  const shortLine: FieldHint =
    onWebsite && onTvList
      ? { shown: true, hint: 'Shows under the name on the TV and the website.' }
      : onWebsite
        ? { shown: true, hint: 'Shows under the name on the website.' }
        : onTvList
          ? { shown: true, hint: 'Shows under the name on the TV. This category has no tab on the website.' }
          : { shown: true, hint: 'Not shown anywhere at the moment.' }

  const places: string[] = []
  if (onWebsite) places.push("on the website's drink card")
  if (isFeature) places.push('under the name on the TV when this drink is the Cocktail of the Month')
  else if (onTvList) places.push('on the TV only if the short line is empty')

  const description: FieldHint = places.length
    ? { shown: true, hint: 'Shows ' + places.join(', and ') + '.' }
    : { shown: false, hint: '' }

  return { shortLine, description }
}
