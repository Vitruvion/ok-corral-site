# Dustin Dale Gaspard — poster exports

Print-ready and social-ready exports of the Dustin Gaspard event
poster. Generated from the Next.js routes at:

- `/poster/dustin-gaspard` → 1080×1800 print poster
- `/poster/dustin-gaspard/instagram` → 1080×1350 Instagram 4:5 variant

## Files

### `dustin-gaspard-print.pdf` — print PDF

1080 × 1800 pt PDF, vector text + embedded raster (hero photo, QR).

**Use for:** printing flyers / table tents / window posters at any
physical size — the embedded vector text and the layered grain stays
crisp at high DPI. Send directly to print shops.

### `dustin-gaspard-print-2x.png` — high-DPI raster

2160 × 3600 px PNG (= 1080 × 1800 at 2× device pixel ratio).

**Use for:** digital sharing where a single image file is easier than
a PDF — web previews, email blasts, retina-display digital frames,
fallback for clients that don't render PDF well.

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
| Hero photo height | 360 | 290 |
| Tanner credits | 3 lines (includes "music begins at eight-thirty sharp") | 2 lines (line dropped since "music at 8:30 pm" appears in the venue column) |
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
and writes the three artifacts to this directory. Approximate runtime:
30–60s including Next compile.

Requirements:
- `playwright` and `tsx` in devDependencies (already configured)
- Chromium browser installed (`npx playwright install chromium` once)
- Local Next.js project in a buildable state (no compile errors on
  either poster route)

If you change either poster route's JSX or CSS, re-run the export to
keep these files in sync.
