/**
 * Planar homography helpers for the mockup pipeline.
 *
 * sharp/libvips can do affine transforms but not a general four-corner
 * perspective warp, so the quad mapping is done here on raw pixel buffers.
 *
 * CommonJS on purpose: the repo has no "type": "module", and this pipeline
 * must not require changes to package.json.
 */

/** Solves an n×n linear system by Gauss-Jordan elimination with partial pivoting. */
function solve(A, b) {
  const n = b.length
  // Work on copies so callers keep their inputs.
  const M = A.map((row, i) => [...row, b[i]])

  for (let col = 0; col < n; col++) {
    // Pivot on the largest magnitude row to keep the elimination stable.
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r
    }
    if (Math.abs(M[pivot][col]) < 1e-12) {
      throw new Error(
        'Degenerate printArea: the four corners must not be collinear or coincident.'
      )
    }
    if (pivot !== col) {
      const tmp = M[col]
      M[col] = M[pivot]
      M[pivot] = tmp
    }

    const p = M[col][col]
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col] / p
      if (f === 0) continue
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }

  // Full Gauss-Jordan leaves M diagonal, so each unknown is a single divide.
  return M.map((row, i) => row[n] / row[i])
}

/**
 * Homography mapping four `src` points onto four `dst` points.
 * Points are [x, y]; order must correspond between the two arrays.
 * Returns [h0..h7] with the implied h8 = 1.
 */
function computeHomography(src, dst) {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error('computeHomography needs exactly 4 source and 4 destination points.')
  }

  const A = []
  const b = []
  for (let i = 0; i < 4; i++) {
    const x = src[i][0]
    const y = src[i][1]
    const X = dst[i][0]
    const Y = dst[i][1]
    A.push([x, y, 1, 0, 0, 0, -x * X, -y * X])
    b.push(X)
    A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y])
    b.push(Y)
  }
  return solve(A, b)
}

/** Applies a homography to a point, returning [x, y]. */
function applyHomography(h, x, y) {
  const d = h[6] * x + h[7] * y + 1
  // Guard against the projective line at infinity.
  if (Math.abs(d) < 1e-12) return [NaN, NaN]
  return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d]
}

/** Axis-aligned integer bounding box of a set of points, clamped to a canvas. */
function boundingBox(points, width, height) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const p of points) {
    if (p[0] < minX) minX = p[0]
    if (p[1] < minY) minY = p[1]
    if (p[0] > maxX) maxX = p[0]
    if (p[1] > maxY) maxY = p[1]
  }
  return {
    left: Math.max(0, Math.floor(minX)),
    top: Math.max(0, Math.floor(minY)),
    right: Math.min(width, Math.ceil(maxX)),
    bottom: Math.min(height, Math.ceil(maxY)),
  }
}

module.exports = { computeHomography, applyHomography, boundingBox }
