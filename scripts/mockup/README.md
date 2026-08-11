# Product mockup pipeline

Composites artwork onto a ghost-mannequin garment photo to produce product
images. Config-driven, so swapping the base garment is a JSON edit rather than
a code change.

**This is standalone.** Nothing here imports from `src/`, and nothing in the
site imports from here. Output lands in `out/` (gitignored) and is moved into
the site manually.

```
scripts/mockup/
  blanks/     base plate images (ghost-mannequin photos of empty garments)
  artwork/    logo / design source files
  config/     one JSON per garment + colorway
  out/        generated images (gitignored)
  lib/        homography + pixel maths
  tools/      helper scripts (displacement maps, placeholder blank)
  render.js   the pipeline
```

## Running it

```bash
node scripts/mockup/render.js config/house-tee-black-front.json
node scripts/mockup/render.js --all
node scripts/mockup/render.js --all --force
```

Each config produces two files in `out/`:

| File | Size | Use |
| --- | --- | --- |
| `<basename>@2x.png` | 2× `output.width`, transparent | retina / print / further editing |
| `<basename>.webp` | 1× `output.width`, transparent | web |

Re-running is safe. Outputs are skipped when they're newer than the config,
blank, artwork and displacement map that feed them — pass `--force` to
re-render anyway. A failing config exits non-zero and never leaves a partial
file behind.

`sharp` is a devDependency; it is not used by the site at runtime.

## The worked example

`config/house-tee-black-front.json` renders the OK monogram onto a **synthetic
placeholder blank** so the pipeline can be run before real photography exists:

```bash
node scripts/mockup/tools/make-placeholder-blank.js
node scripts/mockup/tools/derive-displacement.js scripts/mockup/blanks/tee-front-black.png
node scripts/mockup/render.js --all --force
```

The placeholder is deterministic (fixed noise seed), so re-running produces an
identical blank and nothing downstream churns. It is a stand-in for calibration
only — replace it with a real cut-out garment shot and the same config keeps
working.

---

## Adding a new blank

1. **Shoot or source the garment** empty, on a ghost mannequin, lit flat and
   even. Shoot it larger than you need: the blank should be at least **2×**
   your intended `output.width`, since the 2× PNG is rendered from it.

2. **Cut out the background** so everything outside the garment is fully
   transparent, and save as PNG into `blanks/`. The pipeline preserves that
   alpha end to end — a white background baked into the blank becomes a white
   background in your product image, and the fabric-texture pass will key off
   the wrong alpha.

3. **Derive its displacement map** (see below).

4. **Copy an existing config** in `config/`, point `blank` and `displacement.map`
   at the new files, and recalibrate `printArea`.

5. Render with `--force` and look at it.

Blanks and their maps are committed; only `out/` is ignored. Keep one config
per garment **and colorway** — a black tee and a white tee want different
`blend.mode` (see *Choosing a blend* below), so they are separate files even
when the print area is identical.

## Deriving a displacement map

The displacement map is what makes the print follow the cloth instead of
floating on top of it. It is just the garment's own shading: dark where the
fabric creases, light where it bulges toward the camera.

```bash
node scripts/mockup/tools/derive-displacement.js scripts/mockup/blanks/my-tee.png
node scripts/mockup/tools/derive-displacement.js scripts/mockup/blanks/my-tee.png --blur 16
```

Writes `<blank>.displacement.png` beside the source. The tool greyscales the
photo, flattens it onto mid-grey (so the transparent surround reads as "no
displacement" rather than a cliff at the garment edge), blurs it, and
normalises the result.

**Blur is the important knob.** It decides what counts as a fold:

- **too low (< 5)** — weave, seams and stitching start pushing pixels around,
  which reads as noise rather than cloth
- **8–16** — the useful range for a garment photographed at 1500–2500px
- **too high (> 30)** — only the broadest light gradient survives and the print
  stops reacting to individual folds

Then tune `displacement.strength` in the config — it is the **number of pixels
of push** at full black/white:

- `0` — disables displacement entirely
- `4–10` — reads as fabric
- `> 15` — the print visibly melts

If a fold runs straight through your artwork and the artwork doesn't bend at
all, raise `strength`. If straight edges in the artwork look chewed, lower it.

## Calibrating the printArea quad

`printArea` is four corner points, **in pixels on the blank**, describing the
quad the artwork is mapped into. Order is clockwise from top-left:

```json
"printArea": {
  "topLeft":     [610, 690],
  "topRight":    [1000, 690],
  "bottomRight": [1010, 1090],
  "bottomLeft":  [600, 1090]
}
```

An array of four `[x, y]` pairs in the same order also works.

**To read the numbers off a photo:** open the blank in any editor that shows a
cursor position (Preview, Photoshop, GIMP, Figma, even Windows Paint) and hover
each corner of where the print should sit. Note that these are coordinates on
the **blank at its native size**, not on the cropped output.

Some guidance:

- The quad does not need to be a rectangle — that's the point. Skewing the two
  bottom corners inward or outward follows the garment's taper, and shifting
  one side up or down follows a shoulder tilt. A perfectly rectangular quad on
  a photographed garment is what makes a mockup look pasted on.
- **Match the aspect ratio of your artwork.** The artwork is stretched to fill
  the quad, so a square logo in a 2:1 quad comes out squashed. Size the quad to
  the art, or pad the artwork file.
- Start rectangular, render, then nudge corners 10–20px at a time. Corner
  errors are much easier to see in the render than in the numbers.
- Four collinear or coincident points are rejected with a clear error rather
  than producing garbage.

## Choosing a blend

`blend.mode` is any libvips blend mode: `over`, `multiply`, `screen`,
`overlay`, `darken`, `lighten`, `colour-dodge`, `colour-burn`, `hard-light`,
`soft-light`, `difference`, `exclusion`.

The pipeline default is **`multiply` at `0.85`**, which is correct for **dark
ink on a light garment** — the fabric's shadows fall through the ink and it
reads as absorbed rather than stickered on.

**It is the wrong choice for light ink on a dark garment.** Multiplying red
ink against a near-black tee crushes it to mud. For dark garments use `over`
and let the `shading` pass carry the realism:

```json
"blend":   { "mode": "over", "opacity": 0.92 },
"shading": { "enabled": true, "strength": 0.75 }
```

`shading` modulates the ink's brightness by the garment's own folds, pivoting
on the **mean** luminance under the print — so a dark garment darkens the ink's
creases and lights its ridges without flattening the whole thing. It works on
any garment colour and is what actually sells the print as printed. Set
`"enabled": false` to turn it off.

## Fabric texture

```json
"fabricTexture": {
  "enabled": true,
  "opacity": 0.35,
  "detail": 3,
  "gain": 2,
  "blend": "overlay"
}
```

Lifts the blank's own weave — a high-pass of its luminance — and lays it back
over the print so the ink picks up the same grain as the cloth. It is taken
from the blank itself rather than a tiled swatch, so there are no repeat seams
and it stays registered with the garment.

- `detail` — features finer than this radius count as weave; larger values pull
  in broader shading you probably don't want
- `gain` — contrast boost on the extracted grain
- `opacity` — how much of it survives; `0.2–0.4` is usually plenty

It is clipped to the garment's alpha, so it never paints the transparent
background.

## Output

```json
"output": {
  "basename": "house-tee-black-front",
  "width": 1000,
  "crop": { "left": 120, "top": 210, "width": 1360, "height": 1700 }
}
```

`crop` is applied to the composite at blank resolution, before resizing —
use it to trim dead space around the garment. `width` is the **1× web** width;
the PNG is written at twice that. `height` is optional; omit it to preserve
aspect ratio.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| Print looks pasted on | `displacement.strength` too low, or `shading` disabled |
| Print looks melted | `displacement.strength` too high, or displacement blur too low |
| Ink is muddy / nearly invisible on a dark garment | `multiply` on a dark blank — switch to `over` + `shading` |
| Background isn't transparent | The blank has a baked-in background; re-cut it |
| Artwork squashed | Quad aspect ratio doesn't match the artwork's |
| Grey haze over the whole garment | `fabricTexture.detail` too large, pulling shading into the grain |
| Nothing re-renders | Outputs are newer than inputs — pass `--force` |
