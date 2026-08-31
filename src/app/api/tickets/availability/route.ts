import { NextRequest, NextResponse } from 'next/server'
import { getTicketableEvent, MAX_TICKETS_PER_ORDER } from '@/lib/tickets/repo'
import { getOccupancy } from '@/lib/tickets/occupancy'

/**
 * GET /api/tickets/availability?event=<slug|uuid>
 *
 * How many tickets are left, read live.
 *
 * This is a separate endpoint rather than a field on the event because
 * the homepage is served through ISR (revalidate=60) and availability
 * changes with every purchase. Baking "12 left" into a cached page would
 * cheerfully sell a show that sold out fifty seconds ago.
 *
 * Deliberately thin: on-sale state, price, and how many remain. No order
 * data, no codes, nothing about who bought what. It is a public endpoint
 * and it is treated as one.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export type Availability = {
  on_sale: boolean
  price: number | null
  /** Null means unlimited. */
  remaining: number | null
  sold_out: boolean
  /** Most this browser may buy right now: the per-order cap, or what's left. */
  max_per_order: number
  blurb: string | null
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('event')?.trim()
  if (!key || key.length > 200) {
    return NextResponse.json({ error: 'Missing event.' }, { status: 400 })
  }

  try {
    const event = await getTicketableEvent(key)
    if (!event) return NextResponse.json({ error: 'Event not found.' }, { status: 404 })

    const price = event.ticket_price
    const onSale = event.tickets_on_sale && price !== null && price > 0

    if (!onSale) {
      const off: Availability = {
        on_sale: false,
        price: null,
        remaining: null,
        sold_out: false,
        max_per_order: 0,
        blurb: null,
      }
      return NextResponse.json(off, { headers: { 'Cache-Control': 'no-store' } })
    }

    // Shared count: online tickets plus door admissions.
    const occupancy = await getOccupancy(event.id, event.ticket_capacity)
    // Clamped at zero for the PUBLIC payload: an oversold show is the
    // bar's business, and "-3 left" on the storefront helps nobody.
    const remaining = occupancy.remaining === null ? null : Math.max(0, occupancy.remaining)

    const body: Availability = {
      on_sale: true,
      price,
      remaining,
      sold_out: occupancy.soldOut,
      max_per_order:
        remaining === null ? MAX_TICKETS_PER_ORDER : Math.min(MAX_TICKETS_PER_ORDER, remaining),
      blurb: event.ticket_blurb,
    }

    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err: any) {
    console.error('[/api/tickets/availability] error', err)
    return NextResponse.json({ error: 'Could not read availability.' }, { status: 500 })
  }
}
