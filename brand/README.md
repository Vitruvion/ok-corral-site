# Brand source assets

Master brand files for The OK Corral. Treat as the source of truth
when regenerating any derived asset (favicon set, social cards,
print, etc.).

## Files

### `OK_Corral_Logos_for_dark.pdf`

19-page vector PDF of OK Corral logos/marks intended for use on
dark backgrounds. White artwork on solid black.

- **Page 9** is the hand-drawn OK monogram used to generate the
  favicon set in `/public/` (`favicon.ico`, `icon.png`,
  `apple-icon.png`, `icon-192.png`, `icon-512.png`).

If you regenerate the favicons, render page 9 at high DPI and
preserve the hand-drawn stroke imperfections — they are
intentional brand voice and must not be vectorized or smoothed.

## OK monogram variants (page-9 source)

All three variants are 1024×1024 PNGs derived from the same
hand-drawn OK monogram on page 9 of the brand PDF. Pick the one
that suits the backdrop.

### 1. White on black → favicon set (in `/public/`)

The page-9 source used at face value (white on solid black, no
alpha). Generates `/public/favicon.ico`, `/public/icon.png`,
`/public/apple-icon.png`, `/public/icon-192.png`,
`/public/icon-512.png`. See section on the source PDF above.

### 2. `ok-monogram-red-transparent.png` — red on transparent

Strokes in **`#902C1A`** (oxblood barn red, matches the flyer ink)
on a true alpha channel. Edge anti-aliasing preserved as a
continuous alpha gradient (1..254) so the strokes feather cleanly
onto whatever backdrop they're composited over.

**Use when:** the QR pattern behind the logo is light or uniform
enough that the red strokes can read directly against it without
needing a "carved out" background plate.

**Color note:** first generation used `#A8332A` which read too
bright/orange next to the printed flyer. Corrected to `#902C1A`
(RGB 144, 44, 26) so the on-screen QR-embed logo matches the
flyer's actual ink.

### 3. `ok-monogram-red-on-cream-rounded.png` — red on rounded cream

The same red monogram, but centered inside a rounded cream
square (fill **`#E9D9BB`**, corner radius ≈12% of canvas).
Outside the rounded square is fully transparent so when this
PNG drops into qrcode-monkey only the rounded cream zone shows.

**Use when:** the QR pattern is busy enough that the red strokes
need a deliberate logo plate to read cleanly — the cream square
"carves out" a quiet zone around the monogram on top of the QR.

The monogram sits inside a 17% padded inner area, so the cream
plate reads as a designed lockup rather than a tight crop around
the strokes. Stroke edges blend smoothly into the cream below
via normal alpha compositing.

### Regenerating the red variants

Same pipeline as the favicon set (pdfjs-dist + node-canvas +
sharp), but converting white→red with luminance-as-alpha. The
cream variant adds an SVG-rasterized rounded-rect plate that
the red monogram composites onto. See the commit that
introduced each file for the exact script.

## Adding new master assets

Drop additional PDFs/AI/Figma exports here and note their purpose
in this README. Anything over ~5 MB should be gitignored and
linked from a note instead of committed directly.
