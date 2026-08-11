const { computeHomography, applyHomography, boundingBox } = require('./homography.js')

/**
 * Warps artwork into a four-corner quad on a destination canvas, optionally
 * pushing pixels around with a displacement map so the print follows the
 * garment's folds.
 *
 * Works by inverse mapping: for every destination pixel inside the quad we
 * ask "where in the artwork did this come from?" and sample there. That
 * leaves no holes, which forward mapping would.
 *
 * @param {object} art     { data: Buffer(RGBA), width, height }
 * @param {object} canvas  { width, height } of the destination
 * @param {number[][]} quad  4 × [x,y] in TL, TR, BR, BL order
 * @param {object|null} displacement { data: Buffer(gray), width, height, strength }
 * @returns {Buffer} RGBA buffer sized to the canvas
 */
function warpIntoQuad(art, canvas, quad, displacement = null) {
  const { width: cw, height: ch } = canvas
  const out = Buffer.alloc(cw * ch * 4)

  // Transparent pixels are left WHITE rather than black. Multiply blending
  // treats white as identity, so any area outside the print stays untouched
  // even if the compositor ignores alpha for the blend maths.
  out.fill(255)
  for (let i = 3; i < out.length; i += 4) out[i] = 0

  const sw = art.width
  const sh = art.height

  // Destination → source, so we can sample rather than scatter.
  const srcCorners = [
    [0, 0],
    [sw, 0],
    [sw, sh],
    [0, sh],
  ]
  const inv = computeHomography(quad, srcCorners)

  const box = boundingBox(quad, cw, ch)

  const disp = displacement
  const dStrength = disp?.strength ?? 0
  const dw = disp?.width ?? 0
  const dh = disp?.height ?? 0

  for (let y = box.top; y < box.bottom; y++) {
    for (let x = box.left; x < box.right; x++) {
      let dx = x + 0.5
      let dy = y + 0.5

      if (disp && dStrength !== 0) {
        // Offset along the local gradient of the map: ink slides down into
        // creases and stretches over ridges, instead of smearing uniformly.
        const [gx, gy] = sampleGradient(disp.data, dw, dh, (x / cw) * dw, (y / ch) * dh)
        dx += gx * dStrength
        dy += gy * dStrength
      }

      const [u, v] = applyHomography(inv, dx, dy)
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue
      if (u < 0 || v < 0 || u >= sw || v >= sh) continue

      const px = bilinear(art.data, sw, sh, u, v)
      if (px[3] === 0) continue

      const o = (y * cw + x) * 4
      out[o] = px[0]
      out[o + 1] = px[1]
      out[o + 2] = px[2]
      out[o + 3] = px[3]
    }
  }

  return out
}

/** Bilinear RGBA sample. Returns [r,g,b,a]. */
function bilinear(data, w, h, x, y) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(x0 + 1, w - 1)
  const y1 = Math.min(y0 + 1, h - 1)
  const fx = x - x0
  const fy = y - y0

  const i00 = (y0 * w + x0) * 4
  const i10 = (y0 * w + x1) * 4
  const i01 = (y1 * w + x0) * 4
  const i11 = (y1 * w + x1) * 4

  const out = [0, 0, 0, 0]
  for (let c = 0; c < 4; c++) {
    const top = data[i00 + c] * (1 - fx) + data[i10 + c] * fx
    const bot = data[i01 + c] * (1 - fx) + data[i11 + c] * fx
    out[c] = Math.round(top * (1 - fy) + bot * fy)
  }
  return out
}

/**
 * Central-difference gradient of a single-channel map, normalised to roughly
 * [-1, 1]. Positive x points toward brighter pixels (a ridge).
 */
function sampleGradient(data, w, h, x, y) {
  if (w === 0 || h === 0) return [0, 0]
  const xi = Math.max(1, Math.min(w - 2, Math.round(x)))
  const yi = Math.max(1, Math.min(h - 2, Math.round(y)))
  const at = (px, py) => data[py * w + px] / 255
  const gx = (at(xi + 1, yi) - at(xi - 1, yi)) / 2
  const gy = (at(xi, yi + 1) - at(xi, yi - 1)) / 2
  return [gx, gy]
}

/**
 * Scales every alpha value by `opacity` (0–1), in place on a copy.
 * Used instead of a compositor opacity option, which sharp doesn't expose.
 */
function applyOpacity(rgba, opacity) {
  if (opacity >= 1) return rgba
  const out = Buffer.from(rgba)
  const k = Math.max(0, opacity)
  for (let i = 3; i < out.length; i += 4) out[i] = Math.round(out[i] * k)
  return out
}

/**
 * Modulates the artwork's brightness by the garment's own shading, so the
 * print dips into creases and catches light on ridges.
 *
 * The pivot is the MEAN luminance under the print, not absolute black, so a
 * dark garment doesn't simply crush the ink — folds push it above and below
 * its own average instead. That's what makes this work on a black tee, where
 * a plain multiply would flatten a red print into mud.
 */
function applyShading(layer, blank, width, height, strength) {
  if (!strength) return layer
  const out = Buffer.from(layer)

  // Mean garment luminance wherever the print actually lands.
  let sum = 0
  let count = 0
  for (let i = 0; i < width * height; i++) {
    if (out[i * 4 + 3] === 0) continue
    const o = i * 4
    sum += 0.299 * blank[o] + 0.587 * blank[o + 1] + 0.114 * blank[o + 2]
    count++
  }
  if (count === 0) return out
  const mean = sum / count

  for (let i = 0; i < width * height; i++) {
    const o = i * 4
    if (out[o + 3] === 0) continue
    const luma = 0.299 * blank[o] + 0.587 * blank[o + 1] + 0.114 * blank[o + 2]
    // Deviation from the local average, scaled. 4× keeps a subtle photo's
    // fold range visible without blowing out.
    let f = 1 + ((luma - mean) / 255) * strength * 4
    if (f < 0.2) f = 0.2
    if (f > 2) f = 2
    out[o] = Math.min(255, Math.round(out[o] * f))
    out[o + 1] = Math.min(255, Math.round(out[o + 1] * f))
    out[o + 2] = Math.min(255, Math.round(out[o + 2] * f))
  }
  return out
}

/**
 * High-pass of the blank's own luminance — its weave and grain, with the
 * broad shading removed. Returned as a single-channel buffer centred on 128
 * so it's a no-op under an overlay blend where the cloth is smooth.
 *
 * Preferred over tiling a sampled patch: no seams, and it stays registered
 * with the garment it came from.
 */
function highPassGrain(gray, blurred, width, height, gain) {
  const out = Buffer.alloc(width * height)
  for (let i = 0; i < out.length; i++) {
    const v = 128 + (gray[i] - blurred[i]) * gain
    out[i] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v)
  }
  return out
}

module.exports = { warpIntoQuad, applyOpacity, applyShading, highPassGrain }
