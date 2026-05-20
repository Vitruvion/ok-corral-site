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
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { chromium, type Browser, type Page } from 'playwright'

const PORT = 4099
const BASE = `http://localhost:${PORT}`
const OUT_DIR = path.resolve('public/poster-exports/dustin-gaspard')

const PRINT_ROUTE = '/poster/dustin-gaspard'
const IG_ROUTE = '/poster/dustin-gaspard/instagram'

const PRINT_W = 1080
const PRINT_H = 1800
const IG_W = 1080
const IG_H = 1350

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

    // ── Print poster ─────────────────────────────────────────────
    log('Rendering print poster (2x PNG)')

    // 2x context for the high-DPI PNG (the print master).
    const ctx2x = await browser.newContext({
      viewport: { width: PRINT_W + 200, height: PRINT_H + 200 },
      deviceScaleFactor: 2,
    })
    const print2xPage = await ctx2x.newPage()
    await print2xPage.goto(`${BASE}${PRINT_ROUTE}`, { waitUntil: 'networkidle' })
    await waitForRender(print2xPage)
    await pinPosterToNativeSize(print2xPage, PRINT_W, PRINT_H)
    await waitForRender(print2xPage)

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
    const igPage = await ctxIg.newPage()
    await igPage.goto(`${BASE}${IG_ROUTE}`, { waitUntil: 'networkidle' })
    await waitForRender(igPage)
    await pinPosterToNativeSize(igPage, IG_W, IG_H)
    await waitForRender(igPage)

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
