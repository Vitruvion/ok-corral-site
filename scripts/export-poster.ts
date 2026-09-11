/**
 * Headless-browser export pipeline for the Dustin Dale Gaspard poster.
 *
 * Produces two artifacts in /public/poster-exports/dustin-gaspard/:
 *   - dustin-gaspard-print-2x.png  (2160×3600, high-DPI PNG — the print master)
 *   - dustin-gaspard-instagram.png (1080×1350, IG 4:5 PNG)
 *
 * Usage:  npm run export-poster
 *
 * The script spawns its own Next.js dev server on a free port, waits
 * for it to come up, then drives Playwright Chromium through both
 * routes. Cleans up the dev server on exit (including on error).
 *
 * Note: a PDF export used to live here too, but Playwright's printed
 * PDF introduced a pink/magenta color cast on the cream paper that
 * we couldn't fix without re-engineering the color pipeline. The
 * 2x PNG is print-shop-friendly at 200+ DPI for tabloid (11×17)
 * and is the canonical print artifact now.
 *
 * FULL-RESOLUTION SOURCE PHOTOS. The site's copy of the poster photo in
 * /public was resized for the web (perf(assets)): it is 1067px wide,
 * and the 2x print draws it at ~1160px, so exporting from it would
 * upscale. The camera originals live OUTSIDE the repo, in
 * ../ok-corral-original-assets/assets/... (a sibling of the repo root).
 *
 * The export prefers those. It does so by intercepting the browser's
 * request for the image inside Playwright and answering with the
 * original's bytes -- the site itself, and how it loads the image, is
 * untouched. If the original is missing, the export falls back to the
 * /public copy and says so loudly. And if the interception never fires
 * (a changed URL, say), it refuses to write an export at all rather
 * than quietly producing an upscaled print.
 *
 * POSTER_OUT_DIR overrides the output directory, so a test export can
 * be written somewhere other than the committed files.
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import sharp from 'sharp'

const PORT = 4099
const BASE = `http://localhost:${PORT}`
const OUT_DIR = process.env.POSTER_OUT_DIR
  ? path.resolve(process.env.POSTER_OUT_DIR)
  : path.resolve('public/poster-exports/dustin-gaspard')

const PRINT_ROUTE = '/poster/dustin-gaspard'
const IG_ROUTE = '/poster/dustin-gaspard/instagram'

const PRINT_W = 1080
const PRINT_H = 1800
const IG_W = 1080
const IG_H = 1350

// Resolved from this file's own location, not the working directory and
// not an absolute path: scripts/ -> repo root -> its sibling.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ORIGINALS_ROOT = path.resolve(REPO_ROOT, '..', 'ok-corral-original-assets')

/**
 * Raster images the poster routes draw that were resized in /public and
 * have full-resolution originals outside the repo. URL path as the page
 * requests it. The QR is an SVG and needs no original.
 */
const ORIGINAL_SOURCES = ['/assets/posters/dustin-gaspard.jpg']

// ─── Helpers ──────────────────────────────────────────────────────

function log(...args: unknown[]) {
  console.log('[export-poster]', ...args)
}

async function waitForServer(timeoutMs = 90_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(BASE + PRINT_ROUTE)
      // 200 (compiled) or 500 (still compiling) — either means up.
      // We treat any HTTP response as "server bound".
      if (res.status > 0) return
    } catch {
      // not yet bound; retry
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Next dev server did not bind on ${BASE} within ${timeoutMs}ms`)
}

/** Spawn `next dev` on PORT. Returns the child process. */
function startDevServer(): ChildProcess {
  log(`Spawning Next dev server on port ${PORT}`)
  const isWin = process.platform === 'win32'
  const child = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    // Windows .cmd shim requires shell: true to be resolved correctly.
    shell: isWin,
  })
  // Forward dev output to stderr so we can see compile errors but
  // it doesn't pollute the artifact output.
  child.stdout?.on('data', (b) => process.stderr.write(`[next] ${b}`))
  child.stderr?.on('data', (b) => process.stderr.write(`[next] ${b}`))
  return child
}

/**
 * Wait until fonts are loaded AND all images on the page have
 * finished decoding. The PosterScaler's transform-scale renders
 * before fonts swap in; if we screenshot before fonts settle we
 * get a flash of fallback serifs in the rendered PNG.
 */
async function waitForRender(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => {
    const imgs = Array.from(document.images)
    await Promise.all(
      imgs.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve()
        return new Promise((res) => {
          img.addEventListener('load', () => res(null), { once: true })
          img.addEventListener('error', () => res(null), { once: true })
        })
      }),
    )
  })
  // tiny extra buffer for layout settle
  await page.waitForTimeout(300)
}

/**
 * Take over the page so the poster renders at its NATIVE 1:1 size
 * with no surrounding stage chrome. The PosterScaler component
 * applies a transform: scale() that fits the poster to whatever
 * viewport it sees; for export we want the unscaled artwork.
 */
async function pinPosterToNativeSize(page: Page, width: number, height: number) {
  await page.evaluate(
    ({ w, h }) => {
      const wrap = document.querySelector('[class*="posterWrap"]') as HTMLElement | null
      const stage = document.querySelector('[class*="stage__"]') as HTMLElement | null
      if (wrap) {
        wrap.style.transform = 'scale(1)'
        wrap.style.transformOrigin = '0 0'
      }
      if (stage) {
        stage.style.background = 'transparent'
        stage.style.height = `${h}px`
        stage.style.width = `${w}px`
        stage.style.display = 'block'
        stage.style.padding = '0'
        stage.style.overflow = 'visible'
      }
      // body / html chrome
      document.documentElement.style.background = 'transparent'
      document.body.style.background = 'transparent'
      document.body.style.margin = '0'
    },
    { w: width, h: height },
  )
  // give the layout one frame to settle
  await page.waitForTimeout(100)
}

type Source = {
  url: string
  kind: 'original' | 'public'
  file: string
  body: Buffer | null
  hits: number
}

function contentType(file: string): string {
  const ext = path.extname(file).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  return 'application/octet-stream'
}

/** Decides, once, where each source image comes from -- and says which. */
async function resolveSources(): Promise<Source[]> {
  const out: Source[] = []
  for (const url of ORIGINAL_SOURCES) {
    const parts = url.split('/').filter(Boolean)
    const original = path.join(ORIGINALS_ROOT, ...parts)
    const pub = path.join(REPO_ROOT, 'public', ...parts)
    if (existsSync(original)) {
      const m = await sharp(original).metadata()
      log(`source ${url}: ORIGINAL ${original} (${m.width}x${m.height}, ${statSync(original).size} bytes)`)
      out.push({ url, kind: 'original', file: original, body: readFileSync(original), hits: 0 })
    } else {
      const m = existsSync(pub) ? await sharp(pub).metadata() : null
      console.warn(`[export-poster] WARNING: no original at ${original}`)
      console.warn(
        `[export-poster] WARNING: exporting ${url} from the RESIZED /public copy` +
          (m ? ` (${m.width}x${m.height})` : '') +
          ' -- the photo will be UPSCALED in the 2x print. Restore the original to fix.'
      )
      out.push({ url, kind: 'public', file: pub, body: null, hits: 0 })
    }
  }
  return out
}

/** Answers the page's request for each image with the original's bytes. */
async function serveOriginals(ctx: BrowserContext, sources: Source[]) {
  for (const s of sources) {
    if (s.kind !== 'original' || !s.body) continue
    const body = s.body
    await ctx.route(`**${s.url}`, (route) => {
      s.hits++
      return route.fulfill({ status: 200, contentType: contentType(s.file), body })
    })
  }
}

/**
 * Refuses to go on if an original was available but never served.
 * Called before each screenshot, so a failed interception writes nothing
 * instead of quietly writing an upscaled export.
 */
function assertServed(sources: Source[], before: number[], label: string) {
  sources.forEach((s, i) => {
    if (s.kind !== 'original') return
    const n = s.hits - before[i]
    if (n < 1) {
      throw new Error(`${label}: ${s.url} was never requested, so the original was not used. Nothing written.`)
    }
    log(`  ${label}: served ORIGINAL for ${s.url} (${n} request${n === 1 ? '' : 's'})`)
  })
}

const hitCounts = (sources: Source[]) => sources.map((s) => s.hits)

// ─── Main ─────────────────────────────────────────────────────────

async function main() {
  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true })
    log(`Created output dir: ${OUT_DIR}`)
  }

  const dev = startDevServer()
  let browser: Browser | undefined

  const shutdown = () => {
    try {
      browser?.close()
    } catch {}
    try {
      // SIGTERM on POSIX, taskkill on Windows
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(dev.pid), '/f', '/t'])
      } else {
        dev.kill('SIGTERM')
      }
    } catch {}
  }
  process.on('SIGINT', () => {
    shutdown()
    process.exit(130)
  })
  process.on('SIGTERM', () => {
    shutdown()
    process.exit(143)
  })

  try {
    await waitForServer()
    log('Dev server ready')

    browser = await chromium.launch({ headless: true })
    const sources = await resolveSources()

    // ── Print poster ─────────────────────────────────────────────
    log('Rendering print poster (2x PNG)')

    // 2x context for the high-DPI PNG (the print master).
    const ctx2x = await browser.newContext({
      viewport: { width: PRINT_W + 200, height: PRINT_H + 200 },
      deviceScaleFactor: 2,
    })
    await serveOriginals(ctx2x, sources)
    const printBefore = hitCounts(sources)
    const print2xPage = await ctx2x.newPage()
    await print2xPage.goto(`${BASE}${PRINT_ROUTE}`, { waitUntil: 'networkidle' })
    await waitForRender(print2xPage)
    await pinPosterToNativeSize(print2xPage, PRINT_W, PRINT_H)
    await waitForRender(print2xPage)
    assertServed(sources, printBefore, 'print')

    // Screenshot just the .poster element — captures its 1080×1800
    // bounding box at the 2x device scale factor = 2160×3600 PNG.
    const posterLocator = print2xPage.locator('article[class*="poster__"]').first()
    await posterLocator.screenshot({
      path: path.join(OUT_DIR, 'dustin-gaspard-print-2x.png'),
      type: 'png',
      animations: 'disabled',
    })
    log(`  wrote ${path.join(OUT_DIR, 'dustin-gaspard-print-2x.png')}`)
    await ctx2x.close()

    // ── Instagram variant ────────────────────────────────────────
    log('Rendering Instagram variant')

    const ctxIg = await browser.newContext({
      viewport: { width: IG_W + 200, height: IG_H + 200 },
      deviceScaleFactor: 1,
    })
    await serveOriginals(ctxIg, sources)
    const igBefore = hitCounts(sources)
    const igPage = await ctxIg.newPage()
    await igPage.goto(`${BASE}${IG_ROUTE}`, { waitUntil: 'networkidle' })
    await waitForRender(igPage)
    await pinPosterToNativeSize(igPage, IG_W, IG_H)
    await waitForRender(igPage)
    assertServed(sources, igBefore, 'instagram')

    const igLocator = igPage.locator('article[class*="poster__"]').first()
    await igLocator.screenshot({
      path: path.join(OUT_DIR, 'dustin-gaspard-instagram.png'),
      type: 'png',
      animations: 'disabled',
    })
    log(`  wrote ${path.join(OUT_DIR, 'dustin-gaspard-instagram.png')}`)
    await ctxIg.close()

    log('Done')
  } finally {
    shutdown()
  }
}

main().catch((err) => {
  console.error('[export-poster] failed:', err)
  process.exit(1)
})
