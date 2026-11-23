import { COCKTAIL_SETTING_KEY, parseCocktailSetting, type CocktailSetting } from '@/lib/cocktail-of-month'
import { serviceClient } from './drinks-repo'

/**
 * Admin-side access to the Cocktail of the Month setting (see
 * lib/cocktail-of-month.ts). site_settings has a public READ policy and no
 * public write policy, so writes go through the service role -- this file
 * and /api/admin/cocktail are the only path that changes it.
 */

/** The saved pick, or null when nothing has been saved (the default applies). */
export async function getCocktailSetting(): Promise<CocktailSetting | null> {
  const sb = serviceClient()
  const { data, error } = await sb
    .from('site_settings')
    .select('value')
    .eq('key', COCKTAIL_SETTING_KEY)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return parseCocktailSetting(data?.value)
}

/** Insert or replace the one row. */
export async function saveCocktailSetting(value: CocktailSetting): Promise<void> {
  const sb = serviceClient()
  const { error } = await sb
    .from('site_settings')
    .upsert({ key: COCKTAIL_SETTING_KEY, value }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
}
