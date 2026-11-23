/**
 * The Cocktail of the Month: the one cocktail the TV board (/menu-board)
 * features in its first column, with artwork, instead of listing every
 * Saloon Cocktail.
 *
 * WHERE IT LIVES. One row in `site_settings` (key text, value jsonb -- the
 * table already existed, so no migration):
 *
 *   key   = 'cocktail_of_month'
 *   value = { "drink_id": "<drinks.id>", "art_url": "<public URL>" | null }
 *
 * The drink itself is an ordinary `drinks` row, so its name, price and
 * description are edited at /admin/menu like any other drink. Only the
 * pick and the artwork live here. Written only by /api/admin/cocktail
 * (service role); read publicly by the board.
 *
 * WITH NO ROW AT ALL, the board features DEFAULT_COCKTAIL below. That
 * default is a fallback in code, never written to the database.
 *
 * WHEN THE PICK CAN'T BE SHOWN -- the drink is hidden, deleted, or no
 * longer in Saloon Cocktails -- the board falls back to listing every
 * Saloon Cocktail exactly as it did before this feature, so the column is
 * never empty.
 *
 * Client-safe: plain data and pure functions. The server read is
 * getCocktailOfMonth() in lib/queries.ts.
 */

export const COCKTAIL_SETTING_KEY = 'cocktail_of_month'

/** The category the feature is chosen from, and replaces on the board. */
export const COCKTAIL_CATEGORY = 'Saloon Cocktails'

export type ArtImage = { src: string; w: number; h: number }

export const DEFAULT_COCKTAIL = {
  /** Matched by exact name, since there is no saved drink_id to go on. */
  name: 'Damn Good Old Fashioned',
  /** Bundled with the site. Same pixels as the .png master beside it. */
  art: { src: '/assets/menu-board/old-fashioned-black.webp', w: 1254, h: 1254 } as ArtImage,
  /** Used only when the drink's own description is empty. */
  description:
    'Buffalo Trace bourbon stirred with sugar and bitters, poured over one big rock and finished with an orange twist and a cherry.',
} as const

export type CocktailSetting = { drink_id: string; art_url: string | null }

/**
 * A stored value, or null when it is missing or not the expected shape.
 * Tolerant on purpose: a hand-edited row must degrade to the default, not
 * take the board down.
 */
export function parseCocktailSetting(value: unknown): CocktailSetting | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.drink_id !== 'string' || !v.drink_id) return null
  return { drink_id: v.drink_id, art_url: typeof v.art_url === 'string' && v.art_url ? v.art_url : null }
}

/**
 * The artwork URL for a pick: the uploaded one, else the bundled art --
 * but the bundled art only for the drink it actually depicts, so a
 * different cocktail never shows a picture of an Old Fashioned.
 */
export function artUrlFor(drinkName: string, artUrl: string | null): string | null {
  if (artUrl) return artUrl
  return drinkName === DEFAULT_COCKTAIL.name ? DEFAULT_COCKTAIL.art.src : null
}

/** What the board renders in the feature column. */
export type CocktailFeature = {
  name: string
  price: string
  description: string
  /** Null when the pick has no artwork: the text is shown on its own. */
  art: ArtImage | null
}
