import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isAdmin } from '@/lib/admin/guard'
import { getEvent, serviceClient } from '@/lib/admin/events-repo'

/**
 * /api/admin/events/sales — switching ticket sales on and off.
 *
 * A SEPARATE ROUTE BECAUSE IT IS NOT A TOGGLE. tickets_on_sale and
 * ticket_price are one decision, not two fields: on-sale with a null
 * price renders a purchase widget on the public site with nothing to
 * charge. So there is no code path here that can set tickets_on_sale
 * true without a price in the same statement -- the price is required
 * by the schema below, not merely expected by the form.
 *
 * Switching OFF is a single call, but if tickets have been sold it
 * needs an acknowledgement carrying the count, so it cannot be done
 * absentmindedly from a list.
 *
 * Changing the PRICE affects only future buyers. Nobody is refunded or
 * charged the difference, so a change on a show with sales already made
 * requires confirmation too.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const unauthorized = () =>
  NextResponse.json(
    { error: 'Not authorized.' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  )

const On = z.object({
  id: z.string().uuid('Missing event id.'),
  on: z.literal(true),
  // Required, and > 0. This is the whole point of the route.
  price: z
    .number({ error: 'Enter a ticket price.' })
    .positive('Ticket price must be more than zero.')
    .max(10000, 'That price looks wrong.'),
  // Blank means unlimited.
  capacity: z.number().int().positive('Capacity must be at least 1.').nullish(),
  blurb: z.string().max(400).transform(s => s.trim()).nullish(),
  confirm_price_change: z.boolean().optional(),
  confirm_capacity_below_sold: z.boolean().optional(),
})

const Off = z.object({
  id: z.string().uuid('Missing event id.'),
  on: z.literal(false),
  confirm_stop_with_sales: z.boolean().optional(),
})

const Body = z.discriminatedUnion('on', [On, Off])

export async function POST(req: Request) {
  if (!isAdmin()) return unauthorized()

  let parsed
  try {
    parsed = Body.safeParse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request.' },
      { status: 400 }
    )
  }

  const body = parsed.data

  try {
    const current = await getEvent(body.id)
    if (!current) return NextResponse.json({ error: 'Show not found.' }, { status: 404 })

    const sb = serviceClient()

    // ── Off ───────────────────────────────────────────────────
    if (body.on === false) {
      if (current.sold > 0 && body.confirm_stop_with_sales !== true) {
        const who = current.sold === 1 ? '1 ticket has' : current.sold + ' tickets have'
        return NextResponse.json(
          {
            error:
              who +
              ' already been sold for this show. Stopping sales does not cancel them. Confirm to continue.',
            needs: 'confirm_stop_with_sales',
            sold: current.sold,
          },
          { status: 409 }
        )
      }

      // The price is left in place. It is a record of what was charged,
      // and clearing it would make the tickets already sold unreadable.
      const { error } = await sb
        .from('events')
        .update({ tickets_on_sale: false })
        .eq('id', body.id)
      if (error) throw new Error(error.message)

      revalidatePath('/')
      return NextResponse.json({ ok: true, tickets_on_sale: false })
    }

    // ── On ────────────────────────────────────────────────────
    const priceChanged =
      current.ticket_price !== null && Math.abs(current.ticket_price - body.price) > 0.0001

    if (priceChanged && current.sold > 0 && body.confirm_price_change !== true) {
      return NextResponse.json(
        {
          error:
            'Changing the price affects future buyers only. The ' +
            current.sold +
            ' already sold are not refunded or charged the difference. Confirm to continue.',
          needs: 'confirm_price_change',
          sold: current.sold,
          from: current.ticket_price,
          to: body.price,
        },
        { status: 409 }
      )
    }

    const capacity = body.capacity ?? null
    if (capacity !== null && capacity < current.sold && body.confirm_capacity_below_sold !== true) {
      return NextResponse.json(
        {
          error:
            current.sold +
            ' already admitted, so a capacity of ' +
            capacity +
            ' is below what has been sold. Allowed, but confirm.',
          needs: 'confirm_capacity_below_sold',
          sold: current.sold,
          capacity,
        },
        { status: 409 }
      )
    }

    // One statement. There is no window in which the row is on sale
    // without a price.
    const { error } = await sb
      .from('events')
      .update({
        tickets_on_sale: true,
        ticket_price: body.price,
        ticket_capacity: capacity,
        ticket_blurb: body.blurb || null,
      })
      .eq('id', body.id)

    if (error) throw new Error(error.message)

    revalidatePath('/')
    return NextResponse.json({
      ok: true,
      tickets_on_sale: true,
      price: body.price,
      capacity,
    })
  } catch (err: any) {
    console.error('[/api/admin/events/sales]', err)
    return NextResponse.json({ error: err?.message || 'Could not update ticket sales.' }, { status: 500 })
  }
}
