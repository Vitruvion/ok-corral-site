import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isAuthorized } from '@/lib/admin/guard'
import { DRINK_COLUMNS, listDrinks, nextSortOrder, serviceClient } from '@/lib/admin/drinks-repo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * /api/admin/drinks — the editor's CRUD surface.
 *
 * Every handler re-checks the cookie rather than trusting middleware, and
 * every payload goes through zod. Client-supplied ids are only ever used to
 * address a row, never to decide whether the caller may touch it: the single
 * shared passcode is the whole authorization model, so an id is data, not a
 * capability.
 *
 * Successful writes revalidate '/' and '/menu-board' so the homepage and the
 * TV both pick the change up.
 */

const unauthorized = () =>
  NextResponse.json({ error: 'Not authorized.' }, { status: 401 })

// Messages here are shown verbatim to whoever is holding the phone, so they
// say what to do rather than what the parser expected.
const required = (label: string, max: number) =>
  z
    .string({ error: label + ' is required.' })
    .transform(s => s.trim())
    .pipe(
      z
        .string()
        .min(1, label + ' is required.')
        .max(max, label + ' is too long (max ' + max + ' characters).')
    )

const trimmed = z.string().transform(s => s.trim())
// Blank optional fields are stored as NULL rather than empty string, so the
// site's `{field && ...}` render guards behave predictably.
const optional = (max: number) =>
  trimmed
    .pipe(z.string().max(max, 'Too long (max ' + max + ' characters).'))
    .transform(s => (s === '' ? null : s))

const CreateBody = z.object({
  name: required('Name', 120),
  price: required('Price', 24),
  category: required('Category', 60),
  tagline: optional(160).optional().default(null),
  description: optional(600).optional().default(null),
  active: z.boolean().optional().default(true),
})

const UpdateBody = z.object({
  id: z.string().uuid(),
  name: required('Name', 120).optional(),
  price: required('Price', 24).optional(),
  category: required('Category', 60).optional(),
  tagline: optional(160).optional(),
  description: optional(600).optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(10000).optional(),
})

const DeleteBody = z.object({ id: z.string().uuid() })

function revalidate() {
  revalidatePath('/')
  revalidatePath('/menu-board')
}

function fail(err: unknown) {
  const message = err instanceof Error ? err.message : 'Unexpected error.'
  console.error('[api/admin/drinks]', err)
  return NextResponse.json({ error: message }, { status: 500 })
}

async function readJson(req: Request): Promise<unknown | typeof INVALID> {
  try {
    return await req.json()
  } catch {
    return INVALID
  }
}
const INVALID = Symbol('invalid-json')

// ── GET: every drink, active or not ───────────────────────────────
export async function GET() {
  if (!isAuthorized()) return unauthorized()
  try {
    const drinks = await listDrinks()
    return NextResponse.json({ drinks }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return fail(err)
  }
}

// ── POST: add a drink ─────────────────────────────────────────────
export async function POST(req: Request) {
  if (!isAuthorized()) return unauthorized()

  const body = await readJson(req)
  if (body === INVALID) {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = CreateBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid drink.' },
      { status: 400 }
    )
  }

  try {
    const sb = serviceClient()
    const { data, error } = await sb
      .from('drinks')
      .insert({
        ...parsed.data,
        sort_order: await nextSortOrder(parsed.data.category),
        updated_at: new Date().toISOString(),
      })
      .select(DRINK_COLUMNS)
      .single()
    if (error) throw new Error(error.message)
    revalidate()
    return NextResponse.json({ drink: data }, { status: 201 })
  } catch (err) {
    return fail(err)
  }
}

// ── PATCH: edit one drink ─────────────────────────────────────────
export async function PATCH(req: Request) {
  if (!isAuthorized()) return unauthorized()

  const body = await readJson(req)
  if (body === INVALID) {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = UpdateBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid change.' },
      { status: 400 }
    )
  }

  const { id, ...fields } = parsed.data
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  try {
    const sb = serviceClient()
    const { data, error } = await sb
      .from('drinks')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select(DRINK_COLUMNS)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: 'Drink not found.' }, { status: 404 })
    revalidate()
    return NextResponse.json({ drink: data })
  } catch (err) {
    return fail(err)
  }
}

// ── DELETE: soft delete only ──────────────────────────────────────
export async function DELETE(req: Request) {
  if (!isAuthorized()) return unauthorized()

  const body = await readJson(req)
  if (body === INVALID) {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const parsed = DeleteBody.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 })
  }

  try {
    const sb = serviceClient()
    // Never a hard delete: a seasonal drink that comes back should come back
    // with its history, and a mis-tap behind the bar shouldn't destroy a row.
    const { data, error } = await sb
      .from('drinks')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', parsed.data.id)
      .select(DRINK_COLUMNS)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ error: 'Drink not found.' }, { status: 404 })
    revalidate()
    return NextResponse.json({ drink: data })
  } catch (err) {
    return fail(err)
  }
}
