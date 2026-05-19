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

## Adding new master assets

Drop additional PDFs/AI/Figma exports here and note their purpose
in this README. Anything over ~5 MB should be gitignored and
linked from a note instead of committed directly.
