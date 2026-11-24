import { DRINK_TABS, type DrinkData } from './data'

/**
 * THE category order for drinks, shared by the homepage tabs
 * (components/Drinks.tsx) and the TV board (menu-board/MenuBoardView.tsx),
 * so the two never disagree. Client-safe: plain data, one pure function --
 * the homepage component is a client component and cannot import queries.ts.
 *
 * Every category with at least one active drink is included; an empty one
 * never is. DRINK_TABS first, in its curated order. Any other category -- one
 * created at /admin/menu -- follows, in the order it first appears by
 * sort_order: getDrinks() reads drinks by sort_order (then category, which
 * breaks ties), so the keys of the object it returns are already in that
 * order and are kept as they come.
 */
export function orderDrinkCategories(drinks: Record<string, DrinkData[]>): string[] {
  const known = DRINK_TABS.filter(t => drinks[t]?.length)
  const extra = Object.keys(drinks).filter(c => !DRINK_TABS.includes(c) && drinks[c]?.length)
  return [...known, ...extra]
}
