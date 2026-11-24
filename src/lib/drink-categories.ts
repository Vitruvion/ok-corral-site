import { DRINK_TABS, type DrinkData } from './data'

/**
 * THE order of the homepage drink tabs (components/Drinks.tsx). Client-safe:
 * plain data, one pure function -- the homepage component is a client
 * component and cannot import queries.ts. (The TV board does not use this:
 * it shows only what menu-board/board-columns.ts places, in its own order.)
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
