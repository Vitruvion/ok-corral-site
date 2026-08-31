import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isAuthorized } from '@/lib/admin/guard'
import {
  deleteEvent,
  getEvent,
  listEvents,
  serviceClient,
  setFeatured,
  slugExists,
  slugify,
  weekdayFor,
} from '@/lib/admin/events-repo'

/**
 * /api/admin/events — the editor's CRUD surface.
 *
 * Every handler re-checks the cookie rather than trusting middleware,
 * and every payload goes through zod. Client-supplied ids only ever
 * address a row, never decide whether the caller may touch it: the
 * single shared passcode is the whole authorization model.
 *
 * THE DANGEROUS EDITS ARE ENFORCED HERE, not only in the UI. A date
 * change, or a capacity drop below what is already sold, each require
 * an explicit acknowledgement field once a show has sold tickets. A
 * confirmation dialog that exists only in the browser is a suggestion;
 * this is the rule. (Price lives in the sales route, which does the
 * same.)
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const unauthorized = () =>
  NextResponse.json(
    { error: 'Not authorized.' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  )

const bad = (message: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ error: message, ...extra }, { status: 400 })

/**
 * Events render on the homepage and nowhere else, so that is the only
 * path worth revalidating. It is ISR at 60s, which without this would
 * mean up to a minute between saving a show and seeing it.
 */
function revalidatePublic() {
  revalidatePath('/')
}

// Messages are shown verbatim to whoever is holding the phone, so they
// say what to do rather than what the parser expected.
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

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be a real calendar date.')

const RelatedLink = z.object({
  name: z.string().max(120),
  url: z.string().max(500),
  image: z.string().max(500).optional(),
  role: z.string().max(120).optional(),
  skipFirstInDescription: z.boolean().optional(),
})

/** The three a new show cannot do without, plus everything optional. */
const CreateBody = z.object({
  name: required('Name', 200),
  date: DATE,
  time: required('Time', 80),
  support: optionalText(400),
  doors: optionalText(80),
  genre: optionalText(120),
  tickets: optionalText(200),
  description: optionalText(4000),
  tags: z.array(z.string().max(60)).max(12).optional(),
  active: z.boolean().optional(),
  sort_order: z.number().int().min(-999).max(999).optional(),
  youtube_url: optionalText(500),
  signup_url: optionalText(500),
  related_links: z.array(RelatedLink).max(12).nullish(),
})

const UpdateBody = CreateBody.partial().extend({
  id: z.string().uuid('Missing event id.'),
  poster_url: optionalText(700),
  ticket_capacity: z.number().int().positive().nullish(),
  ticket_blurb: optionalText(400),
  // Acknowledgements. Required only when the change is dangerous.
  confirm_date_change: z.boolean().optional(),
  confirm_capacity_below_sold: z.boolean().optional(),
})

export async function GET() {
  if (!isAuthorized()) return unauthorized()
  try {
    return NextResponse.json(
      { events: await listEvents() },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Could not load events.' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!isAuthorized()) return unauthorized()

  let parsed
  try {
    parsed = CreateBody.safeParse(await req.json())
  } catch {
    return bad('Invalid JSON.')
  }
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? 'Invalid request.')

  const body = parsed.data
  const slug = slugify(body.name)
  if (!slug) return bad('That name has no letters or numbers to build a link from.')

  try {
    if (await slugExists(slug)) {
      return NextResponse.json(
        {
          error:
            'Another show already uses the link "' +
            slug +
            '". Change the name slightly so the two can be told apart.',
          slug,
        },
        { status: 409 }
      )
    }

    const weekday = weekdayFor(body.date)
    if (!weekday) return bad('Date must be a real calendar date.')

    const sb = serviceClient()
    const { data, error } = await sb
      .from('events')
      .insert({
        slug,
        name: body.name,
        date: body.date,
        // Derived, never typed. See events-repo.weekdayFor.
        weekday,
        time: body.time,
        support: body.support || null,
        doors: body.doors || null,
        genre: body.genre || null,
        tickets: body.tickets || null,
        description: body.description || null,
        tags: body.tags ?? [],
        active: body.active ?? true,
        sort_order: body.sort_order ?? 0,
        youtube_url: body.youtube_url || null,
        signup_url: body.signup_url || null,
        related_links: body.related_links ?? null,
        // tickets_on_sale and ticket_price are deliberately absent: a
        // new show starts with sales off and no price, and the only way
        // to change that is the sales form, which requires a price.
      })
      .select('id')
      .single()

    if (error) throw new Error(error.message)

    revalidatePublic()
    return NextResponse.json({ id: data.id, slug })
  } catch (err: any) {
    console.error('[/api/admin/events POST]', err)
    return NextResponse.json({ error: err?.message || 'Could not create the show.' }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  if (!isAuthorized()) return unauthorized()

  let parsed
  try {
    parsed = UpdateBody.safeParse(await req.json())
  } catch {
    return bad('Invalid JSON.')
  }
  if (!parsed.success) return bad(parsed.error.issues[0]?.message ?? 'Invalid request.')

  const body = parsed.data

  try {
    const current = await getEvent(body.id)
    if (!current) return NextResponse.json({ error: 'Show not found.' }, { status: 404 })

    const patch: Record<string, unknown> = {}
    const set = (k: string, v: unknown) => {
      if (v !== undefined) patch[k] = v === '' ? null : v
    }

    set('name', body.name)
    set('time', body.time)
    set('support', body.support)
    set('doors', body.doors)
    set('genre', body.genre)
    set('tickets', body.tickets)
    set('description', body.description)
    set('tags', body.tags)
    set('active', body.active)
    set('sort_order', body.sort_order)
    set('youtube_url', body.youtube_url)
    set('signup_url', body.signup_url)
    set('related_links', body.related_links)
    set('poster_url', body.poster_url)
    set('ticket_blurb', body.ticket_blurb)

    // ── Date: people are holding tickets for the old one ─────────
    if (body.date !== undefined && body.date !== current.date) {
      if (current.sold > 0 && body.confirm_date_change !== true) {
        const who = current.sold === 1 ? '1 person is' : current.sold + ' people are'
        return NextResponse.json(
          {
            error:
              who +
              ' holding tickets for ' +
              current.date +
              '. Moving the show does not tell them. Confirm to continue.',
            needs: 'confirm_date_change',
            sold: current.sold,
            from: current.date,
            to: body.date,
          },
          { status: 409 }
        )
      }
      const weekday = weekdayFor(body.date)
      if (!weekday) return bad('Date must be a real calendar date.')
      patch.date = body.date
      // Kept in step automatically; nobody picks a weekday by hand.
      patch.weekday = weekday
    }

    // ── Capacity below what is already sold ──────────────────────
    if (body.ticket_capacity !== undefined) {
      const cap = body.ticket_capacity
      if (cap !== null && cap < current.sold && body.confirm_capacity_below_sold !== true) {
        return NextResponse.json(
          {
            error:
              current.sold +
              ' already admitted, so a capacity of ' +
              cap +
              ' is below what has been sold. Allowed, but confirm.',
            needs: 'confirm_capacity_below_sold',
            sold: current.sold,
            capacity: cap,
          },
          { status: 409 }
        )
      }
      patch.ticket_capacity = cap
    }

    // The slug is NOT recomputed on rename. It is the handle the public
    // event card and the ticket checkout use, and rewriting it would
    // break links already out in the world.

    if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true, unchanged: true })

    const sb = serviceClient()
    const { error } = await sb.from('events').update(patch).eq('id', body.id)
    if (error) throw new Error(error.message)

    revalidatePublic()
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[/api/admin/events PATCH]', err)
    return NextResponse.json({ error: err?.message || 'Could not save the show.' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  if (!isAuthorized()) return unauthorized()

  let id: string
  try {
    const body = await req.json()
    id = z.string().uuid().parse(body?.id)
  } catch {
    return bad('Missing event id.')
  }

  try {
    const outcome = await deleteEvent(id)
    revalidatePublic()
    return NextResponse.json(outcome)
  } catch (err: any) {
    console.error('[/api/admin/events DELETE]', err)
    return NextResponse.json({ error: err?.message || 'Could not remove the show.' }, { status: 500 })
  }
}

/**
 * PUT = the featured swap.
 *
 * Its own operation rather than a field on PATCH, because it is not a
 * property of one row: featuring B unfeatures A, and the two have to
 * move together. Passing id: null clears it.
 */
export async function PUT(req: Request) {
  if (!isAuthorized()) return unauthorized()

  let id: string | null
  try {
    const body = await req.json()
    id = body?.id === null ? null : z.string().uuid().parse(body?.id)
  } catch {
    return bad('Missing event id.')
  }

  try {
    await setFeatured(id)
    revalidatePublic()
    return NextResponse.json({ ok: true, featured: id })
  } catch (err: any) {
    console.error('[/api/admin/events PUT]', err)
    return NextResponse.json(
      { error: err?.message || 'Could not change the featured show.' },
      { status: 500 }
    )
  }
}
