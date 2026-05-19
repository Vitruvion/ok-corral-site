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

### `ok-monogram-red-transparent.png`

1024×1024 PNG. The same page-9 OK monogram, but with strokes
recolored to **`#902C1A`** (oxblood barn red, matches the flyer)
and the previously black background flipped to a true alpha
channel (transparent). Edge anti-aliasing is preserved as a
continuous alpha gradient so the strokes feather cleanly when
composited onto any backdrop.

**Color note:** the first generation of this file used `#A8332A`
which read slightly too bright/orange next to the printed flyer.
Corrected to `#902C1A` (RGB 144, 44, 26) so the on-screen QR-embed
logo matches the flyer's actual ink.

**Use:** drop-in center logo for QR codes (e.g. qrcode-monkey)
on printed flyers / table tents. Not loaded by the live site —
purely a design asset for external tools.

To regenerate: same pipeline as the favicon set (pdfjs-dist +
node-canvas + sharp), but skip the black-canvas composite and
instead convert white→red with luminance-as-alpha. See the
commit that introduced this file for the script.

## Adding new master assets

Drop additional PDFs/AI/Figma exports here and note their purpose
in this README. Anything over ~5 MB should be gitignored and
linked from a note instead of committed directly.
