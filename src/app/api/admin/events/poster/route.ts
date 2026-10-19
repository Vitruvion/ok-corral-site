import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { isAdmin } from '@/lib/admin/guard'
import { getEvent, POSTER_BUCKET, serviceClient, storageKeyFromUrl } from '@/lib/admin/events-repo'
import { getRecurring } from '@/lib/admin/recurring-repo'

/**
 * /api/admin/events/poster — event poster upload and removal.
 *
 * Storage: the `event-posters` bucket, public read, 5MB ceiling,
 * image/webp|jpeg|png only. The bucket enforces its own MIME allowlist
 * as a second line, but this route does NOT trust the client's declared
 * content-type -- it sniffs the actual magic bytes. A file claiming to
 * be a PNG and containing SVG would otherwise land in a public bucket,
 * and SVG can carry script.
 *
 * Uploads are resized on the phone before they get here (see
 * PosterField), so a 4MB camera photo arrives as a WebP well under
 * 500KB. The ceiling below is the backstop for a client that did not,
 * not the expected size.
 *
 * TWO KINDS OF OWNER, ONE PIPELINE. `kind` is 'event' (a show; the
 * default, so older clients are unaffected) or 'recurring' (a weekly
 * special). Only the table and the key prefix differ -- the sniffing,
 * the size cap, the write-then-point order and the orphan cleanup are
 * the same code for both.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Server-side ceiling. Matches the bucket's own file_size_limit. */
const MAX_BYTES = 5 * 1024 * 1024

const unauthorized = () =>
  NextResponse.json(
    { error: 'Not authorized.' },
    { status: 401, headers: { 'Cache-Control': 'no-store' } }
  )

const BUCKET = POSTER_BUCKET

type Sniffed = { ext: 'webp' | 'jpg' | 'png'; mime: string }

/**
 * What the bytes actually are.
 *
 * The client's content-type is a claim, not evidence. These are the
 * only three shapes the bucket accepts, and anything else -- SVG, HTML,
 * a renamed PDF -- fails here before it can reach public storage.
 */
function sniff(bytes: Uint8Array): Sniffed | null {
  const b = bytes
  if (b.length < 12) return null

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' }
  }
  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' }
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return { ext: 'webp', mime: 'image/webp' }
  }
  return null
}

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

async function removeObject(key: string | null): Promise<boolean> {
  if (!key) return false
  const sb = serviceClient()
  const { error } = await sb.storage.from(BUCKET).remove([key])
  if (error) {
    // Not fatal: an orphaned object costs a few KB, whereas failing the
    // save would lose the poster the user just chose.
    console.warn('[poster] could not remove old object', key, error.message)
    return false
  }
  return true
}

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

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was sent.' }, { status: 400 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'That file is empty.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error:
          'That image is ' +
          Math.round(file.size / 1024) +
          'KB, over the ' +
          MAX_BYTES / 1024 / 1024 +
          'MB limit.',
      },
      { status: 413 }
    )
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const sniffed = sniff(bytes)
  if (!sniffed) {
    return NextResponse.json(
      { error: 'That file is not a JPEG, PNG or WebP image.' },
      { status: 415 }
    )
  }

  try {
    const owner = await findOwner(kind, eventId)
    if (!owner) return notFound(kind)

    const sb = serviceClient()
    // Keyed by owner and a random suffix, so replacing a poster writes a
    // NEW object rather than overwriting -- a CDN holding the old bytes
    // at the old URL cannot then serve them as the new poster.
    const suffix = Math.random().toString(36).slice(2, 10)
    const key = owner.prefix + '/' + Date.now().toString(36) + '-' + suffix + '.' + sniffed.ext

    const up = await sb.storage.from(BUCKET).upload(key, bytes, {
      contentType: sniffed.mime,
      cacheControl: '31536000',
      upsert: false,
    })
    if (up.error) throw new Error(up.error.message)

    const { data } = sb.storage.from(BUCKET).getPublicUrl(key)
    const publicUrl = data.publicUrl

    const previousKey = storageKeyFromUrl(owner.poster_url)

    const { error } = await sb
      .from(owner.table)
      .update({ poster_url: publicUrl })
      .eq('id', eventId)
    if (error) {
      // The object is in the bucket but nothing points at it. Take it
      // back out: an orphan in a public bucket is unreachable from any
      // UI and would sit there for good.
      await removeObject(key)
      throw new Error(error.message)
    }

    // Only once the row points at the new object -- otherwise a failure
    // here would leave the show with a URL to something deleted.
    const removedOld = await removeObject(previousKey)

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

    const removed = await removeObject(key)

    revalidatePath('/')
    return NextResponse.json({ ok: true, removed_key: key, removed })
  } catch (err: any) {
    console.error('[/api/admin/events/poster DELETE]', err)
    return NextResponse.json({ error: err?.message || 'Could not remove the poster.' }, { status: 500 })
  }
}
