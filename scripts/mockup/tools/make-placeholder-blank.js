#!/usr/bin/env node
/**
 * Synthesises a stand-in "ghost mannequin" tee so the pipeline can be run and
 * tuned before real product photography exists.
 *
 *   node scripts/mockup/tools/make-placeholder-blank.js
 *   node scripts/mockup/tools/make-placeholder-blank.js --colour "#1c1a19" --name tee-front-black
 *
 * This is NOT a substitute for a real photo — it exists so printArea numbers,
 * displacement strength and blend settings can be calibrated against
 * something. Swap in a real cut-out garment shot and the config keeps working.
 *
 * Deterministic: the fold and weave noise come from a fixed seed, so re-running
 * produces a byte-identical blank and nothing downstream churns.
 */

const path = require('node:path')
const fs = require('node:fs/promises')
const sharp = require('sharp')

const ROOT = path.dirname(__dirname)
const W = 1600
const H = 2000

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

/** Small deterministic PRNG so the weave is identical run to run. */
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TEE_PATH =
  'M560,300 C640,400 960,400 1040,300 L1300,380 L1420,720 L1200,800 ' +
  'L1170,1750 L430,1750 L400,800 L180,720 L300,380 Z'

/** Garment silhouette: white where cloth is, transparent elsewhere. */
function silhouetteSvg() {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
       <path d="${TEE_PATH}" fill="#ffffff"/>
     </svg>`
  )
}

/**
 * Broad tonal structure — the folds. Mid-grey is "flat cloth"; darker blobs
 * are creases, lighter ones are the ridges catching light. Blurred hard later
 * so only the large shapes survive.
 */
function foldsSvg() {
  // Cloth hangs in narrow vertical folds, so these are thin and tall rather
  // than one big blob — a single wide ellipse blurs into a rounded rectangle
  // and reads as a lighting bug, not drape.
  const fold = (cx, cy, rx, ry, fill, rot = 0) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}"` +
    (rot ? ` transform="rotate(${rot} ${cx} ${cy})"` : '') + '/>'

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
       <rect width="${W}" height="${H}" fill="#808080"/>
       <!-- vertical drape down the body: alternating catch-light and crease -->
       ${fold(690, 980, 55, 430, '#9d9d9d', -2)}
       ${fold(800, 940, 60, 470, '#a6a6a6')}
       ${fold(905, 990, 52, 420, '#9a9a9a', 2)}
       ${fold(745, 1120, 40, 380, '#666666', -3)}
       ${fold(860, 1150, 38, 360, '#6a6a6a', 3)}
       <!-- torso sides fall away from the light -->
       ${fold(470, 1050, 120, 460, '#5c5c5c')}
       ${fold(1130, 1050, 120, 460, '#5c5c5c')}
       <!-- sleeve shadows -->
       ${fold(345, 700, 130, 150, '#585858', -20)}
       ${fold(1255, 700, 130, 150, '#585858', 20)}
       <!-- slack gathering toward the hem -->
       ${fold(640, 1560, 90, 150, '#6d6d6d', -12)}
       ${fold(980, 1600, 100, 140, '#8f8f8f', 14)}
       ${fold(800, 1690, 190, 90, '#6b6b6b')}
       ${fold(880, 1330, 240, 55, '#8c8c8c', -9)}
       ${fold(720, 1210, 220, 48, '#747474', 7)}
       <!-- neck rib casts down onto the chest -->
       ${fold(800, 400, 235, 60, '#565656')}
     </svg>`
  )
}

/** Fine weave. Deterministic noise, lightly blurred so it reads as cloth. */
async function weaveBuffer() {
  const rnd = mulberry32(1954) // fixed seed → identical weave every run
  const data = Buffer.alloc(W * H)
  for (let i = 0; i < data.length; i++) {
    data[i] = 118 + Math.round(rnd() * 20)
  }
  return sharp(data, { raw: { width: W, height: H, channels: 1 } })
    .blur(0.8)
    .png()
    .toBuffer()
}

/** raw() may hand back 3 or 4 channels even after greyscale — take channel 0. */
function strideTo1({ data, info }) {
  if (info.channels === 1) return data
  const out = Buffer.alloc(info.width * info.height)
  for (let i = 0; i < out.length; i++) out[i] = data[i * info.channels]
  return out
}

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ]
}

async function main() {
  const colour = arg('--colour', arg('--color', '#1c1a19'))
  const name = arg('--name', 'tee-front-black')
  const outDir = path.join(ROOT, 'blanks')
  await fs.mkdir(outDir, { recursive: true })
  const outPath = path.join(outDir, `${name}.png`)

  // Folds blurred so the ellipse edges disappear, leaving only drape.
  const foldsRaw = await sharp(foldsSvg())
    .blur(38)
    .toColourspace('b-w')
    .raw()
    .toBuffer({ resolveWithObject: true })
  const folds = strideTo1(foldsRaw)
  const weave = strideTo1(
    await sharp(await weaveBuffer()).toColourspace('b-w').raw().toBuffer({ resolveWithObject: true })
  )

  const base = hexToRgb(colour)

  // Shading is applied as arithmetic rather than a blend mode on purpose.
  // hard-light/overlay against a near-black garment screen it up into a grey
  // blob; a multiplicative term plus a small additive highlight keeps a black
  // tee black while still showing where the cloth catches light.
  const rgb = Buffer.alloc(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    const f = folds[i] / 255 - 0.5           // -0.5 (crease) … +0.5 (ridge)
    const n = (weave[i] - 128) / 255         // fine weave, tiny
    const mul = 1 + f * 1.0
    const add = f * 90 + n * 26
    const o = i * 4
    for (let c = 0; c < 3; c++) {
      const v = base[c] * mul + add
      rgb[o + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v)
    }
    rgb[o + 3] = 255
  }

  const shaded = await sharp(rgb, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toBuffer()

  // Punch out the garment shape so the blank is a clean cut-out.
  const mask = await sharp(silhouetteSvg()).png().toBuffer()
  await sharp(shaded)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(outPath)

  console.log(`✓ placeholder blank → ${path.relative(process.cwd(), outPath)} (${W}×${H})`)
  console.log('  Next: derive its displacement map')
  console.log(`    node scripts/mockup/tools/derive-displacement.js scripts/mockup/blanks/${name}.png`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
