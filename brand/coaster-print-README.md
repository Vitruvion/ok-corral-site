# OK Corral coasters — print-ready files

Print-ready PDFs for double-sided 3.5" round pulpboard coasters.

## Files

- **`coaster-side-a-bullseye.pdf`** — Front side: brand bullseye with
  "THE OK CORRAL SALOON" (top arc), "COTTONWOOD CALIFORNIA" (bottom
  arc), "3633 MAIN ST" (down the left side), and the bullseye target
  in the center.
- **`coaster-side-b-monogram.pdf`** — Back side: the hand-drawn OK
  monogram in white on solid black.
- **`ok-corral-coaster-source.png`** — Source artwork (both designs
  side-by-side on white). Reference only — the PDFs are derived from
  this via `tmp-coasters/build_coasters.py` (not checked in).

## File specs

| | Value |
|---|---|
| Trim size | 3.5" diameter circle (89 mm) |
| Bleed | 0.125" (3.18 mm) on all sides |
| Bleed canvas | 3.75" × 3.75" square (2250 × 2250 px @ 600 DPI) |
| PDF page size | 4.0" × 4.0" (= bleed canvas + 0.125" white margin for crop marks) |
| Safe zone | 0.125" inside the trim line (text + key details kept further inside) |
| Color | Pure 1-bit black-and-white (no greyscale, no anti-aliasing artifacts) |
| Crop marks | 4-corner L-shapes, vector, in the white margin around the bleed |

The black "bleed" extends all the way to the edges of the 3.75" bleed
canvas. The 3.5" trim circle sits inside the canvas with 0.125" of
guaranteed black around it — so even if the die-cut drifts slightly,
no white edge appears on the finished coaster.

The text and bullseye target sit comfortably inside the safe zone
(visible content is at radii ≤ 0.125" inside the trim line), so the
die-cut tolerance won't clip anything important.

## What to tell the print shop

> Hi! Looking for a quote on **3.5" round pulpboard coasters,
> double-sided printing, two different designs** (front + back files
> attached). Black ink only on both sides.
>
> Recommended weight: **1/40 pt pulpboard** (standard absorbent bar
> coaster). I'm flexible on weight as long as it absorbs liquid like
> a regular bar coaster.
>
> Files are 4" × 4" PDFs containing a 3.75" × 3.75" black bleed
> canvas with crop marks indicating the 3.5" trim circle. Bleed is
> 0.125" past trim on all sides. Pure black-and-white, no greyscale.
>
> Please confirm before printing if any rework is needed.

## Recommended print services

Most run pulpboard coasters in quantities of 50 → 5,000+. Prices below
are ballpark for 250–500 unit orders at 1/40 pt pulpboard, double-sided,
1-color (black) print.

| Service | Notes | Typical price (250–500) |
|---|---|---|
| **StickerMule** | Coaster product line, fast turnaround (~5 business days), good for small repeat orders. Generally premium pricing. | $0.35–0.50 ea |
| **VistaPrint** | Cheap, larger quantities, slower turnaround (~2 weeks). Quality is consistent for basic 1-color jobs. | $0.15–0.30 ea |
| **Sticker You** | Premium, smaller batches OK, customer support strong on artwork checks. | $0.40–0.60 ea |
| **Coaster Stop** ([coasterstop.com](https://www.coasterstop.com/)) | Coaster-specialist; great pulpboard stock, design checks included. | $0.20–0.40 ea |
| **The 4 Over** ([4over.com](https://www.4over.com/)) | Wholesale-style; better for ≥1,000 unit orders. | $0.10–0.20 ea |
| Local (Redding / Anderson) | Worth a call — Bertelsen Printing in Redding (`(530) 243-2820`) and Anderson Sign & Print have done bar specialty orders before. Premium for small batches but support's hands-on. | varies |

Order quantity guideline for a single-location bar: **250–500** is a
typical first run. Coasters get lost/discarded/taken-home fast — plan
for ~1 coaster per beer served. At a busy bar that's 500–1,500 per
week.

## Regenerating the PDFs

Source pipeline lives in `tmp-coasters/build_coasters.py` (not
committed; reconstructed from the source PNG when needed).

```bash
# Once: install build deps at user level
python -m pip install --user pillow reportlab pypdfium2

# Then re-run from the project root
python tmp-coasters/build_coasters.py
```

The script:
1. Loads `brand/ok-corral-coaster-source.png` (RGBA, 2166 × 1226).
2. Thresholds to pure B&W and splits left/right halves.
3. Crops each half to a square inscribing the design's outer circle.
4. Scales the design so it inscribes the 0.125" safe-zone inner circle
   (radius 975 px @ 600 DPI), with a small ~10 px overshoot to avoid
   the anti-aliased-mask collision artifact.
5. Composites on a 2250 × 2250 all-black canvas using a circular paste
   mask (preserves the design's interior white pixels for the bullseye
   target / monogram strokes; everything outside the safe-zone circle
   stays solid black — covers both the safe-zone margin AND the bleed).
6. Threshold + 1-bit conversion.
7. Embeds the 1-bit PNG into a 4.0" × 4.0" PDF page with crop marks at
   the 4 corners of the trim bbox (drawn in the white margin).

## Notes

- **Color conversion:** the PDFs use sRGB (the default for ReportLab).
  Pure 1-bit black-and-white converts to CMYK trivially at the
  printer's RIP — black = (0, 0, 0, 100), white = paper. Most pulpboard
  printers convert sRGB→CMYK at print time and the result is identical
  for 1-bit B&W input. If the print shop asks for a CMYK PDF
  specifically, regenerate with `--cmyk` flag (TODO if needed) or
  forward this README and ask if sRGB-pure-B&W input is acceptable
  (almost always yes).
- **Bleed direction:** the black surrounds the design on ALL sides
  (top/bottom/left/right) past the trim line. There is no white at any
  point inside the 4" page outside of the 0.125" crop-mark margin.
- **Mirroring for the back:** the two PDFs are **not** mirrored. They
  print as-is on each side; the coaster's circular die-cut means
  there's no "front-back-alignment" worry beyond which design ends up
  where.
