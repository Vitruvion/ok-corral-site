/**
 * Camera and QR decoding.
 *
 * THE CAMERA STAYS OPEN. The stream is started once when scan mode is
 * entered and torn down only when it is left. Stopping and restarting
 * per scan costs roughly a second of black screen on an iPhone, which
 * is the entire difference between a door that moves and a door that
 * queues. Between scans the decode loop simply ignores frames.
 *
 * DECODER. BarcodeDetector is used where it exists (Android Chrome) --
 * it is hardware-backed and cheaper per frame. Safari on iOS does not
 * implement it, and an iPhone is what this actually runs on, so jsQR is
 * not a nicety here: it is the real path. It is imported dynamically so
 * the 40KB only loads on the door route.
 */

import { normalizeTicketCode, CODE_LENGTH, SIG_LENGTH } from '@/lib/tickets/code-format'

type AnyBarcodeDetector = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>
}

export type DecoderKind = 'BarcodeDetector' | 'jsQR'

export type ScannerHandle = {
  stop: () => void
  decoder: DecoderKind
}

/** Frames per second the decoder attempts. */
const DECODE_FPS = 10

/**
 * Longest edge fed to the decoder, in pixels.
 *
 * Full sensor resolution is wasted work -- a QR filling a third of the
 * frame is comfortably readable at this size, and the smaller buffer
 * keeps the loop inside its frame budget on an older phone.
 */
const DECODE_EDGE = 640

async function pickDetector(): Promise<{ kind: DecoderKind; detector?: AnyBarcodeDetector }> {
  const w = window as any
  if (typeof w.BarcodeDetector === 'function') {
    try {
      const formats: string[] = await w.BarcodeDetector.getSupportedFormats()
      if (formats.includes('qr_code')) {
        return { kind: 'BarcodeDetector', detector: new w.BarcodeDetector({ formats: ['qr_code'] }) }
      }
    } catch {
      // Present but unusable. Fall through.
    }
  }
  return { kind: 'jsQR' }
}

export async function startScanner(opts: {
  video: HTMLVideoElement
  canvas: HTMLCanvasElement
  onDecode: (payload: string) => void
  onError: (message: string) => void
}): Promise<ScannerHandle> {
  const { video, canvas, onDecode, onError } = opts

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        // The back camera. 'environment' rather than exact() so a device
        // without one still opens something instead of failing outright.
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    })
  } catch (err: any) {
    const name = err?.name ?? ''
    onError(
      name === 'NotAllowedError'
        ? 'Camera permission was denied. Allow the camera in Safari settings, then reload.'
        : name === 'NotFoundError'
          ? 'No camera found on this device.'
          : `Could not open the camera: ${err?.message ?? (name || 'unknown error')}`
    )
    return { stop: () => {}, decoder: 'jsQR' }
  }

  video.srcObject = stream
  // playsInline is set on the element in JSX too. Without it iOS Safari
  // takes the video fullscreen in its own player and the overlay is gone.
  video.setAttribute('playsinline', 'true')
  video.muted = true
  try {
    await video.play()
  } catch (err: any) {
    onError(`Could not start the camera preview: ${err?.message ?? 'unknown error'}`)
  }

  const { kind, detector } = await pickDetector()
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  let jsQR: typeof import('jsqr').default | null = null
  if (kind === 'jsQR') {
    jsQR = (await import('jsqr')).default
  }

  let stopped = false
  let timer: number | null = null

  const tick = async () => {
    if (stopped) return
    try {
      if (video.readyState >= 2 && video.videoWidth > 0 && ctx) {
        const scale = Math.min(1, DECODE_EDGE / Math.max(video.videoWidth, video.videoHeight))
        const w = Math.round(video.videoWidth * scale)
        const h = Math.round(video.videoHeight * scale)
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w
          canvas.height = h
        }
        ctx.drawImage(video, 0, 0, w, h)

        if (detector) {
          const found = await detector.detect(canvas)
          if (found.length > 0 && found[0].rawValue) onDecode(found[0].rawValue)
        } else if (jsQR) {
          const image = ctx.getImageData(0, 0, w, h)
          const found = jsQR(image.data, w, h, { inversionAttempts: 'dontInvert' })
          if (found?.data) onDecode(found.data)
        }
      }
    } catch {
      // A dropped frame is not worth reporting. The next one is 100ms away.
    }
    if (!stopped) timer = window.setTimeout(tick, 1000 / DECODE_FPS)
  }

  tick()

  return {
    decoder: kind,
    stop: () => {
      stopped = true
      if (timer !== null) window.clearTimeout(timer)
      for (const track of stream.getTracks()) track.stop()
      video.srcObject = null
    },
  }
}

// ── Payload parsing ───────────────────────────────────────────────
export const QR_VERSION = 'OKC1'

export type ParsedScan =
  | { ok: true; code: string; sig: string }
  | { ok: false; reason: 'malformed' | 'unknown-version' }

/**
 * Splits a scanned payload into code and signature.
 *
 * Mirrors parseQrPayload in @/lib/tickets/codes, reimplemented here
 * because that module imports node:crypto and cannot be bundled for the
 * browser. The FORMAT is the shared contract, not the code -- see the
 * format block in codes.ts, which is the thing to keep in step.
 *
 * The code is normalized on the way out, so a payload and a
 * hand-typed PNGV-XSBT-67MR reduce to the same string.
 */
export function parseScan(payload: string): ParsedScan {
  const parts = String(payload ?? '').trim().toUpperCase().split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed' }
  const [version, code, sig] = parts
  if (version !== QR_VERSION) return { ok: false, reason: 'unknown-version' }
  if (code.length !== CODE_LENGTH || sig.length !== SIG_LENGTH) {
    return { ok: false, reason: 'malformed' }
  }
  return { ok: true, code: normalizeTicketCode(code), sig }
}
