import { POSTER_BUCKET, serviceClient } from './events-repo'

/**
 * The server half of every image upload into the public `event-posters`
 * bucket: show posters, weekly-special posters and Cocktail of the Month
 * artwork. One copy, so the checks cannot drift between them.
 *
 * Storage: public read, 5MB ceiling, image/webp|jpeg|png only. The bucket
 * enforces its own MIME allowlist as a second line, but nothing here trusts
 * the client's declared content-type -- the actual magic bytes are sniffed.
 * A file claiming to be a PNG and containing SVG would otherwise land in a
 * public bucket, and SVG can carry script.
 *
 * Uploads are resized on the phone first (lib/admin/image-resize.ts), so a
 * camera photo arrives as a WebP well under 500KB. The ceiling is the
 * backstop for a client that did not, not the expected size.
 *
 * THE ORDER, for every caller: put the NEW object, point the row at it,
 * and only then remove the object it replaced. If pointing fails, the new
 * object is removed again -- an orphan in a public bucket is unreachable
 * from any UI and would sit there for good.
 *
 * Lives in lib/ rather than in a route: a Next route module may only
 * export handlers.
 */

/** Server-side ceiling. Matches the bucket's own file_size_limit. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export type Sniffed = { ext: 'webp' | 'jpg' | 'png'; mime: string }

/**
 * What the bytes actually are.
 *
 * The client's content-type is a claim, not evidence. These are the only
 * three shapes the bucket accepts, and anything else -- SVG, HTML, a
 * renamed PDF -- fails here before it can reach public storage.
 */
export function sniffImage(bytes: Uint8Array): Sniffed | null {
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

export type CheckedImage =
  | { ok: true; bytes: Uint8Array; sniffed: Sniffed }
  | { ok: false; status: number; error: string }

/** A form field checked for being a real, non-empty, in-budget image. */
export async function checkImageUpload(file: FormDataEntryValue | null): Promise<CheckedImage> {
  if (!(file instanceof File)) return { ok: false, status: 400, error: 'No file was sent.' }
  if (file.size === 0) return { ok: false, status: 400, error: 'That file is empty.' }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      error:
        'That image is ' +
        Math.round(file.size / 1024) +
        'KB, over the ' +
        MAX_UPLOAD_BYTES / 1024 / 1024 +
        'MB limit.',
    }
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const sniffed = sniffImage(bytes)
  if (!sniffed) return { ok: false, status: 415, error: 'That file is not a JPEG, PNG or WebP image.' }
  return { ok: true, bytes, sniffed }
}

/**
 * Writes a NEW object under `prefix` and returns its key and public URL.
 *
 * Keyed by a timestamp and a random suffix, never overwriting, so a CDN
 * holding the old bytes at the old URL cannot then serve them as the new
 * image.
 */
export async function putPublicImage(
  prefix: string,
  bytes: Uint8Array,
  sniffed: Sniffed
): Promise<{ key: string; publicUrl: string }> {
  const sb = serviceClient()
  const suffix = Math.random().toString(36).slice(2, 10)
  const key = prefix + '/' + Date.now().toString(36) + '-' + suffix + '.' + sniffed.ext

  const up = await sb.storage.from(POSTER_BUCKET).upload(key, bytes, {
    contentType: sniffed.mime,
    cacheControl: '31536000',
    upsert: false,
  })
  if (up.error) throw new Error(up.error.message)

  const { data } = sb.storage.from(POSTER_BUCKET).getPublicUrl(key)
  return { key, publicUrl: data.publicUrl }
}

/**
 * Removes one object. Never throws: an orphaned object costs a few KB,
 * whereas failing the save would lose the image the user just chose.
 */
export async function removePublicImage(key: string | null, tag = '[poster]'): Promise<boolean> {
  if (!key) return false
  const sb = serviceClient()
  const { error } = await sb.storage.from(POSTER_BUCKET).remove([key])
  if (error) {
    console.warn(tag, 'could not remove old object', key, error.message)
    return false
  }
  return true
}
