import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isAdmin } from '@/lib/admin/guard'
import { serviceClient } from '@/lib/admin/events-repo'
import { deleteRecurring, getRecurring, listRecurring } from '@/lib/admin/recurring-repo'
import { DAY_ABBRS, HHMM, formatWeeklyTime, type WeeklyTime } from '@/lib/recurring'

/**
 * /api/admin/recurring — the weekly specials ("Every week" in the
 * events editor).
 *
 * Same contract as /api/admin/events: the cookie AND the admin role are
 * re-checked here rather than trusted from middleware, every payload
 * goes through zod, and messages are written for whoever is holding the
 * phone.
 *
 * NO TICKETS, BY CONSTRUCTION. recurring_events has no sales columns and
 * this route accepts none. There is no confirm-before-saving step either:
 * those exist on shows because someone may hold a ticket for the old
 * date. Nobody holds anything for a weekly special.
 *
 * THE TIME IS BUILT HERE, not typed. The client sends the parts (a
 * start, an optional end or "til late", or all day) and this route
 * writes the display string, so every row is in the one grammar
 * src/lib/recurring.ts can read back.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const unauthorized = () =>
  NextResponse.json(
    { error: 'Not authorized.' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  )

const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 })

/**
 * The homepage "Every Week" strip is the only thing that renders these.
 * It is ISR at 60s; without this a save would take up to a minute to show.
 */
function revalidatePublic() {
  revalidatePath('/')
}

const required = (label: string, max: number) =>
  z
    .string({ error: label + ' is required.' })
    .transform(s => s.trim())
    .pipe(
      z
        .string()
        .min(1, label + ' is required.')
        .max(max, label + ' is too long (max ' + max + ').')
    )

const optionalText = (max: number) =>
  z.string().max(max).transform(s => s.trim()).nullish()

const TimeParts = z.object({
  all_day: z.boolean(),
  start: z.string().regex(HHMM, 'Start time is not a time.').nullish(),
  end: z.string().regex(HHMM, 'End time is not a time.').nullish(),
  til_late: z.boolean().optional(),
})

/** The display string for the parts, or the message to show instead. */
function timeText(t: z.infer<typeof TimeParts>): { text: string } | { error: string } {
  if (t.all_day) return { text: formatWeeklyTime({ allDay: true }) }
  if (!t.start) return { error: 'Start time is required.' }
  if (t.end && t.til_late) return { error: 'Pick an end time or "til late", not both.' }
  if (t.end && t.end === t.start) return { error: 'The end time is the same as the start.' }
  const parts: WeeklyTime = { allDay: false, start: t.start, end: t.end ?? null, late: t.til_late === true }
  return { text: formatWeeklyTime(parts) }
}

/** The three a new weekly special cannot do without, plus the optional rest. */
const CreateBody = z.object({
  name: required('Name', 200),
  day: z.enum(DAY_ABBRS, { error: 'Pick a day of the week.' }),
  time: TimeParts,
  support: optionalText(400),
  tickets: optionalText(200),
  active: z.boolean().optional(),
  sort_order: z.number().int().min(-999).max(999).optional(),
})

const UpdateBody = CreateBody.partial().extend({
  id: z.string().uuid('Missing weekly event id.'),
})

export async function GET() {
  if (!isAdmin()) return unauthorized()
  try {
    return NextResponse.json(
      { recurring: await listRecurring() },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Could not load weekly events.' },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  if (!isAdmin()) return unauthorized()

  let parsed
  try {
    parsed = CreateBody.safeParse(await req.json())
  } catch {
    return bad('Invalid JSON.')
  }
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? 'Invalid request.')

  const body = parsed.data
  const time = timeText(body.time)
  if ('error' in time) return bad(time.error)

  try {
    const sb = serviceClient()
    const { data, error } = await sb
      .from('recurring_events')
      .insert({
        name: body.name,
        day_abbr: body.day,
        time: time.text,
        support: body.support || null,
        tickets: body.tickets || null,
        active: body.active ?? true,
        sort_order: body.sort_order ?? 0,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)

    revalidatePublic()
    return NextResponse.json({ id: data.id })
  } catch (err: any) {
    console.error('[/api/admin/recurring POST]', err)
    return NextResponse.json(
      { error: err?.message || 'Could not create the weekly event.' },
      { status: 500 }
    )
  }
}

export async function PATCH(req: Request) {
  if (!isAdmin()) return unauthorized()

  let parsed
  try {
    parsed = UpdateBody.safeParse(await req.json())
  } catch {
    return bad('Invalid JSON.')
  }
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? 'Invalid request.')

  const body = parsed.data

  try {
    const current = await getRecurring(body.id)
    if (!current) return NextResponse.json({ error: 'Weekly event not found.' }, { status: 404 })

    const patch: Record<string, unknown> = {}
    const set = (k: string, v: unknown) => {
      if (v !== undefined) patch[k] = v === '' ? null : v
    }

    set('name', body.name)
    set('day_abbr', body.day)
    set('support', body.support)
    set('tickets', body.tickets)
    set('active', body.active)
    set('sort_order', body.sort_order)

    if (body.time !== undefined) {
      const time = timeText(body.time)
      if ('error' in time) return bad(time.error)
      patch.time = time.text
    }

    if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true, unchanged: true })

    const sb = serviceClient()
    const { error } = await sb.from('recurring_events').update(patch).eq('id', body.id)
    if (error) throw new Error(error.message)

    revalidatePublic()
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[/api/admin/recurring PATCH]', err)
    return NextResponse.json(
      { error: err?.message || 'Could not save the weekly event.' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: Request) {
  if (!isAdmin()) return unauthorized()

  let id: string
  try {
    const body = await req.json()
    id = z.string().uuid().parse(body?.id)
  } catch {
    return bad('Missing weekly event id.')
  }

  try {
    const current = await getRecurring(id)
    if (!current) return NextResponse.json({ error: 'Weekly event not found.' }, { status: 404 })
    const outcome = await deleteRecurring(id)
    revalidatePublic()
    return NextResponse.json({ mode: 'removed', ...outcome })
  } catch (err: any) {
    console.error('[/api/admin/recurring DELETE]', err)
    return NextResponse.json(
      { error: err?.message || 'Could not delete the weekly event.' },
      { status: 500 }
    )
  }
}
