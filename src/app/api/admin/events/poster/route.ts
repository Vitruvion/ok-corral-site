import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isAdmin } from '@/lib/admin/guard'
import { getEvent, serviceClient, storageKeyFromUrl } from '@/lib/admin/events-repo'
import { checkImageUpload, putPublicImage, removePublicImage } from '@/lib/admin/poster-upload'
import { getRecurring } from '@/lib/admin/recurring-repo'

/**
 * /api/admin/events/poster — event poster upload and removal.
 *
 * Storage: the `event-posters` bucket. The checks -- 5MB ceiling,
 * magic-byte sniffing rather than the client's content-type -- and the
 * write-then-point-then-clean-up order live in lib/admin/poster-upload.ts,
 * shared with the Cocktail of the Month artwork (/api/admin/cocktail).
 *
 * Uploads are resized on the phone before they get here (see
 * PosterField), so a 4MB camera photo arrives as a WebP well under
 * 500KB.
 *
 * TWO KINDS OF OWNER, ONE PIPELINE. `kind` is 'event' (a show; the
 * default, so older clients are unaffected) or 'recurring' (a weekly
 * special). Only the table and the key prefix differ -- the sniffing,
 * the size cap, the write-then-point order and the orphan cleanup are
 * the same code for both.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const unauthorized = () =>
  NextResponse.json(
    { error: 'Not authorized.' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  )

type Owner = {
  table: 'events' | 'recurring_events'
  /** Storage folder: the show's slug, or weekly/<id> for a weekly special. */
  prefix: string
  poster_url: string | null
}

const Kind = z.enum(['event', 'recurring']).catch('event')

/** The row a poster belongs to, or null when there is no such row. */
async function findOwner(kind: 'event' | 'recurring', id: string): Promise<Owner | null> {
  if (kind === 'recurring') {
    const r = await getRecurring(id)
    return r ? { table: 'recurring_events', prefix: 'weekly/' + r.id, poster_url: r.poster_url } : null
  }
  const ev = await getEvent(id)
  return ev ? { table: 'events', prefix: ev.slug, poster_url: ev.poster_url } : null
}

const notFound = (kind: 'event' | 'recurring') =>
  NextResponse.json(
    { error: kind === 'recurring' ? 'Weekly event not found.' : 'Show not found.' },
    { status: 404 }
  )

export async function POST(req: Request) {
  if (!isAdmin()) return unauthorized()

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected a file upload.' }, { status: 400 })
  }

  const eventId = String(form.get('event_id') ?? '')
  const kind = Kind.parse(form.get('kind') ?? undefined)
  if (!z.string().uuid().safeParse(eventId).success) {
    return NextResponse.json({ error: 'Missing event id.' }, { status: 400 })
  }

  const checked = await checkImageUpload(form.get('file'))
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: checked.status })
  const { bytes, sniffed } = checked

  try {
    const owner = await findOwner(kind, eventId)
    if (!owner) return notFound(kind)

    const sb = serviceClient()
    // A NEW object under the owner's prefix, never an overwrite.
    const { key, publicUrl } = await putPublicImage(owner.prefix, bytes, sniffed)

    const previousKey = storageKeyFromUrl(owner.poster_url)

    const { error } = await sb
      .from(owner.table)
      .update({ poster_url: publicUrl })
      .eq('id', eventId)
    if (error) {
      // The object is in the bucket but nothing points at it. Take it
      // back out: an orphan in a public bucket is unreachable from any
      // UI and would sit there for good.
      await removePublicImage(key)
      throw new Error(error.message)
    }

    // Only once the row points at the new object -- otherwise a failure
    // here would leave the show with a URL to something deleted.
    const removedOld = await removePublicImage(previousKey)

    revalidatePath('/')
    return NextResponse.json({
      poster_url: publicUrl,
      bytes: bytes.length,
      type: sniffed.mime,
      replaced: previousKey,
      removed_old: removedOld,
    })
  } catch (err: any) {
    console.error('[/api/admin/events/poster POST]', err)
    return NextResponse.json({ error: err?.message || 'Could not upload the poster.' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  if (!isAdmin()) return unauthorized()

  let eventId: string
  let kind: 'event' | 'recurring'
  try {
    const body = await req.json()
    eventId = z.string().uuid().parse(body?.event_id)
    kind = Kind.parse(body?.kind)
  } catch {
    return NextResponse.json({ error: 'Missing event id.' }, { status: 400 })
  }

  try {
    const owner = await findOwner(kind, eventId)
    if (!owner) return notFound(kind)

    const key = storageKeyFromUrl(owner.poster_url)

    const sb = serviceClient()
    const { error } = await sb.from(owner.table).update({ poster_url: null }).eq('id', eventId)
    if (error) throw new Error(error.message)

    const removed = await removePublicImage(key)

    revalidatePath('/')
    return NextResponse.json({ ok: true, removed_key: key, removed })
  } catch (err: any) {
    console.error('[/api/admin/events/poster DELETE]', err)
    return NextResponse.json({ error: err?.message || 'Could not remove the poster.' }, { status: 500 })
  }
}
