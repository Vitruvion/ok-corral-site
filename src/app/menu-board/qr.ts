import QRCode from 'qrcode'

/**
 * QR code for the menu board, generated server-side.
 *
 * Rendered to an inline SVG at render time and embedded in the page, so the
 * TV needs no network beyond the page itself — no third-party QR service, no
 * client-side generation, nothing to fail on a bar wifi hiccup.
 */

/** Carries the source so TV-driven visits are attributable in analytics. */
export const BOARD_QR_URL = 'https://www.okcorralsaloon.com/?src=tv'

/** What's printed under the code — clean, without the tracking parameter. */
export const BOARD_QR_LABEL = 'okcorralsaloon.com'

export async function getBoardQrSvg(): Promise<string | null> {
  try {
    const svg = await QRCode.toString(BOARD_QR_URL, {
      type: 'svg',
      // M tolerates ~15% damage. A smudge, a reflection or a bit of screen
      // glare shouldn't kill the scan.
      errorCorrectionLevel: 'M',
      // Quiet zone in MODULES, not pixels. 4 is the spec minimum; without it
      // decoders struggle to find the symbol's edges.
      margin: 4,
      color: {
        // Dark modules on a light panel — standard polarity. Inverted codes
        // (light-on-dark) are decodable by many modern readers but not
        // reliably by all, and a menu board gets one attempt from a stranger.
        // Brand ink on brand bone still measures ~15:1, far past what any
        // decoder needs.
        dark: '#0b0908',
        light: '#ebe4d4',
      },
    })

    // Strip any fixed dimensions so the viewBox scales to whatever the CSS
    // says. The library omits them today; belt and braces if that changes.
    return svg.replace(/\s(?:width|height)="[^"]*"/g, '')
  } catch (err) {
    // A broken image or error text on the bar TV is worse than nothing.
    console.error('[menu-board] QR generation failed', err)
    return null
  }
}
