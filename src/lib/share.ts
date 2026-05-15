/**
 * Tries the native Web Share API first (mobile), falls back to copying
 * the URL to the clipboard. Returns a tag describing what happened so
 * the caller can show appropriate UI feedback.
 */
export type ShareResult =
  | { kind: 'shared' }      // native share sheet opened successfully
  | { kind: 'copied' }      // copied to clipboard
  | { kind: 'canceled' }    // user dismissed the native share sheet
  | { kind: 'failed', error: string }

export async function shareOrCopy(opts: {
  title: string
  text?: string
  url: string
}): Promise<ShareResult> {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined

  // Web Share API — works on iOS Safari, Android Chrome, and increasingly
  // desktop Chrome/Edge. We feature-detect rather than UA-sniff.
  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share({ title: opts.title, text: opts.text, url: opts.url })
      return { kind: 'shared' }
    } catch (err: any) {
      // AbortError = user canceled the share sheet. Not an error worth
      // surfacing — but also don't fall through to clipboard since they
      // explicitly bailed.
      if (err?.name === 'AbortError') return { kind: 'canceled' }
      // Other errors fall through to clipboard.
    }
  }

  // Clipboard fallback.
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(opts.url)
      return { kind: 'copied' }
    } catch (err: any) {
      return { kind: 'failed', error: err?.message || 'Clipboard write failed.' }
    }
  }

  // Last-ditch: legacy execCommand approach. Some restrictive contexts still
  // need it (older Safari, non-HTTPS, embedded WebViews).
  try {
    const ta = document.createElement('textarea')
    ta.value = opts.url
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok ? { kind: 'copied' } : { kind: 'failed', error: 'Copy failed.' }
  } catch (err: any) {
    return { kind: 'failed', error: err?.message || 'No share or clipboard available.' }
  }
}
