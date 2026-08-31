import { NextRequest, NextResponse } from 'next/server'
import { isAuthorized } from '@/lib/admin/guard'
import { buildManifest, listDoorEvents } from '@/lib/tickets/door'

/**
 * GET /api/admin/door/manifest            -> events with tickets on sale
 * GET /api/admin/door/manifest?event_id=  -> full manifest for one event
 *
 * The manifest holds every ticket code and every purchaser name for a
 * show. It re-checks the cookie itself rather than trusting middleware:
 * a matcher typo would otherwise publish the guest list.
 *
 * no-store, always. A cached manifest is a stale one, and the whole
 * point of the age indicator in the UI is that the doorman can tell how
 * old their copy is.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(req: NextRequest) {
  if (!isAuthorized()) {
    return NextResponse.json({ error: 'Not authorized.' }, { status: 401, headers: NO_STORE })
  }

  const eventId = req.nextUrl.searchParams.get('event_id')?.trim()

  try {
    if (!eventId) {
      return NextResponse.json({ events: await listDoorEvents() }, { headers: NO_STORE })
    }

    const manifest = await buildManifest(eventId)
    if (!manifest) {
      return NextResponse.json({ error: 'Event not found.' }, { status: 404, headers: NO_STORE })
    }
    return NextResponse.json(manifest, { headers: NO_STORE })
  } catch (err: any) {
    console.error('[/api/admin/door/manifest]', err)
    return NextResponse.json(
      { error: err?.message || 'Could not load the manifest.' },
      { status: 500, headers: NO_STORE }
    )
  }
}
