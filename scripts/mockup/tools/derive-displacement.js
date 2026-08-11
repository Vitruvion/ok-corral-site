#!/usr/bin/env node
/**
 * Derives a displacement map from a garment photo.
 *
 *   node scripts/mockup/tools/derive-displacement.js blanks/my-tee.png
 *   node scripts/mockup/tools/derive-displacement.js blanks/my-tee.png --blur 12
 *
 * The map is just the blank's own shading: where the photo goes dark there's
 * a crease, where it goes bright there's a ridge. Blurring throws away weave
 * and print detail so only the large fold structure survives, and normalising
 * stretches that structure back across the full range.
 *
 * Writes <blank>.displacement.png next to the source unless -o is given.
 */

const path = require('node:path')
const { existsSync } = require('node:fs')
const sharp = require('sharp')

function arg(flag, fallback) {
  const i = process.argv.indexOf(flag)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

async function main() {
  const input = process.argv.slice(2).find(a => !a.startsWith('--') && !a.startsWith('-o'))
  if (!input) {
    console.error('Usage: derive-displacement.js <garment-image> [--blur N] [-o out.png]')
    process.exit(1)
  }
  if (!existsSync(input)) {
    console.error(`Not found: ${input}`)
    process.exit(1)
  }

  // Bigger blur = only broad folds drive the warp. Small blur lets weave and
  // seams push pixels around, which reads as noise rather than cloth.
  const blur = Number(arg('--blur', 10))
  const parsed = path.parse(input)
  const output = arg('-o', path.join(parsed.dir, `${parsed.name}.displacement.png`))

  await sharp(input)
    .greyscale()
    // Flatten onto mid-grey so transparent surroundings read as "no
    // displacement" rather than as a hard black cliff at the garment edge.
    .flatten({ background: '#808080' })
    .blur(blur)
    .normalise()
    .png()
    .toFile(output)

  const meta = await sharp(output).metadata()
  console.log(`✓ displacement map → ${output}  (${meta.width}×${meta.height}, blur ${blur})`)
  console.log('  Point your config at it:')
  console.log(`    "displacement": { "map": "${path.relative(path.join(process.cwd(), 'scripts/mockup'), output).replace(/\\/g, '/')}", "strength": 6 }`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
