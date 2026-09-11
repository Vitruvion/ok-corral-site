#!/usr/bin/env node
/**
 * Resizes the site's photos to the size they are actually displayed at.
 *
 *   node scripts/resize-assets.mjs                # in place, under public/
 *   node scripts/resize-assets.mjs --from <dir>   # re-derive from originals
 *   node scripts/resize-assets.mjs --dry-run      # measure only, write nothing
 *
 * ═══════════════════════════════════════════════════════════════════
 * WHY. Vercel stores the whole of public/ in every deployment. These were
 * camera originals -- one was 6336x9504 and 58 MB -- rendered into grid
 * tiles a few hundred pixels wide. Every deploy carried ~270 MB of them.
 *
 * SAME PATH, SAME NAME, SAME EXTENSION. Every URL in src/lib/data.ts, the
 * CSS, and the events/merch rows in Supabase keeps pointing at a valid
 * file. Nothing here converts a format; a .png stays a PNG.
 *
 * ORIENTATION. Several are phone photos that store their pixels sideways
 * and rely on an EXIF tag to display upright. rotate() applies that tag to
 * the pixels BEFORE metadata is stripped -- strip first and the photo
 * turns sideways with nothing left to say it should not.
 *
 * COLOUR. sharp's default output converts to sRGB using any embedded ICC
 * profile and then drops the profile, so a Display-P3 phone photo keeps
 * its colours rather than being reinterpreted as sRGB.
 *
 * RE-RUNNABLE WITHOUT GENERATION LOSS. In place, a file already within
 * its target edge is skipped, not re-encoded -- running this twice must
 * not recompress a JPEG twice. To try different settings, pass --from
 * pointing at a directory of originals laid out like public/ (e.g. the
 * backup at ../ok-corral-original-assets, which holds assets/...); every
 * file is then re-derived from its original.
 * ═══════════════════════════════════════════════════════════════════
 */
import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const GALLERY = 2400
const HERO = 2560
const ART = 1600

/** [path under public/, long-edge target in px] */
const TARGETS = [
  ['assets/gallery/patio-cigars.jpg', GALLERY],
  ['assets/gallery/boys-at-bar.jpg', GALLERY],
  ['assets/gallery/customer-805.jpg', GALLERY],
  ['assets/gallery/patio-night.jpg', GALLERY],
  ['assets/gallery/camel-sign.jpg', GALLERY],
  ['assets/gallery/cowboy-pool-2.jpg', GALLERY],
  ['assets/gallery/cowgirls.jpg', GALLERY],
  ['assets/gallery/pool-nails.jpg', GALLERY],
  ['assets/gallery/crowd-stage.jpg', GALLERY],
  ['assets/gallery/car-show.jpg', GALLERY],
  ['assets/gallery/performer.jpg', GALLERY],
  ['assets/gallery/pool-table.jpg', GALLERY],
  // Also the full-bleed background of /card's hero.
  ['assets/gallery/cowboy-bar.jpg', GALLERY],
  ['assets/gallery/back-bar-girls.jpg', GALLERY],
  ['assets/gallery/pool-shot.jpg', GALLERY],
  ['assets/gallery/dollar-ceiling.jpg', GALLERY],
  // The homepage hero and the age-gate background.
  ['assets/gallery/storefront.jpg', HERO],
  ['assets/posters/dustin-gaspard.jpg', ART],
  ['assets/merch/hucklebeer-art.png', ART],
]

/**
 * Deliberately NOT processed. The two PNG event posters were left alone
 * at Brady's direction. Listed so the omission is visible rather than
 * looking like an oversight.
 */
const HELD = ['assets/events/barjaybar.png', 'assets/events/bad-dog-collab-v2.png']

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const fromIdx = args.indexOf('--from')
const fromDir = fromIdx >= 0 ? args[fromIdx + 1] : null
if (fromIdx >= 0 && !fromDir) {
  console.error('--from needs a directory')
  process.exit(2)
}

const PUBLIC = path.resolve('public')
if (!fs.existsSync(path.join(PUBLIC, 'assets'))) {
  console.error('Run from the repo root: public/assets not found.')
  process.exit(2)
}

/** Displayed dimensions: EXIF orientations 5-8 are stored rotated 90deg. */
function upright(meta) {
  const swap = (meta.orientation ?? 1) >= 5
  return swap ? { w: meta.height, h: meta.width } : { w: meta.width, h: meta.height }
}

async function encode(input, ext, edge) {
  const img = sharp(input)
    .rotate() // apply EXIF orientation to the pixels, before it is stripped
    .resize({ width: edge, height: edge, fit: 'inside', withoutEnlargement: true })
  // No withMetadata(): EXIF, XMP, IPTC and the ICC profile are all dropped.
  return ext === '.png'
    ? img.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer()
    : img.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
}

/** Write via a temp file and rename, so a crash cannot leave half a JPEG. */
function replace(dest, buf) {
  const tmp = dest + '.resize-tmp'
  fs.writeFileSync(tmp, buf)
  fs.renameSync(tmp, dest)
}

const rows = []
let failures = 0

for (const [rel, edge] of TARGETS) {
  const dest = path.join(PUBLIC, rel)
  const src = fromDir ? path.resolve(fromDir, rel) : dest
  const ext = path.extname(rel).toLowerCase()
  try {
    if (!fs.existsSync(src)) throw new Error(`source missing: ${src}`)
    const input = fs.readFileSync(src)
    const inMeta = await sharp(input).metadata()
    const before = upright(inMeta)
    const notes = []
    if ((inMeta.orientation ?? 1) !== 1) notes.push(`EXIF orientation ${inMeta.orientation} applied`)
    if (inMeta.icc) notes.push('ICC -> sRGB')

    // In place and already within target: leave the bytes alone.
    if (!fromDir && Math.max(before.w, before.h) <= edge) {
      rows.push({ rel, before, after: before, beforeKB: input.length / 1024, afterKB: input.length / 1024, note: 'skipped: already within target' })
      continue
    }

    const out = await encode(input, ext, edge)
    const outMeta = await sharp(out).metadata()
    const after = { w: outMeta.width, h: outMeta.height }

    // Belt and braces on the two things that matter most.
    if (outMeta.orientation && outMeta.orientation !== 1) throw new Error('orientation tag survived')
    if (outMeta.exif || outMeta.icc || outMeta.xmp || outMeta.iptc) throw new Error('metadata survived')
    if (Math.sign(after.w - after.h) !== Math.sign(before.w - before.h)) {
      throw new Error(`aspect flipped: ${before.w}x${before.h} -> ${after.w}x${after.h}`)
    }

    if (!dryRun) replace(dest, out)
    rows.push({ rel, before, after, beforeKB: input.length / 1024, afterKB: out.length / 1024, note: notes.join('; ') })
  } catch (err) {
    failures++
    rows.push({ rel, before: null, after: null, beforeKB: 0, afterKB: 0, note: `ERROR: ${err.message}` })
  }
}

const dim = d => (d ? `${d.w}x${d.h}` : '-')
const kb = n => Math.round(n).toLocaleString('en-US')
console.log(`\n${dryRun ? 'DRY RUN -- nothing written. ' : ''}${fromDir ? `Source: ${fromDir}` : 'Source: public/ (in place)'}\n`)
console.log(`${'path'.padEnd(36)} ${'before'.padStart(10)} ${'after'.padStart(10)} ${'before KB'.padStart(10)} ${'after KB'.padStart(9)}  notes`)
console.log('-'.repeat(110))
let tb = 0, ta = 0
for (const r of rows) {
  tb += r.beforeKB
  ta += r.afterKB
  console.log(`${r.rel.padEnd(36)} ${dim(r.before).padStart(10)} ${dim(r.after).padStart(10)} ${kb(r.beforeKB).padStart(10)} ${kb(r.afterKB).padStart(9)}  ${r.note}`)
}
console.log('-'.repeat(110))
console.log(`${'TOTAL'.padEnd(36)} ${''.padStart(10)} ${''.padStart(10)} ${kb(tb).padStart(10)} ${kb(ta).padStart(9)}  saved ${kb(tb - ta)} KB (${((1 - ta / tb) * 100).toFixed(1)}%)`)
console.log(`\nHeld back, not processed: ${HELD.join(', ')}`)

if (failures) {
  console.error(`\n${failures} file(s) failed -- see ERROR rows. Files that failed were not written.`)
  process.exit(1)
}
