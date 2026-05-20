# Dustin Dale Gaspard — poster exports

Print-ready and social-ready exports of the Dustin Gaspard event
poster. Generated from the Next.js routes at:

- `/poster/dustin-gaspard` → 1080×1800 print poster
- `/poster/dustin-gaspard/instagram` → 1080×1350 Instagram 4:5 variant

## Files

### `dustin-gaspard-print-2x.png` — print master

2160 × 3600 px PNG (= 1080 × 1800 at 2× device pixel ratio).
**This is the canonical print file** — send it directly to print
shops.

Print-shop notes:
- At tabloid size (11 × 17 in) this works out to ~196 DPI on the
  long edge, which is well within the 150–300 DPI range that most
  print shops accept for posters and flyers. For half-letter table
  tents (5.5 × 8.5 in) you're effectively at 400+ DPI.
- High-resolution PNG is fine for poster / flyer / table-tent
  printing — virtually every shop's web upload accepts PNG, and
  the layered paper grain + foxing + vignette stays crisp at any
  practical print size.
- The cream paper, oxblood ink (`#902C1A` / `#8e2a18`), and dark
  brown body color are baked in. No bleed margin is included — the
  poster is designed as a finished 1080×1800 art board, so ask the
  shop to print flush (or add bleed in their pipeline) if needed.

**Also useful for:** digital sharing where a single image file is
easier than a vector format — web previews, email blasts,
retina-display digital frames.

### `dustin-gaspard-instagram.png` — Instagram 4:5

1080 × 1350 px PNG. Designed for Instagram **feed posts** (4:5 portrait,
the recommended aspect ratio that fills the most feed real estate).

Drop directly into the Instagram composer — no further editing needed.

**Caption suggestion:**

> 🎶 Dustin Dale Gaspard live at The OK Corral · Thursday, June 25 · 8:30 pm
> Cajun soul & Appalachian song. With special guest Tanner Bingaman.
> 3633 Main Street, Cottonwood CA. Tickets via the QR (or link in bio).
> 21 & up.

**For Instagram Stories or Reels:** the print poster's 1080 × 1800
ratio is close to 9:16 (1080 × 1920), so it works as-is for those
formats with Instagram's letterboxing handling the small height
difference cleanly.

## Differences between print and Instagram

The Instagram variant is a *reflow* of the print poster, not a redesign.
Same content, same brand voice (paper grain, frame, color palette,
typography). The differences are layout-only adjustments to fit 4:5:

| | Print | Instagram |
|---|---|---|
| Canvas | 1080×1800 | 1080×1350 |
| Hero photo height | 360 | 250 |
| Tanner credits | 3 lines (includes "music begins at eight-thirty sharp") | 1 line ("songwriter · banjoist · poet · featured on NPR") |
| Venue address | "3633 Main Street / Cottonwood, CA 96022" shown | omitted (lives in IG caption) |
| Footer ribbon | "★ [IG]@okcorralsaloon · LIVE MUSIC · 21 & UP ★" | removed (info in caption) |

Everything else — wordmark, three-column bottom row, QR code, wax
seal, side margin text, paper grain, foxing, vignette, frame, corner
diamonds — is identical between the two.

## Regenerating these files

```bash
npm run export-poster
```

The script (`scripts/export-poster.ts`) spawns its own Next.js dev
server on port 4099, drives Playwright Chromium through both routes,
and writes the two artifacts to this directory. Approximate runtime:
30–60s including Next compile.

Requirements:
- `playwright` and `tsx` in devDependencies (already configured)
- Chromium browser installed (`npx playwright install chromium` once)
- Local Next.js project in a buildable state (no compile errors on
  either poster route)

If you change either poster route's JSX or CSS, re-run the export to
keep these files in sync.
