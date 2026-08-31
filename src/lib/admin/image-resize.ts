/**
 * Shrinks a photo before it leaves the phone.
 *
 * A picture straight off an iPhone is 3-5MB and 4032px on its long
 * edge. Uploading that over bar wifi is slow enough that someone will
 * assume it failed, and it then lands on the public homepage where the
 * browser has to download all of it to show a card 400px wide.
 *
 * So the resize happens HERE, in the page, before a single byte is
 * sent. The server still enforces its own ceiling and sniffs the real
 * type -- this is about speed and page weight, not trust.
 *
 * WebP where the browser encodes it (Safari has since 14), JPEG
 * otherwise. Quality is stepped down until the result is under budget
 * rather than picked once and hoped for: a busy photograph and a flat
 * poster compress very differently at the same setting.
 */

/** Longest edge, in pixels. Twice the widest the card is ever drawn. */
const MAX_EDGE = 1600

/** What we try to come in under. */
const TARGET_BYTES = 500 * 1024

/** Quality ladder, tried in order until one fits. */
const QUALITY_STEPS = [0.82, 0.72, 0.62, 0.5, 0.4]

/**
 * Longest-edge ladder, used only when quality alone cannot reach the
 * target. 1600 is the normal answer; a near-incompressible photograph
 * walks down from there.
 */
const EDGE_STEPS = [MAX_EDGE, 1280, 1024, 800]

export type ResizeResult = {
  file: File
  /** Bytes of the original, for reporting to the person waiting. */
  originalBytes: number
  bytes: number
  width: number
  height: number
  type: string
  /** False when the source was already small enough to leave alone. */
  resized: boolean
}

function canEncodeWebp(): boolean {
  try {
    const c = document.createElement('canvas')
    c.width = 1
    c.height = 1
    return c.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    return false
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

async function loadBitmap(file: File): Promise<{ width: number; height: number; draw: CanvasImageSource }> {
  // createImageBitmap handles EXIF orientation and is far cheaper than
  // an <img> round trip, but Safari only grew it recently.
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as any)
      return { width: bmp.width, height: bmp.height, draw: bmp }
    } catch {
      // Fall through to the <img> path.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not read that image.'))
      el.src = url
    })
    return { width: img.naturalWidth, height: img.naturalHeight, draw: img }
  } finally {
    // Revoked after decode; the canvas already holds the pixels.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

export async function resizeForUpload(file: File): Promise<ResizeResult> {
  const originalBytes = file.size

  const { width, height, draw } = await loadBitmap(file)
  if (!width || !height) throw new Error('Could not read that image.')

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process that image.')
  ctx.drawImage(draw, 0, 0, w, h)

  const type = canEncodeWebp() ? 'image/webp' : 'image/jpeg'
  const ext = type === 'image/webp' ? 'webp' : 'jpg'

  /**
   * Quality first, then size.
   *
   * Dropping quality is invisible on a poster long before dropping
   * pixels is, so the ladder is walked at full width first. But quality
   * alone does not always get there: a very noisy photograph is close
   * to incompressible, and at 1600px even the bottom of the ladder can
   * land over budget. So if it does, the longest edge steps down and
   * the ladder runs again. Something always comes in under target.
   */
  let blob: Blob | null = null
  let outW = w
  let outH = h

  for (const edge of EDGE_STEPS) {
    if (edge < MAX_EDGE) {
      const s = Math.min(1, edge / Math.max(w, h))
      outW = Math.max(1, Math.round(w * s))
      outH = Math.max(1, Math.round(h * s))
      canvas.width = outW
      canvas.height = outH
      ctx.drawImage(draw, 0, 0, outW, outH)
    }
    for (const q of QUALITY_STEPS) {
      blob = await toBlob(canvas, type, q)
      if (blob && blob.size <= TARGET_BYTES) break
    }
    if (blob && blob.size <= TARGET_BYTES) break
  }
  if (!blob) throw new Error('Could not process that image.')

  // If the source was already smaller than everything we produced --
  // an already-optimised poster, say -- keep it rather than re-encoding
  // it larger for no reason.
  if (blob.size >= originalBytes && scale === 1) {
    return {
      file,
      originalBytes,
      bytes: originalBytes,
      width,
      height,
      type: file.type || 'image/jpeg',
      resized: false,
    }
  }

  const name = (file.name.replace(/\.[^.]+$/, '') || 'poster') + '.' + ext
  return {
    file: new File([blob], name, { type }),
    originalBytes,
    bytes: blob.size,
    width: outW,
    height: outH,
    type,
    resized: true,
  }
}

export const formatBytes = (n: number): string =>
  n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + 'MB' : Math.round(n / 1024) + 'KB'
