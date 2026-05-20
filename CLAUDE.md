# OK Corral Website — Handoff Doc

**Last updated:** May 19, 2026
**Owner:** Brady Olsen (25% co-owner, SIX SHOT LLC)
**Live site:** https://www.okcorralsaloon.com
**Repo:** https://github.com/Vitruvion/ok-corral-site
**Project root:** `C:\Projects\ok-corral-site`
**Latest deployed commit:** `4844192` (feat(poster): print-ready export pipeline + Instagram 4:5 variant)

---

## Stack

- **Frontend:** Next.js 14.2.x App Router, TypeScript, CSS Modules
- **Database:** Supabase (project ref `oqfjlsmsthcuamkncpfb`)
- **Hosting:** Vercel (auto-deploy from `main` branch)
- **Payments:** Stripe (test mode — gift cards + merch checkout wired; live mode pending bank account)
- **Email:** Resend (transactional + booking notifications)
- **Wallet:** `passkit-generator` (lazy-loaded) signing real Apple Wallet `.pkpass` files
- **Brand fonts (poster routes only):** Rye, IM Fell English, IM Fell English SC, Special Elite via `next/font/google`. Page-scoped — not loaded on home/card/wallet
- **Headless browser export:** Playwright (devDep) + tsx for `npm run export-poster`
- **Dev environment:** Windows PC, VS Code, PowerShell 5.1 (note: no `-SkipHttpErrorCheck` flag available)
- **Dev server:** ports 3000-3010 often occupied by leftover dev processes; pick a high port like `PORT=3050 npm run dev` if `next dev`'s auto-bumping fails

---

## Apple Developer

- Team ID: `552ZY96UV6`
- Pass Type ID: `pass.com.okcorralsaloon.rewards`
- OpenSSL installed at `C:\Program Files\OpenSSL-Win64\bin\` (manually added to user PATH)
- Cert working folder: `C:\Projects\ok-corral-site\wallet-certs\` (gitignored)

## Meta / Instagram

- Meta App: "OK Corral Website", App ID `2021132278482045`
- App is **Unpublished / Development mode** (works fine for our read-only use case)
- App Secret: stored in user's password manager (first 4 `01ed`, last 4 `52ba`)
- Instagram account: `@okcorralsaloon`, IG Business Account ID: `17841403015684418`
- FB Page: `https://www.facebook.com/profile.php?id=61575694323377` (Brady is Admin)
- TikTok: `@okcorralsaloon`
- IG account is registered as Instagram Tester on the Meta app

---

## Active features and their wiring

### 1. Site polish (deployed)

- Tagline: "NorCal's favorite western bar."
- Established year: 1954 (Hero.tsx and `BRAND.since` in `src/lib/data.ts`)
- Hero: parallax storefront photo + dust particles + animated wordmark + NEXT UP badge + tagline + What's On button
- Marquee: rAF-driven scroll (50 px/s), drag-to-pan with smooth resume, mobile 16px font + 40px gap below 760px. **`@keyframes marqueeScroll` MUST live inside `Marquee.module.css`** (don't move back to globals — CSS Modules can't resolve external keyframe references; same trap re-hit on card.module.css, see Card section)
- Gallery (16 items): g1=Cowboy Up, g2=Camo Cali, g3=Pool Night, g4=Ladies, g5=Camel Day, g6=Regulars, g7=Break Shot, g8=Saturday Night, g9=Patio Night, g10=Spencer, g11=The Crowd, g12=Locals, g13=Patio · Cigars & Cold Ones, g14=Dillon, g15=The Boys, g16=Car Show · Out Front
- Social links (Topbar, MobileMenu, Footer): IG + Facebook + TikTok wired via `SocialIcons` component
- AgeGate: bare `position: fixed; inset: 0; display: grid; place-items: center` after 4 centering iterations — don't refactor this layout
- Map: dark filter `filter: brightness(0.7) contrast(1.1) saturate(0.8)` on the iframe (Google embed doesn't accept style params)

### 2. Favicon + PWA manifest (deployed)

Hand-drawn OK monogram on solid black, generated from page 9 of `brand/OK_Corral_Logos_for_dark.pdf` via Sharp+pdfjs-dist pipeline (commit `51c9184`). Stroke imperfections preserved at every size — intentional brand voice.

**Files in `/public/`:**
- `favicon.ico` — multi-res ICO (16/32/48), browser tab
- `icon.png` — 512×512, Next.js App Router default
- `apple-icon.png` — 180×180, iOS home screen
- `icon-192.png` + `icon-512.png` — PWA/Android install
- `manifest.json` — name "The OK Corral", short_name "OK Corral", theme/background `#0b0908`

**Wiring:** `src/app/layout.tsx` declares `icons:` + `manifest:` in the Next.js `Metadata` export so the right `<link>` tags get auto-emitted.

### 3. Apple Wallet — Corral Rewards (deployed, Phase 1 + 4A polish)

Working `/card` page generates signed `.pkpass` files. Brady's iPhone test confirmed end-to-end pass install + display.

**5-tier ladder:** Newcomer (0) → Regular (500) → Local (1500) → Familiar Face (3500) → One of Ours (7500)

**`/card` page sections (in order):**
1. **Hero** — parallax storefront + dust particles, copied verbatim from Hero.tsx z-layering
2. **Pass mockup** — interactive 5-tier preview chips with escalating-materials treatment per tier (paper → bronze → antique brass → burnished bronze → molten gold; "One of Ours" gets a breathing-glow animation). Click chip to swap tier, click card to flip front↔back.
3. **Ranks ladder** with `fade-up` reveal animation
4. **How It Works** — three-step copy (currently: Sign Up / Add to Wallet / Earn Points — "Earn Points" body explicitly says points come from phone number at checkout or tap-pay-with-card, NOT QR scanning)
5. **Form** — framed enrollment card
6. **Sticky mobile CTA** — hides on form-in-view via IntersectionObserver

**QR purpose pivot (commit `13dda90`):** QR on the pass is a SHARE LINK, not a point-attribution code. Encodes `https://okcorralsaloon.com/card?ref=<serial>`. Points are tracked by phone number (eventually via Square Loyalty in Phase 2). All UX copy reflects this — `how_it_works` back field on the pass explicitly says "give the bartender the phone number you used to sign up" (NOT "pay with this card" — Wallet storeCards can't process payments, that copy misled users).

**Per-tier wallet pass colors** (`tiers.ts` `pass.*` blocks):
- Newcomer: bg `rgb(38, 30, 22)` (warm charcoal), fg `rgb(220, 205, 180)`, label `rgb(168, 148, 120)`
- Regular: bg `rgb(54, 38, 22)`, label `rgb(188, 156, 110)`
- Local: bg `rgb(64, 42, 22)`, label `rgb(208, 168, 108)`
- Familiar Face: bg `rgb(74, 44, 22)`, label `rgb(218, 174, 102)`
- One of Ours: bg `rgb(84, 38, 18)` (deep mahogany), label `rgb(232, 178, 96)` (ember gold)

Each tier is visibly distinct on the lock screen. **The `web.*` blocks are SEPARATE** — `web` drives the on-page mockup, `pass` drives the actual `.pkpass`. Don't conflate them.

**Pass back fields** (in order): share (QR explanation) → tier perk → next tier perk → all_tiers ladder → how_it_works → phone on file → address → questions → more_info URL.

**`logoText: "OK CORRAL"`** (not "THE OK CORRAL" — the longer string truncates on narrow lock-screen renders; logo image carries the brand identity).

**Pass mockup gotchas (preserve when editing):**
- **`filter` on a `preserve-3d` element flattens its 3D context.** This was the root cause of the mobile mirror-flip bug — the old `.card { filter: drop-shadow(...) }` killed `backface-visibility: hidden` on iOS Safari, making the front face show through mirrored when the card flipped. Removed in commit `89dc740`. Box-shadow on `.face` carries the visual lift instead.
- **`.face` needs an explicit non-zero `translateZ()` for backface to be hidden reliably.** `rotateY(0)` and `translateZ(0)` both simplify to a 2D identity matrix and iOS Safari then treats the element as not in 3D space. Use `translateZ(1px)` (or any non-zero value).
- **CSS Modules keyframes trap (re-hit on card.module.css):** `@keyframes fade-up` was defined globally but referenced inside the CSS module — the loader hashed the reference but not the keyframes block, so the animation never advanced and the ladder rungs stayed at opacity 0. Fix: local `@keyframes fade-up` block inside `card.module.css`. **Same lesson as the Marquee fix.**
- **QR share modal must be portaled to `document.body`** (`createPortal`) — `.heroPass` and `.scene` have transformed/animated ancestors that would become the containing block for a `position: fixed` modal otherwise.
- **`?debug=1` overlay (`src/components/CardDebugOverlay.tsx`):** renders a fixed top-overlay panel polling DOM state every 500ms. Used during the mobile-flip diagnostic. Gated by `?debug=1`, invisible in normal use, ships in prod harmlessly.

**Critical wallet-cert / signer knowledge (preserve when editing):**
- `pass-signer.ts` lazy-loads `passkit-generator` via `await import()` to fix Vercel build-trace ENOENT
- `passkit-generator` wipes `storeCard.*Fields` from `pass.json`; must populate via `pass.headerFields.push()` API plus `(pass as unknown as {type: string}).type = 'storeCard'` setter
- `authenticationToken` must be ≥16 chars: `(serialNumber + '-okcorral-rewards').slice(0, 64)`
- Apple Wallet key encryption MUST be PKCS#1 traditional format with DES-EDE3-CBC (NOT AES-256, NOT PKCS#8) — `node-forge` parser limitation. Command: `openssl rsa -in signerKey.pem -des3 -traditional -out signerKey.encrypted.pem -passout "pass:$passphrase"`
- Route handler returns `new Uint8Array(result.buffer)` — passing the Node `Buffer` directly trips NextResponse typing
- Route returns 503 with `{error, missing, help}` JSON when cert env vars are absent
- **CartProvider gotcha:** `Topbar` consumes `useCart()`, so any new route using `Topbar` must wrap its tree in `CartProvider`. `CardClient.tsx` is split into outer `CardClient` (wrapper) + inner `CardClientInner` (content).

**Files:**
- `src/lib/rewards/tiers.ts` — 5-tier source of truth, `pass` (Wallet schema rgb strings) + `web` (mockup hex + glow) color schemes
- `src/lib/rewards/pass-builder.ts` — emits pass.json overrides; storeCard style; logoText "OK CORRAL"; barcode is share URL
- `src/lib/rewards/pass-signer.ts` — lazy `await import('passkit-generator')`, env-var cert loading
- `src/app/api/card/pass/route.ts` (must keep `export const dynamic = 'force-dynamic'` + `runtime = 'nodejs'`)
- `src/app/card/page.tsx` + `CardClient.tsx` + `card.module.css`
- `src/components/PassMockup.tsx` + `PassMockup.module.css` — visual stand-in for `.pkpass`, themed via inline CSS custom properties from `TIERS.web.*`, includes share-QR modal
- `src/components/CardDebugOverlay.tsx` — diagnostic overlay gated by `?debug=1`
- Wallet pass images: `public/assets/wallet/icon.png/@2x/@3x/logo.png/@2x/@3x` (OK monogram)

### 4. Instagram live feed (deployed, self-refreshing)

Real posts from `@okcorralsaloon` render on the homepage in InstagramStrip. Token stored in Supabase `service_tokens` table, refreshed every ~20 days by a Vercel cron.

**Token storage:** Supabase table `service_tokens` (id text PK, access_token text, expires_at timestamptz, refreshed_at timestamptz, metadata jsonb). RLS enabled, NO public policies. Only service-role key can read/write.

**Current token state:** `id: 'instagram'`, `expires_at: 2026-07-16`, self-refreshing.

**Files:**
- `src/lib/supabase.ts` — `getSupabase()` (anon) + `getServiceSupabase()` (service-role)
- `src/lib/instagram.ts` — reads token from Supabase first, falls back to env (mostly for local dev)
- `src/lib/queries.ts` — `fetchAll()` calls `fetchInstagramPosts(6)` in parallel
- `src/components/InstagramStrip.tsx` — renders grid or `<FallbackCta />` if posts null
- `src/app/api/cron/refresh-instagram-token/route.ts` — Bearer auth via CRON_SECRET, hits `graph.instagram.com/refresh_access_token`
- `vercel.json` — cron schedule `0 12 1,21 * *` (1st + 21st of each month)

**Manual refresh:** Vercel Dashboard → Cron Jobs → "Run" next to `refresh-instagram-token`.

**If everything breaks:** Generate fresh long-lived token at Meta App → Instagram API → "API setup with Instagram login" → Generate token. Then `UPDATE service_tokens SET access_token=..., expires_at=now()+interval '60 days', refreshed_at=now() WHERE id='instagram';`

### 5. Events (deployed)

- `parseEventDate()` in `Events.tsx` parses ISO dates as **local time** to avoid the UTC-midnight TZ shift bug
- Featured event auto-expands via lazy `useState` initializer
- `linkify()` splits description text on `related_links.name` to auto-wrap inline `<a>` tags
- YouTube embed in expanded right column. Uses `padding-bottom: 45%` aspect trick (NOT `aspect-ratio` — iframe intrinsic 300×150 size breaks it)
- "Add to Calendar" → `downloadIcs(ev)` from `src/lib/ics.ts` (RFC 5545: CRLF, VTIMEZONE for America/Los_Angeles, line folding past 75 chars)
- "Share" → `shareOrCopy()` from `src/lib/share.ts`
- "Get Tickets" button when `eventbrite_url` set, "Free Admission" badge otherwise
- All "Doors" references removed across copy
- **Headline event — Dustin Dale Gaspard, June 25 2026:** Cajun alt-folk singer-songwriter, $15 tickets, w/ Tanner Bingaman 8:30 PM, eventbrite_url + youtube_url + poster_url set, featured=true.

### 6. Dustin Gaspard event poster system (deployed)

Standalone print + social poster route at `/poster/dustin-gaspard`. Vintage broadside design (paper grain, foxing, vignette, frame, corner diamonds) ported from a Claude Design HTML prototype.

**Two routes:**
- `/poster/dustin-gaspard` — **1080×1800 print poster** (the canonical version)
- `/poster/dustin-gaspard/instagram` — **1080×1350 Instagram 4:5 variant** (same content, reflowed: no footer ribbon, photo 360→290, Tanner credits 2 lines, address omitted)

**Visual letterboxing:** `PosterScaler.tsx` / `InstagramPosterScaler.tsx` apply `transform: scale(s)` to fit the fixed-pixel design into the viewport. **iOS-aware:**
- `.stage { height: 100vh; height: 100svh; }` (100svh excludes the address bar on iOS Safari 15.4+)
- Scale denominator = `Math.min(stage.clientHeight, window.innerHeight) - 48`
- Re-fits on both `resize` AND `visualViewport.resize` (the latter fires on iOS when the address bar collapses)

**Critical layout gotchas:**
- The bottom row's content height drives the row height; cells stretch to match. The venue column was made taller by the address; date frame stretches to match. Don't try to "fix" the asymmetry — the date frame is supposed to stretch.
- "An evening of Cajun soul & Appalachian song" line uses 36px font (was 40px); reducing prevented "song" orphan wrap. Don't push back to 40.
- Date frame internal contents are at the user's max scale-up that fits horizontally (DOW 21 / Month 32 / Day 72 / Year 17). Going further requires growing the frame or shrinking text below.
- Footer ribbon (print only) uses 3-cell grid (`1fr auto 1fr`): IG handle left, "LIVE MUSIC" center, "21 & UP" right; leading/trailing ★ glyphs. IG handle uses an inline SVG of the camera-square logo in `#902C1A`.
- The print poster's bottom region was tight against the footer divider; **the structural fix was growing the poster height** (1680 → 1750 → 1800) rather than shrinking content. Don't undo this.

**Files:**
- `src/app/poster/dustin-gaspard/page.tsx` + `PosterScaler.tsx` + `poster.module.css`
- `src/app/poster/dustin-gaspard/instagram/page.tsx` + `InstagramPosterScaler.tsx` + `poster-instagram.module.css`
- `public/assets/posters/dustin-gaspard.jpg` — hero photo
- `public/assets/posters/dustin-gaspard-qr.svg` — share QR (cream plate, `#902C1A` modules)

### 7. Poster export pipeline (deployed, devDep)

Headless-browser export script generates print-ready PDF + raster PNGs from both poster routes.

**Usage:** `npm run export-poster`

**Files:**
- `scripts/export-poster.ts` — Playwright-driven. Spawns its own Next dev server on port 4099, waits for fonts + images, pins poster to native 1:1 size (overrides PosterScaler's transform), exports to `/public/poster-exports/dustin-gaspard/`
- `public/poster-exports/dustin-gaspard/README.md` — what each file is, when to use each
- `public/poster-exports/dustin-gaspard/dustin-gaspard-print.pdf` — 1080×1800 print PDF
- `public/poster-exports/dustin-gaspard/dustin-gaspard-print-2x.png` — 2160×3600 high-DPI raster
- `public/poster-exports/dustin-gaspard/dustin-gaspard-instagram.png` — 1080×1350 IG 4:5

**Deps:** `playwright` + `tsx` (devDependencies). Chromium installed via `npx playwright install chromium` once.

**Windows quirk:** `spawn('npx', ...)` requires `shell: true` on Windows for the `.cmd` shim to resolve. Already wired in the script.

Re-run anytime poster JSX/CSS changes to refresh the artifacts.

### 8. Brand assets (committed)

Master brand files in `/brand/`:

- `brand/OK_Corral_Logos_for_dark.pdf` — 19-page vector PDF of OK Corral logos for dark backgrounds. White artwork on solid black. **Page 9** is the hand-drawn OK monogram used as the source for the favicon set and the red variants below.
- `brand/ok-monogram-red-transparent.png` — 1024×1024 RGBA, strokes recolored to `#902C1A` (barn red, matches the flyer ink), background transparent. Anti-aliased edges preserved as continuous alpha gradient.
- `brand/ok-monogram-red-on-cream-rounded.png` — same monogram on a `#E9D9BB` cream rounded square (radius ~12% of canvas), corners outside the rounded shape are transparent. Drop-in QR center logo when the QR pattern is busy.
- `brand/README.md` — enumerates all three variants with "use when" notes + regeneration instructions.

**Brand red is `#902C1A`** (oxblood, matches the printed flyer). The poster CSS uses `#8e2a18` for some legacy "tobacco red" elements — both are very close visually; treat them as effectively the same hue.

### 9. Drinks (deployed)

- Hucklebeer featured beer card (replaced old Scorpion Shot)
- Tabs: `Saloon Cocktails` / `Shots & Bombs` / `Featured Beer`
- `fetchDrinks()` has schema-mismatch guard — falls back to `data.ts` when Supabase categories don't overlap with `DRINK_TABS`
- Mobile fix: Hucklebeer meta grid `white-space: normal; word-break: break-word; line-height: 1.15` at ≤760px

### 10. Stripe + Resend (deployed, test mode)

- `/api/checkout` — Stripe Checkout Sessions with discriminated union `kind: 'gift_card' | 'merch'`. No explicit `apiVersion` on the client.
- `/api/booking-notify` — Resend transactional email; no-ops gracefully when `RESEND_API_KEY` missing
- `StripeReturnHandler.tsx` — reads `?stripe=success&kind=...&session_id=...` on mount, shows confirmation modal, clears cart for merch, strips params via `history.replaceState`
- **Cart-clearing race fix in `src/lib/cart.tsx`:** `clear()` sets `clearedRef.current = true` + sync `localStorage.removeItem` + `setLines([])` + `setOpen(false)`. Hydration and persist effects honor `clearedRef`. `addItem` resets the ref.

### 11. Mojibake defense (multi-layer)

- **Layer 1 — source:** `scripts/ascii-seed.py` produces pure 7-bit ASCII `supabase/seed.sql` (idempotent).
- **Layer 2 — runtime:** `unmojibake()` in `src/lib/queries.ts` self-heals UTF-8-as-Latin-1 round-trips via `TextDecoder` round-trip detection. Applied to all string fields read from Supabase.
- **Layer 3 — write hygiene:** All seed/data file edits use BOM-less UTF-8.

### 12. Other status

- Square POS already connected to IG account
- Drinks/events/merch CMS in Supabase
- GoDaddy DNS pointing to Vercel
- `SHOW_MERCH = false` and `SHOW_GIFT_CARDS = false` — flip a single bool to launch each section
- **Mobile pass flip + ladder rungs:** both formerly broken on iOS; fixed in commits `89dc740` (filter removed) + `7e490d9` (local fade-up keyframes). Don't reintroduce filter on `.card`.

---

## Env vars

### `.env.local` (Brady's machine)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (length 219, starts `eyJh`)
- `STRIPE_SECRET_KEY` (test mode)
- `STRIPE_WEBHOOK_SECRET` (test mode)
- `RESEND_API_KEY`
- `INSTAGRAM_USER_ID` = `17841403015684418`
- `CRON_SECRET`
- Apple Wallet vars: `APPLE_TEAM_ID`, `APPLE_PASS_TYPE_ID`, `APPLE_PASS_CERT_PEM_B64`, `APPLE_PASS_KEY_PEM_B64`, `APPLE_PASS_KEY_PASSPHRASE`, `APPLE_WWDR_PEM_B64`
- **NOT** `INSTAGRAM_ACCESS_TOKEN` (removed — comes from Supabase now)

### Vercel (Production + Preview)

Same set as `.env.local` (minus dev-only vars). `SUPABASE_SERVICE_ROLE_KEY` flagged Sensitive.

---

## Key file paths

```
C:\Projects\ok-corral-site\
├── .env.local                        # gitignored
├── vercel.json                       # cron schedule
├── wallet-certs\                     # gitignored, Apple cert working dir
├── brand\                            # master brand assets (PDF + red monogram variants + README)
├── scripts\
│   ├── ascii-seed.py                 # idempotent seed.sql ASCII-ifier
│   └── export-poster.ts              # Playwright PDF/PNG export pipeline
├── supabase\
│   ├── seed.sql                      # pure 7-bit ASCII
│   └── migrations\
│       ├── 0001_init.sql
│       ├── 0002_events_eventbrite_url.sql
│       ├── 0003_orders_and_gift_cards.sql
│       ├── 0004_events_featured_and_related.sql
│       └── 0005_events_youtube_url.sql
├── public\
│   ├── favicon.ico + icon.png + apple-icon.png + icon-192.png + icon-512.png
│   ├── manifest.json
│   ├── poster-exports\dustin-gaspard\  # PDF + 2x PNG + IG PNG + README
│   └── assets\
│       ├── wallet\                   # OK monogram for .pkpass (icon + logo, 1x/2x/3x)
│       ├── posters\                  # dustin-gaspard.jpg + dustin-gaspard-qr.svg
│       └── gallery\                  # site photos + event poster thumbs
└── src\
    ├── app\
    │   ├── layout.tsx                # Metadata: icons + manifest wiring
    │   ├── page.tsx                  # home → fetchAll() → ClientShell
    │   ├── card\                     # Corral Rewards landing + .pkpass API
    │   │   ├── page.tsx
    │   │   ├── CardClient.tsx        # CartProvider wrapper + inner content
    │   │   └── card.module.css       # Phase 4A landing; local @keyframes fade-up
    │   ├── poster\dustin-gaspard\
    │   │   ├── page.tsx + PosterScaler.tsx + poster.module.css  (1080×1800 print)
    │   │   └── instagram\
    │   │       └── page.tsx + InstagramPosterScaler.tsx + poster-instagram.module.css  (1080×1350)
    │   └── api\
    │       ├── card\pass\route.ts    # wallet pass generator (force-dynamic, nodejs runtime)
    │       ├── checkout\route.ts     # Stripe Checkout Sessions
    │       ├── booking-notify\route.ts
    │       └── cron\refresh-instagram-token\route.ts
    ├── components\
    │   ├── Hero.tsx + Hero.module.css
    │   ├── Marquee.tsx + Marquee.module.css   # @keyframes local
    │   ├── InstagramStrip.tsx
    │   ├── Events.tsx                # parseEventDate, linkify, YouTube embed
    │   ├── PassMockup.tsx + PassMockup.module.css  # tier-themed, share QR modal via createPortal
    │   ├── CardDebugOverlay.tsx      # ?debug=1 diagnostic overlay
    │   ├── SocialIcons.tsx
    │   ├── StripeReturnHandler.tsx
    │   ├── ImageOrPlaceholder.tsx
    │   └── ClientShell.tsx
    └── lib\
        ├── data.ts                   # BRAND, feature flags (SHOW_MERCH, SHOW_GIFT_CARDS)
        ├── supabase.ts               # getSupabase() + getServiceSupabase()
        ├── queries.ts                # fetchAll() + unmojibake()
        ├── instagram.ts              # token reader + media fetcher
        ├── cart.tsx                  # CartProvider with clearedRef
        ├── ics.ts                    # RFC 5545 .ics generator
        ├── share.ts                  # shareOrCopy()
        └── rewards\                  # tiers, builder, signer for Apple Wallet
```

---

## Outstanding / next session candidates

### 🪧 Printable QR code artwork for in-bar enrollment
Saloon-aesthetic table tents, coasters, door decals featuring the enrollment QR code. The red-on-cream-rounded monogram in `/brand/` could anchor these.

### 💳 Phase 2 Corral Rewards: Square Loyalty wiring
All generated passes hardcode `points: 0`. Phase 2 wires Square Loyalty API → `buildPass()` so passes show real customer point balance. Requires Square API setup + webhooks.

### 📡 Phase 3 Corral Rewards: pass push updates
`webServiceURL` is placeholder. Phase 3 implements Apple's push API so passes update when points change without re-downloading.

### 🍻 Stripe live mode
Currently test mode. Activate when bank account is ready. Once live, enable `SHOW_MERCH = true` after product photos and build the Stripe webhook for order status. Flip `SHOW_GIFT_CARDS = true` to relaunch gift cards.

### 🖼️ Apple Wallet strip image
`pass-signer.ts` is wired to pick up `strip.png` + `@2x` + `@3x` from `public/assets/wallet/` if they exist. Currently no strip — would meaningfully upgrade the pass visual but needs designer attention (a bad strip looks cheap, a good one is the highest-leverage pass upgrade Wallet allows).

### 🐎 Vestaboard hero experiment (declined, archived)
Vestaboard-style animated marquee hero with flip cards. Branch `hero-vestaboard` deleted. Concept worked technically but felt more "boardwalk attraction" than "moody saloon."

---

## Brady's working preferences

- Slow-and-safe pacing on multi-step builds (one step at a time, verify each)
- Wants gap-free terminal commands with full strings (no placeholders to fill in)
- Strongly prefers seeing/testing builds locally before production deploy
- Comfortable trashing experiments cleanly via branch deletion
- Uses Claude Code as primary implementation tool, Claude chat for architecture and diagnostics
- For visual / layout work: render in a browser and verify before claiming done. Math + measurements alone aren't enough — iOS rendering quirks have bitten multiple times.
- For UI changes that span desktop + mobile, verify both viewports explicitly.
- Other active projects: prediction market trading bot (EU EC2, Polymarket repricing), "Wrapped" iOS app (HealthKit), "It's 5 O'Clock Somewhere" social drinking app (Expo + Supabase), AutoLink automotive parts platform (Next.js 15)

---

## Notes / gotchas

- **PowerShell quirks:** No `-SkipHttpErrorCheck` flag (5.1 limitation). Long sessions sometimes suppress earlier `Write-Output` lines and only echo the last one — use `Out-File` + `notepad` for reliable multi-line output. `System.Net.Http` assembly drops out of session after time/restarts; reload with `Add-Type -AssemblyName System.Net.Http`.
- **Git line endings:** Windows shows `LF will be replaced by CRLF` warnings on commit — harmless.
- **Next.js ISR cache:** Hard refresh (Ctrl+Shift+R) + DevTools "Disable cache" needed to bust caching during dev. `Remove-Item -Recurse -Force .next` for full purge.
- **Instagram tokens:** Use Instagram Login flow (not Facebook Login). The Facebook Login path had unexplained "system error" 400s. Instagram Login generates long-lived tokens directly from dashboard.
- **Supabase service-role key:** Bypasses all RLS. Never expose to client code. Only used in server-side routes and the cron handler.
- **TZ bug to avoid:** `new Date('2026-06-25')` parses as UTC midnight, `getDate()` returns local day = 24 in PST. Use `parseEventDate()` helper.
- **iframe aspect ratio:** Don't use CSS `aspect-ratio` on a wrapper containing an iframe — iframe's 300×150 intrinsic size breaks it. Use the `padding-bottom: 56.25%` (or `45%`) trick with `position: absolute; inset: 0` on the iframe.
- **CartProvider scope:** `Topbar` consumes `useCart()`. Any route mounting `Topbar` must be wrapped in `CartProvider`.
- **AgeGate centering is locked:** After 4 iterations the only layout that worked across desktop Chrome + iOS Safari is bare `position: fixed; inset: 0; display: grid; place-items: center` with a single `.inner` wrapper. Don't refactor.
- **CSS Modules + `@keyframes`:** A `@keyframes` block in `globals.css` cannot be referenced by name from inside a CSS module — the module loader hashes the animation-name reference but not the global keyframes block, so the animation never runs. Solution: declare `@keyframes` LOCALLY inside the same module file. Re-hit twice — once on Marquee, once on the ranks ladder fade-up.
- **`filter` flattens preserve-3d:** Per CSS spec, applying any `filter` to a `transform-style: preserve-3d` element flattens its 3D rendering context. Children render in 2D; `backface-visibility: hidden` becomes a no-op. This was the iOS mirrored-flip bug. Don't put a `filter` on `.card` (or any 3D-context root).
- **Browser-fixed elements inside transformed ancestors:** A `position: fixed` descendant of a transformed element is positioned relative to the transformed ancestor, NOT the viewport. To make a true viewport-fixed modal, render it via `createPortal(jsx, document.body)`.
- **iOS Safari `100vh` vs `innerHeight`:** On iOS Safari, `100vh` is the full viewport (with address bar hidden) while `window.innerHeight` is the visible area (with bar showing). Use `100svh` for the conservative value, and measure `stage.clientHeight` alongside `innerHeight` in scaling code. Re-fit on `visualViewport.resize` so the layout adapts when the bar collapses.
- **Windows file-handle locks after Sharp/Node:** When using a temp `tmp/` directory for image-generation scripts, Node sometimes holds the directory open briefly after the script exits. `rm -rf tmp` may fail with EBUSY; a 2-3 second sleep and retry clears it.
- **next/font Google Fonts warnings:** `IM Fell English` and `IM Fell English SC` log "Failed to find font override values" warnings on every build. Cosmetic — fonts render fine. Don't bother chasing them.
- **Don't trust math alone for visual layout fixes:** Multiple commits in the poster history had correct math but wrong visual results because of subpixel rounding, scaled rendering, or constraint conflicts. Always render and visually verify; ideally also measure the actual rendered geometry via DOM bounding rects.
