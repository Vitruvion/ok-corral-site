import { getServiceSupabase } from '@/lib/supabase'

/**
 * Admin-side drinks access.
 *
 * Separate from the public getDrinks() on purpose: the editor needs ids,
 * inactive rows and sort_order, none of which the storefront should ever
 * receive. Writes go through the service-role client, which bypasses RLS —
 * the drinks table has a public READ policy and no public write policy, so
 * this is the only path that can modify it.
 */

export type AdminDrink = {
  id: string
  category: string
  name: string
  tagline: string | null
  price: string
  description: string | null
  active: boolean
  sort_order: number
  updated_at: string | null
}

export const DRINK_COLUMNS =
  'id, category, name, tagline, price, description, active, sort_order, updated_at'

export function serviceClient() {
  const sb = getServiceSupabase()
  if (!sb) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return sb
}

/** Every drink, active or not, in the editor's display order. */
export async function listDrinks(): Promise<AdminDrink[]> {
  const sb = serviceClient()
  const { data, error } = await sb
    .from('drinks')
    .select(DRINK_COLUMNS)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as AdminDrink[]
}

/** Next free slot at the bottom of a category. */
export async function nextSortOrder(category: string): Promise<number> {
  const sb = serviceClient()
  const { data, error } = await sb
    .from('drinks')
    .select('sort_order')
    .eq('category', category)
    .order('sort_order', { ascending: false })
    .limit(1)
  if (error) throw new Error(error.message)
  const top = data?.[0]?.sort_order
  return typeof top === 'number' ? top + 1 : 1
}
