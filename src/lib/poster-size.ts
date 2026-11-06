import { open } from 'node:fs/promises'
import path from 'node:path'
import { imageSize } from 'image-size'

/**
 * A poster's intrinsic pixel size, read on the server while the page is
 * rendered (ISR), so the browser can reserve EXACTLY the right box before
 * a byte of the image arrives.
 *
 * WHY. Posters are uploads of any shape. Every way of sizing them in the
 * browser alone failed on someone's phone:
 *   - natural sizing (fde2ac8): the box is 0px until the image loads, so
 *     the page grows under an anchor jump and a nav click lands short;
 *   - a fixed 3:4 frame (2af4ac8): the poster's percentage max-height is
 *     ignored inside it, so a tall poster spilled out of the frame and over
 *     the text below, and in WebKit a poster that arrived after the open
 *     row narrowed its column was laid out at the old, wider width.
 * Knowing the size up front removes the guesswork: width and height go on
 * the <img>, and the box is right before load, after load, and in between.
 *
 * Only the header is read -- a ranged request for the first 64KB, which is
 * where JPEG, PNG and WebP keep their dimensions -- never the whole file.
 * A failure of any kind returns null and the caller falls back to a
 * contained frame (see PosterImage). It can never break the page or the
 * build.
 */

export type PosterSize = { w: number; h: number }

/** Enough for the header of any poster we accept, EXIF included. */
const HEAD_BYTES = 64 * 1024
/** A second, larger try for a file with an unusually fat EXIF block. */
const RETRY_BYTES = 512 * 1024
const TIMEOUT_MS = 4000
/** A failed lookup is retried after this long; a success is kept. */
const FAILURE_TTL_MS = 5 * 60 * 1000

type Entry = { at: number; value: Promise<PosterSize | null> }

/**
 * Per server instance, for its whole life. Storage URLs are immutable --
 * a replaced poster gets a new object key (see the poster route) -- so a
 * size, once read, is right forever. That also makes it right for the
 * life of any ISR page that used it.
 */
const cache = new Map<string, Entry>()

function fromBytes(bytes: Uint8Array): PosterSize | null {
  const r = imageSize(bytes)
  let w = Number(r.width)
  let h = Number(r.height)
  // EXIF orientations 5-8 are rotated a quarter turn, and browsers apply
  // EXIF orientation when they draw -- so the drawn box is the other way
  // round from the stored pixels.
  if (r.orientation && r.orientation >= 5 && r.orientation <= 8) [w, h] = [h, w]
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0 || w > 20000 || h > 20000) return null
  return { w, h }
}

async function headOfUrl(url: string, bytes: number): Promise<Uint8Array> {
  const res = await fetch(url, {
    headers: { Range: `bytes=0-${bytes - 1}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  // A server that ignores Range answers 200 with the whole file. Read only
  // as far as needed either way.
  const reader = res.body?.getReader()
  if (!reader) throw new Error('no body')
  const chunks: Uint8Array[] = []
  let got = 0
  while (got < bytes) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    got += value.length
  }
  await reader.cancel().catch(() => {})
  const out = new Uint8Array(Math.min(got, bytes))
  let at = 0
  for (const c of chunks) {
    const take = Math.min(c.length, out.length - at)
    out.set(c.subarray(0, take), at)
    at += take
    if (at >= out.length) break
  }
  return out
}

async function headOfPublicFile(urlPath: string, bytes: number): Promise<Uint8Array> {
  const root = path.join(process.cwd(), 'public')
  const file = path.normalize(path.join(root, decodeURIComponent(urlPath.split('?')[0])))
  // Only ever a file under /public.
  if (!file.startsWith(root + path.sep)) throw new Error('outside public')
  const fh = await open(file, 'r')
  try {
    const buf = new Uint8Array(bytes)
    const { bytesRead } = await fh.read(buf, 0, bytes, 0)
    return buf.subarray(0, bytesRead)
  } finally {
    await fh.close()
  }
}

async function lookup(src: string): Promise<PosterSize | null> {
  const read = (n: number) => (/^https?:\/\//i.test(src) ? headOfUrl(src, n) : headOfPublicFile(src, n))
  try {
    return fromBytes(await read(HEAD_BYTES))
  } catch {
    try {
      return fromBytes(await read(RETRY_BYTES))
    } catch (err) {
      console.warn('[poster-size] could not read size of', src, '-', err instanceof Error ? err.message : err)
      return null
    }
  }
}

/** The poster's size, or null when it cannot be read. Never throws. */
export function getPosterSize(src: string | null | undefined): Promise<PosterSize | null> {
  if (!src || !(src.startsWith('/') || /^https?:\/\//i.test(src))) return Promise.resolve(null)
  const hit = cache.get(src)
  if (hit) {
    // Keep successes; let a failure be retried once its TTL is up.
    const fresh = Date.now() - hit.at < FAILURE_TTL_MS
    if (fresh) return hit.value
    return hit.value.then(v => (v ? v : refresh(src)))
  }
  return refresh(src)
}

function refresh(src: string): Promise<PosterSize | null> {
  const value = lookup(src).catch(() => null)
  cache.set(src, { at: Date.now(), value })
  return value
}

/** Adds `poster_size` to every row that has a `poster_url`, in parallel. */
export async function withPosterSizes<T extends { poster_url?: string | null }>(
  rows: T[]
): Promise<(T & { poster_size: PosterSize | null })[]> {
  const sizes = await Promise.all(rows.map(r => getPosterSize(r.poster_url)))
  return rows.map((r, i) => ({ ...r, poster_size: sizes[i] }))
}
