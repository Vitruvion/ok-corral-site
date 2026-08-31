import { NextRequest, NextResponse } from 'next/server'
import { isAuthorized } from '@/lib/admin/guard'
import { recordScan, type ScanOutcome } from '@/lib/tickets/scan'

/**
 * POST /api/admin/door/scan — mark tickets used.
 *
 * Takes one scan or a batch, because the offline queue flushes as a
 * batch and a per-scan round trip over bar wifi is exactly what the
 * queue exists to avoid.
 *
 * NOTHING HERE IS AN ERROR EXCEPT A BROKEN REQUEST. An already-used
 * ticket comes back as a result, not a failure, so a queue flush is
 * never blocked by a row it cannot claim. The caller decides what to
 * show; this decides what is true.
 *
 * Re-checks the cookie itself. Middleware is the first gate, not the
 * only one.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

/** One flush should not be able to walk the whole table. */
const MAX_BATCH = 200

type Body = {
  event_id?: unknown
  device_id?: unknown
  code?: unknown
  scanned_at?: unknown
  scans?: unknown
}

export async function POST(req: NextRequest) {
  if (!isAuthorized()) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401, headers: NO_STORE })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400, headers: NO_STORE })
  }

  const eventId = String(body.event_id ?? '').trim()
  if (!eventId) {
    return NextResponse.json({ error: 'Missing event_id.' }, { status: 400, headers: NO_STORE })
  }

  // Identifies the phone, for "which device burned this". Not a
  // credential -- the cookie is the only thing that authorises anything,
  // so this is a label and is treated as one.
  const deviceId = String(body.device_id ?? 'unknown-device').trim().slice(0, 64)

  const raw = Array.isArray(body.scans)
    ? body.scans
    : [{ code: body.code, scanned_at: body.scanned_at }]

  if (raw.length === 0) {
    return NextResponse.json({ error: 'No scans supplied.' }, { status: 400, headers: NO_STORE })
  }
  if (raw.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `Too many scans in one request (max ${MAX_BATCH}).` },
      { status: 400, headers: NO_STORE }
    )
  }

  const results: ScanOutcome[] = []

  try {
    // Sequential on purpose. A flush is at most a few dozen rows, and
    // firing them in parallel would have queued copies of the same code
    // racing each other for no gain.
    for (const item of raw as Array<{ code?: unknown; scanned_at?: unknown }>) {
      const code = String(item?.code ?? '').trim()
      if (!code) continue
      results.push(
        await recordScan(
          eventId,
          { code, scanned_at: item?.scanned_at ? String(item.scanned_at) : null },
          deviceId
        )
      )
    }
  } catch (err: any) {
    console.error('[/api/admin/door/scan]', err)
    // Hand back whatever succeeded so the client can clear those from
    // its queue instead of replaying the whole batch.
    return NextResponse.json(
      { error: err?.message || 'Scan failed.', results },
      { status: 500, headers: NO_STORE }
    )
  }

  return NextResponse.json({ results }, { headers: NO_STORE })
}
