#!/usr/bin/env node
/**
 * Product mockup renderer.
 *
 *   node scripts/mockup/render.js config/house-tee-black-front.json
 *   node scripts/mockup/render.js --all
 *   node scripts/mockup/render.js --all --force
 *
 * Composites artwork onto a ghost-mannequin blank: perspective-warps the art
 * into the configured print quad, pushes it around with a displacement map so
 * it follows the fabric, blends it into the garment, and writes a 2x PNG plus
 * a web-sized WebP.
 *
 * Standalone by design — nothing here imports from src/, and nothing in the
 * site imports from here. Outputs land in out/ and are gitignored.
 */

const fs = require('node:fs/promises')
const { existsSync } = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const { warpIntoQuad, applyOpacity, applyShading, highPassGrain } = require('./lib/warp.js')

const ROOT = __dirname
const CONFIG_DIR = path.join(ROOT, 'config')
const OUT_DIR = path.join(ROOT, 'out')

// libvips blend modes that make sense for putting ink on cloth.
const BLEND_MODES = new Set([
  'over', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'colour-dodge', 'colour-burn', 'hard-light', 'soft-light',
  'difference', 'exclusion',
])

// ── Config ────────────────────────────────────────────────────────
function resolveRelative(p) {
  return path.isAbsolute(p) ? p : path.join(ROOT, p)
}

/** Accepts either an ordered array or named corners. Returns [[x,y] × 4]. */
function normalizeQuad(printArea, label) {
  const fail = (msg) => { throw new Error(`${label}: printArea ${msg}`) }

  let pts
  if (Array.isArray(printArea)) {
    pts = printArea
  } else if (printArea && typeof printArea === 'object') {
    const { topLeft, topRight, bottomRight, bottomLeft } = printArea
    if (!topLeft || !topRight || !bottomRight || !bottomLeft) {
      fail('needs topLeft, topRight, bottomRight and bottomLeft (or an array of 4 points)')
    }
    pts = [topLeft, topRight, bottomRight, bottomLeft]
  } else {
    fail('is required')
  }

  if (pts.length !== 4) fail(`needs exactly 4 corners, got ${pts.length}`)
  return pts.map((p, i) => {
    if (!Array.isArray(p) || p.length !== 2 || p.some(n => typeof n !== 'number' || !Number.isFinite(n))) {
      fail(`corner ${i} must be [x, y] numbers`)
    }
    return [p[0], p[1]]
  })
}

async function loadConfig(configPath) {
  const abs = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath)
  const label = path.basename(abs)
  let raw
  try {
    raw = JSON.parse(await fs.readFile(abs, 'utf8'))
  } catch (err) {
    throw new Error(`${label}: could not read/parse config — ${err.message}`)
  }

  if (!raw.blank) throw new Error(`${label}: "blank" is required`)
  if (!raw.artwork) throw new Error(`${label}: "artwork" is required`)

  const blend = raw.blend ?? {}
  const mode = blend.mode ?? 'multiply'
  if (!BLEND_MODES.has(mode)) {
    throw new Error(`${label}: unknown blend mode "${mode}". Known: ${[...BLEND_MODES].join(', ')}`)
  }

  const name = raw.name || path.basename(abs, '.json')

  return {
    label,
    name,
    colorway: raw.colorway ?? '',
    blank: resolveRelative(raw.blank),
    artwork: resolveRelative(raw.artwork),
    quad: normalizeQuad(raw.printArea, label),
    displacement: raw.displacement?.map
      ? {
          map: resolveRelative(raw.displacement.map),
          // Pixels of push at full black/white. ~4–10 reads as cloth; higher
          // starts to look like the print is melting.
          strength: raw.displacement.strength ?? 6,
        }
      : null,
    blend: {
      mode,
      // Default 0.85: ink that reads as absorbed rather than stickered on.
      opacity: typeof blend.opacity === 'number' ? blend.opacity : 0.85,
    },
    // How much the garment's folds brighten/darken the ink. 0 disables.
    shading: raw.shading?.enabled === false
      ? null
      : { strength: raw.shading?.strength ?? 0.6 },
    fabricTexture: raw.fabricTexture?.enabled
      ? {
          opacity: raw.fabricTexture.opacity ?? 0.12,
          // Detail radius: features finer than this count as weave.
          detail: raw.fabricTexture.detail ?? 3,
          // Contrast boost on the extracted grain before it's faded back in.
          gain: raw.fabricTexture.gain ?? 2,
          blend: raw.fabricTexture.blend ?? 'overlay',
        }
      : null,
    output: {
      width: raw.output?.width ?? null,
      height: raw.output?.height ?? null,
      crop: raw.output?.crop ?? null,
      basename: raw.output?.basename ?? name,
    },
    sourcePath: abs,
  }
}

// ── Render ────────────────────────────────────────────────────────
async function rawRGBA(file) {
  const img = sharp(file).ensureAlpha()
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  return { data, width: info.width, height: info.height }
}

/**
 * Raw single-channel bytes from a pipeline.
 *
 * greyscale() changes the interpretation but doesn't guarantee raw() emits
 * one channel per pixel — it can still hand back 3 or 4. Everything here
 * indexes single-channel maps as data[y * w + x], so a 3-channel buffer
 * silently reads pixels at a third of the stride and smears the image.
 * Stride down explicitly rather than trusting the channel count.
 */
async function raw1(pipeline) {
  const { data, info } = await pipeline
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true })
  if (info.channels === 1) return { data, width: info.width, height: info.height }
  const out = Buffer.alloc(info.width * info.height)
  for (let i = 0; i < out.length; i++) out[i] = data[i * info.channels]
  return { data: out, width: info.width, height: info.height }
}

async function rawGray(file, width, height) {
  return raw1(
    sharp(file)
      .resize(width, height, { fit: 'fill' })
      .greyscale()
  )
}

/**
 * Lifts the blank's own weave — a high-pass of its luminance — and returns it
 * as a full-canvas PNG masked to the garment, ready to lay back over the
 * print. Masked because an unmasked overlay would paint the transparent
 * background and destroy the cut-out.
 */
async function buildFabricTexture(blankPath, cfg, width, height) {
  const gray = (await raw1(
    sharp(blankPath).flatten({ background: '#808080' }).greyscale()
  )).data

  // Anything broader than `detail` px is shading, not weave, so blur it away
  // and keep only the difference.
  const blurred = (await raw1(
    sharp(blankPath).flatten({ background: '#808080' }).greyscale().blur(cfg.detail)
  )).data

  const grain = highPassGrain(gray, blurred, width, height, cfg.gain)

  // Fade toward neutral 128 by the configured opacity, then clip to the
  // garment's own alpha so the background stays empty.
  const faded = Buffer.alloc(grain.length)
  for (let i = 0; i < grain.length; i++) {
    faded[i] = Math.round(128 + (grain[i] - 128) * cfg.opacity)
  }

  const alpha = await sharp(blankPath).ensureAlpha().extractChannel(3).raw().toBuffer()
  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = faded[i]
    rgba[i * 4 + 1] = faded[i]
    rgba[i * 4 + 2] = faded[i]
    rgba[i * 4 + 3] = alpha[i]
  }

  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer()
}

async function renderOne(cfg, { force = false } = {}) {
  for (const [labelName, file] of [['blank', cfg.blank], ['artwork', cfg.artwork]]) {
    if (!existsSync(file)) {
      throw new Error(`${cfg.label}: ${labelName} not found at ${path.relative(ROOT, file)}`)
    }
  }
  if (cfg.displacement && !existsSync(cfg.displacement.map)) {
    throw new Error(
      `${cfg.label}: displacement map not found at ${path.relative(ROOT, cfg.displacement.map)}\n` +
      `  Generate one with: node scripts/mockup/tools/derive-displacement.js <blank>`
    )
  }

  await fs.mkdir(OUT_DIR, { recursive: true })
  const pngPath = path.join(OUT_DIR, `${cfg.output.basename}@2x.png`)
  const webpPath = path.join(OUT_DIR, `${cfg.output.basename}.webp`)

  if (!force && (await isUpToDate(cfg, [pngPath, webpPath]))) {
    return { skipped: true, pngPath, webpPath }
  }

  const blank = await rawRGBA(cfg.blank)
  const art = await rawRGBA(cfg.artwork)

  const displacement = cfg.displacement
    ? { ...(await rawGray(cfg.displacement.map, blank.width, blank.height)), strength: cfg.displacement.strength }
    : null

  // 1. Perspective-warp the artwork into the print quad (+ fold displacement).
  let layer = warpIntoQuad(art, blank, cfg.quad, displacement)

  // 2. Let the garment's folds modulate the ink. Kept separate from the blend
  //    mode so light ink on a dark garment still picks up the drape.
  if (cfg.shading) {
    layer = applyShading(layer, blank.data, blank.width, blank.height, cfg.shading.strength)
  }

  // 3. Opacity, applied to alpha since composite() has no opacity option.
  layer = applyOpacity(layer, cfg.blend.opacity)

  const layerPng = await sharp(layer, {
    raw: { width: blank.width, height: blank.height, channels: 4 },
  }).png().toBuffer()

  // 4. Blend onto the garment.
  const composites = [{ input: layerPng, blend: cfg.blend.mode }]

  // 5. Optional weave overlay, lifted from this same blank and clipped to it.
  if (cfg.fabricTexture) {
    const texture = await buildFabricTexture(
      cfg.blank, cfg.fabricTexture, blank.width, blank.height
    )
    composites.push({ input: texture, blend: cfg.fabricTexture.blend })
  }

  let pipeline = sharp(cfg.blank).ensureAlpha().composite(composites)

  // 5. Crop, then size. Alpha is preserved end to end so the PNG stays cut out.
  if (cfg.output.crop) {
    const c = cfg.output.crop
    pipeline = sharp(await pipeline.png().toBuffer()).extract({
      left: Math.round(c.left ?? 0),
      top: Math.round(c.top ?? 0),
      width: Math.round(c.width),
      height: Math.round(c.height),
    })
  }

  const composited = await pipeline.png().toBuffer()
  const finalMeta = await sharp(composited).metadata()
  const outW = cfg.output.width ?? finalMeta.width
  const outH = cfg.output.height ?? null

  const resizeOpts = { fit: 'inside', withoutEnlargement: false }

  await sharp(composited)
    .resize(outW * 2, outH ? outH * 2 : null, resizeOpts)
    .png({ compressionLevel: 9 })
    .toFile(pngPath)

  await sharp(composited)
    .resize(outW, outH, resizeOpts)
    .webp({ quality: 90 })
    .toFile(webpPath)

  return { skipped: false, pngPath, webpPath }
}

/** Outputs are current when they're newer than every input that feeds them. */
async function isUpToDate(cfg, outputs) {
  try {
    const inputs = [cfg.sourcePath, cfg.blank, cfg.artwork]
    if (cfg.displacement) inputs.push(cfg.displacement.map)
    const inputTimes = await Promise.all(inputs.map(f => fs.stat(f).then(s => s.mtimeMs)))
    const outputTimes = await Promise.all(outputs.map(f => fs.stat(f).then(s => s.mtimeMs)))
    return Math.max(...inputTimes) < Math.min(...outputTimes)
  } catch {
    return false // missing output (or input) — render.
  }
}

// ── CLI ───────────────────────────────────────────────────────────
async function main() {
  const argv = process.argv.slice(2)
  const force = argv.includes('--force')
  const all = argv.includes('--all')
  const targets = argv.filter(a => !a.startsWith('--'))

  let configs
  if (all) {
    const entries = existsSync(CONFIG_DIR) ? await fs.readdir(CONFIG_DIR) : []
    configs = entries.filter(f => f.endsWith('.json')).map(f => path.join(CONFIG_DIR, f))
    if (configs.length === 0) {
      console.error('No configs found in scripts/mockup/config/.')
      process.exit(1)
    }
  } else if (targets.length > 0) {
    configs = targets
  } else {
    console.error(
      'Usage:\n' +
      '  node scripts/mockup/render.js <config.json> [--force]\n' +
      '  node scripts/mockup/render.js --all [--force]'
    )
    process.exit(1)
  }

  let failures = 0
  for (const configPath of configs) {
    const label = path.basename(configPath)
    try {
      const cfg = await loadConfig(configPath)
      const res = await renderOne(cfg, { force })
      if (res.skipped) {
        console.log(`•  ${label} — up to date (use --force to re-render)`)
      } else {
        console.log(`✓  ${label}`)
        console.log(`     ${path.relative(process.cwd(), res.pngPath)}`)
        console.log(`     ${path.relative(process.cwd(), res.webpPath)}`)
      }
    } catch (err) {
      failures++
      console.error(`✗  ${label}\n     ${err.message}`)
    }
  }

  if (failures > 0) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
