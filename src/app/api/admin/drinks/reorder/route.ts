import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isAdmin } from '@/lib/admin/guard'
import { serviceClient } from '@/lib/admin/drinks-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Swaps a drink's sort_order with its neighbour — what the up/down buttons
 * call.
 *
 * Server-side in one request so the two rows stay consistent; two separate
 * PATCHes from a phone on bar wifi could half-apply and leave a duplicate or
 * a gap in the ordering.
 */
const Body = z.object({
  id: z.string().uuid(),
  direction: z.enum(['up', 'down']),
})

export async function POST(req: Request) {
  if (!isAdmin()) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = Body.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const { id, direction } = parsed.data
  const up = direction === 'up'

  try {
    const sb = serviceClient()

    const { data: row, error: rowErr } = await sb
      .from('drinks')
      .select('id, category, sort_order')
      .eq('id', id)
      .maybeSingle()
    if (rowErr) throw new Error(rowErr.message)
    if (!row) return NextResponse.json({ error: 'Drink not found.' }, { status: 404 })

    // Nearest neighbour in the same category, in the chosen direction.
    let q = sb
      .from('drinks')
      .select('id, sort_order')
      .eq('category', row.category)
      .order('sort_order', { ascending: !up })
      .limit(1)
    q = up
      ? q.lt('sort_order', row.sort_order)
      : q.gt('sort_order', row.sort_order)

    const { data: neighbours, error: nErr } = await q
    if (nErr) throw new Error(nErr.message)

    const neighbour = neighbours?.[0]
    // Already at the end of its category — a no-op, not an error.
    if (!neighbour) return NextResponse.json({ ok: true, moved: false })

    const stamp = new Date().toISOString()
    const a = await sb
      .from('drinks')
      .update({ sort_order: neighbour.sort_order, updated_at: stamp })
      .eq('id', row.id)
    if (a.error) throw new Error(a.error.message)

    const b = await sb
      .from('drinks')
      .update({ sort_order: row.sort_order, updated_at: stamp })
      .eq('id', neighbour.id)
    if (b.error) throw new Error(b.error.message)

    revalidatePath('/')
    revalidatePath('/menu-board')
    return NextResponse.json({ ok: true, moved: true })
  } catch (err) {
    console.error('[api/admin/drinks/reorder]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error.' },
      { status: 500 }
    )
  }
}
