import { NextRequest, NextResponse } from 'next/server'
import { isAuthorized } from '@/lib/admin/guard'
import {
  DoorSaleBodySchema,
  DoorSaleError,
  MAX_SALE_BATCH,
  recordDoorSale,
} from '@/lib/tickets/door-sale'

/**
 * POST /api/admin/door/sale — record a sale taken at the door.
 *
 * Takes one sale or a batch, because the offline queue flushes as a
 * batch.
 *
 * THERE IS NO PRICE IN THE REQUEST SHAPE. The body says which event,
 * how many people and how it was paid; the amount is read off the
 * events row. A price from the client would let whoever holds the phone
 * write any figure into the night's takings.
 *
 * Idempotent on the client-supplied id, which becomes the row's primary
 * key. Re-flushing a sale that already landed is a result, not an
 * error.
 *
 * Re-checks the cookie itself. Middleware is the first gate, not the
 * only one.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function POST(req: NextRequest) {
  if (!isAuthorized()) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401, headers: NO_STORE })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400, headers: NO_STORE })
  }

  // Accept a single sale as well as a batch, so the online path does
  // not have to wrap itself in an array.
  const shaped =
    raw && typeof raw === 'object' && !Array.isArray((raw as any).sales)
      ? {
          ...(raw as any),
          sales: [
            {
              id: (raw as any).id,
              quantity: (raw as any).quantity,
              payment_method: (raw as any).payment_method,
              sold_at: (raw as any).sold_at ?? null,
            },
          ],
        }
      : raw

  const parsed = DoorSaleBodySchema.safeParse(shaped)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request.' },
      { status: 400, headers: NO_STORE }
    )
  }

  const { event_id, device_id, sales } = parsed.data
  const deviceId = (device_id ?? 'unknown-device').slice(0, 64)
  const results: Array<{ id: string; recorded: boolean; quantity: number; total: number }> = []

  try {
    // Sequential: a flush is a handful of rows, and firing them in
    // parallel would have retried copies of the same id racing.
    for (const sale of sales) {
      const r = await recordDoorSale({
        id: sale.id,
        eventId: event_id,
        quantity: sale.quantity,
        paymentMethod: sale.payment_method,
        soldAt: sale.sold_at ?? null,
        deviceId,
      })
      results.push({ id: r.id, recorded: r.recorded, quantity: r.quantity, total: r.total })
    }
  } catch (err: any) {
    const status = err instanceof DoorSaleError ? err.status : 500
    console.error('[/api/admin/door/sale]', err)
    // Hand back whatever landed so the client can drop those from its
    // queue rather than replaying the whole batch.
    return NextResponse.json(
      { error: err?.message || 'Could not record the sale.', results },
      { status, headers: NO_STORE }
    )
  }

  // The occupancy figure after the batch, so the UI can update without
  // a second round trip.
  const last = results.length > 0 ? await recordedOccupancy(event_id) : null

  return NextResponse.json({ results, occupancy: last }, { headers: NO_STORE })
}

async function recordedOccupancy(eventId: string) {
  const { getOccupancy } = await import('@/lib/tickets/occupancy')
  return getOccupancy(eventId)
}
