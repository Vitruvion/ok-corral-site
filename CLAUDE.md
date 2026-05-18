# OK Corral Website — Handoff Doc

**Last updated:** May 17, 2026
**Owner:** Brady Olsen (25% co-owner, SIX SHOT LLC)
**Live site:** https://www.okcorralsaloon.com
**Repo:** https://github.com/Vitruvion/ok-corral-site
**Project root:** `C:\Projects\ok-corral-site`
**Latest deployed commit:** `92770c8` (feat(card): Phase 4A landing — hero, pass mockup with tier preview, ranks ladder, sticky CTA)

---

## Stack

- **Frontend:** Next.js 14.2.x App Router, TypeScript, CSS Modules
- **Database:** Supabase (project ref `oqfjlsmsthcuamkncpfb`)
- **Hosting:** Vercel (auto-deploy from `main` branch)
- **Payments:** Stripe (test mode — gift cards + merch checkout wired; live mode pending bank account)
- **Email:** Resend (transactional + booking notifications)
- **Wallet:** `passkit-generator` (lazy-loaded) signing real Apple Wallet `.pkpass` files
- **Dev environment:** Windows PC, VS Code, PowerShell 5.1 (note: no `-SkipHttpErrorCheck` flag available)
- **Dev server:** typically `http://localhost:3003` (ports 3000–3002 often busy)

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

- Tagline: "NorCal's favorite western dive bar."
- Established year: 1954 (Hero.tsx and `BRAND.since` in `src/lib/data.ts`)
- Hero: parallax storefront photo + dust particles + animated wordmark + NEXT UP badge + tagline + What's On button
- Marquee: rAF-driven scroll (50 px/s), drag-to-pan with smooth resume, mobile 16px font + 40px gap below 760px. `@keyframes marqueeScroll` lives inside `Marquee.module.css` (don't move back to globals — CSS Modules can't resolve external keyframes). Items doubled + `translateX(-50%)` for seamless loop.
- Marquee items use `{text, accent}` shape; written with BOM-less UTF-8 to avoid mojibake
- Gallery (16 items): g1=Cowboy Up, g2=Camo Cali, g3=Pool Night, g4=Ladies, g5=Camel Day, g6=Regulars, g7=Break Shot, g8=Saturday Night, g9=Patio Night, g10=Spencer, g11=The Crowd, g12=Locals, g13=Patio · Cigars & Cold Ones, g14=Dillon, g15=The Boys, g16=Car Show · Out Front
- Social links (Topbar, MobileMenu, Footer): IG + Facebook + TikTok wired via `SocialIcons` component
- AgeGate: bare `position: fixed; inset: 0; display: grid; place-items: center` after 4 centering iterations — don't refactor this layout
- Map: dark filter `filter: brightness(0.7) contrast(1.1) saturate(0.8)` on the iframe (Google embed doesn't accept style params)

### 2. Apple Wallet — Corral Rewards (Phase 1 + Phase 4A landing, deployed)

Working `/card` page generates signed `.pkpass` files. Brady's iPhone test confirmed: THE OK CORRAL header, OK monogram icon, TIER: Newcomer, MEMBER: Brady Olsen, POINTS: 0, PROGRESS: 500 to Regular, all 5 tier perks on the back, QR code OKC-5303482062.

**5-tier ladder:** Newcomer (0) → Regular (500) → Local (1500) → Familiar Face (3500) → One of Ours (7500)

**Phase 4A landing (commit `92770c8`):** Full cinematic `/card` page replaced the Phase 1 scaffold. Six sections in order:
1. **Hero** — parallax storefront + dust particles, copied verbatim from Hero.tsx z-layering
2. **Pass mockup** with 5 tier preview chips; click chip to swap tier, click card to flip front↔back (subtle float + diagonal shine animations run independently)
3. **Ranks ladder** — full visual tier progression with perks
4. **How It Works** — three-step copy
5. **Form** — framed enrollment card with diamond corner ornaments, preserves Phase 1 form logic verbatim
6. **Sticky mobile CTA** — `display: block` only at ≤760px, hides on scroll via `IntersectionObserver` setting `.stickyHidden` → `transform: translateY(110%)`

**CartProvider gotcha:** `Topbar` consumes `useCart()`, so any new route using `Topbar` must wrap its tree in `CartProvider`. `CardClient.tsx` is split into outer `CardClient` (wrapper) + inner `CardClientInner` (content).

**Files:**
- `src/lib/rewards/tiers.ts` — 5-tier source of truth, pass + web color schemes, helpers (`getTier`, `tierForPoints`, `nextTier`, `progressInTier`)
- `src/lib/rewards/pass-builder.ts` — emits pass.json overrides; storeCard style with header/primary/secondary/auxiliary/back fields
- `src/lib/rewards/pass-signer.ts` — wraps passkit-generator with lazy `await import('passkit-generator')`
- `src/app/api/card/pass/route.ts` (must keep `export const dynamic = 'force-dynamic'` + `runtime = 'nodejs'`)
- `src/app/card/page.tsx` + `CardClient.tsx` + `card.module.css`
- `src/components/PassMockup.tsx` + `PassMockup.module.css` — visual stand-in for `.pkpass`, themed via inline CSS custom properties from `TIERS.web.*`
- Wallet icons (OK monogram): `public/assets/wallet/icon.png` + `icon@2x.png` + `icon@3x.png` + `logo.png` + `logo@2x.png` + `logo@3x.png`

**Critical technical knowledge embedded in code (preserve when editing):**
- `pass-signer.ts` lazy-loads `passkit-generator` via `await import()` to fix Vercel build-trace ENOENT
- `passkit-generator` wipes `storeCard.*Fields` from `pass.json`; must populate via `pass.headerFields.push()` API plus `(pass as unknown as {type: string}).type = 'storeCard'` setter
- `authenticationToken` must be ≥16 chars: `(serialNumber + '-okcorral-rewards').slice(0, 64)`
- Apple Wallet key encryption MUST be PKCS#1 traditional format with DES-EDE3-CBC (NOT AES-256, NOT PKCS#8) — `node-forge` parser limitation. Command: `openssl rsa -in signerKey.pem -des3 -traditional -out signerKey.encrypted.pem -passout "pass:$passphrase"`
- Route handler returns `new Uint8Array(result.buffer)` — passing the Node `Buffer` directly trips NextResponse typing
- Route returns 503 with `{error, missing, help}` JSON when cert env vars are absent (so the form surfaces a friendly message instead of binary garbage)

### 3. Instagram live feed (deployed, self-refreshing)

Real posts from `@okcorralsaloon` render on the homepage in InstagramStrip. Token is stored in Supabase `service_tokens` table, refreshed automatically every ~20 days by a Vercel cron.

**Token storage:** Supabase table `service_tokens` (id text PK, access_token text, expires_at timestamptz, refreshed_at timestamptz, metadata jsonb). RLS enabled, NO public policies. Only service-role key can read/write.

**Current token state** (as of last refresh):
- `id`: `'instagram'`
- `token_length`: 159
- `expires_at`: 2026-07-16
- Self-refreshing — no calendar reminder needed

**Files:**
- `src/lib/supabase.ts` — two clients: `getSupabase()` (anon, public reads) and `getServiceSupabase()` (service-role, sensitive ops)
- `src/lib/instagram.ts` — reads token from Supabase first, falls back to `INSTAGRAM_ACCESS_TOKEN` env var (mostly for local dev; production has no env var)
- `src/lib/queries.ts` — `fetchAll()` calls `fetchInstagramPosts(6)` in parallel with other queries
- `src/components/InstagramStrip.tsx` — renders grid of posts or `<FallbackCta />` if posts is null
- `src/app/api/cron/refresh-instagram-token/route.ts` — GET handler, Bearer auth via CRON_SECRET, hits `https://graph.instagram.com/refresh_access_token`, updates Supabase row
- `vercel.json` — cron schedule `0 12 1,21 * *` (1st and 21st of each month, 12:00 UTC = 4 AM Pacific)

**Manual refresh (if ever needed):** Vercel Dashboard → Cron Jobs → click "Run" next to `/api/cron/refresh-instagram-token`.

**If everything breaks:** Generate a fresh long-lived token directly from Meta dashboard at App → Instagram API → "API setup with Instagram login" → Generate token button. Then `UPDATE service_tokens SET access_token=..., expires_at=now()+interval '60 days', refreshed_at=now() WHERE id='instagram';`

### 4. Events (deployed)

- `parseEventDate()` in `Events.tsx` parses ISO dates as **local time** to avoid the UTC-midnight TZ shift bug (`new Date('2026-06-25')` would render as June 24 in PST)
- Featured event auto-expands via lazy `useState` initializer
- `linkify()` splits description text on `related_links.name` to auto-wrap inline `<a>` tags
- YouTube embed in expanded right column (80% width on desktop, 100% mobile). Uses `padding-bottom: 45%` aspect trick (NOT `aspect-ratio` — iframe intrinsic 300×150 size breaks it)
- "Add to Calendar" → `downloadIcs(ev)` from `src/lib/ics.ts` (RFC 5545: CRLF, VTIMEZONE for America/Los_Angeles, line folding past 75 chars)
- "Share" → `shareOrCopy()` from `src/lib/share.ts` (native Web Share API → clipboard → execCommand fallback chain)
- "Get Tickets" button when `eventbrite_url` set, "Free Admission" badge otherwise
- All "Doors" references removed across copy
- **Headline event — Dustin Dale Gaspard, June 25 2026:** Cajun alt-folk singer-songwriter, $15 tickets, w/ Tanner Bingaman support 8:30 PM, eventbrite_url set, poster_url `/assets/gallery/dustin-gaspard.jpg`, youtube_url set, featured=true, related_links includes Tanner Bingaman + Dustin's IG (`@dustindalegaspard`). Tanner has thumb `/assets/gallery/tanner-bingaman.jpg`. Dustin has IG profile image `/assets/gallery/dustin-ig.jpg`.

### 5. Drinks (deployed)

- Hucklebeer featured beer card (replaced old Scorpion Shot)
- Tabs: `Saloon Cocktails` / `Shots & Bombs` / `Featured Beer`
- `fetchDrinks()` has schema-mismatch guard — falls back to `data.ts` when Supabase categories don't overlap with `DRINK_TABS`
- Mobile fix: Hucklebeer meta grid `white-space: normal; word-break: break-word; line-height: 1.15` at ≤760px (was overflowing ABV column with "HUCKLEBERRY WHEAT")

### 6. Stripe + Resend (deployed, test mode)

- `/api/checkout` — Stripe Checkout Sessions with discriminated union `kind: 'gift_card' | 'merch'`. No explicit `apiVersion` on the client (LatestApiVersion not exported in current SDK version)
- `/api/booking-notify` — Resend transactional email; no-ops gracefully when `RESEND_API_KEY` missing
- `StripeReturnHandler.tsx` — reads `?stripe=success&kind=...&session_id=...` on mount, shows confirmation modal, clears cart for merch, strips params via `history.replaceState`
- **Cart-clearing race fix in `src/lib/cart.tsx`:** `clear()` sets `clearedRef.current = true` + sync `localStorage.removeItem(STORAGE_KEY)` + `setLines([])` + `setOpen(false)`. Hydration and persist effects honor `clearedRef`. `addItem` resets the ref. Verified end-to-end fix for "cart still has items after Stripe success" bug.

### 7. Other features (status)

- Square POS already connected to IG account (Square-IG app visible in IG settings)
- Drinks/events/merch CMS in Supabase
- Real bar photos uploaded
- GoDaddy DNS pointing to Vercel
- `SHOW_MERCH = false` and `SHOW_GIFT_CARDS = false` — flip a single bool to launch each section

### 8. Mojibake defense (multi-layer)

- **Layer 1 — source:** `scripts/ascii-seed.py` produces pure 7-bit ASCII `supabase/seed.sql` by converting non-ASCII chars in E-strings to PostgreSQL `\uXXXX` escapes. Idempotent: recognizes existing escapes and collapses any run of `\` followed by valid `uXXXX` to a single `\uXXXX` (fixes prior over-escape bugs).
- **Layer 2 — runtime:** `unmojibake()` in `src/lib/queries.ts` self-heals UTF-8-as-Latin-1 round-trips via `TextDecoder` round-trip detection. Applied defensively to all string fields read from Supabase.
- **Layer 3 — write hygiene:** All seed/data file edits use BOM-less UTF-8 (`[System.IO.File]::WriteAllText` on Windows).

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
- `CRON_SECRET` (random 24+ char string, also in Vercel)
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
├── scripts\
│   └── ascii-seed.py                 # idempotent seed.sql ASCII-ifier
├── supabase\
│   ├── seed.sql                      # pure 7-bit ASCII via ascii-seed.py
│   └── migrations\
│       ├── 0001_init.sql                          # all base tables + RLS
│       ├── 0002_events_eventbrite_url.sql
│       ├── 0003_orders_and_gift_cards.sql         # merch_orders + gift_card_orders + RLS
│       ├── 0004_events_featured_and_related.sql   # featured boolean + related_links jsonb + partial unique index (one featured)
│       └── 0005_events_youtube_url.sql
├── public\
│   └── assets\
│       ├── wallet\                   # OK monogram: icon + logo (1x, 2x, 3x)
│       └── gallery\                  # site photos including dustin-gaspard.jpg, dustin-ig.jpg, tanner-bingaman.jpg
└── src\
    ├── app\
    │   ├── page.tsx                  # home → fetchAll() → ClientShell
    │   ├── card\
    │   │   ├── page.tsx
    │   │   ├── CardClient.tsx        # CardClient (CartProvider wrapper) + CardClientInner (content)
    │   │   └── card.module.css       # Phase 4A landing styling
    │   └── api\
    │       ├── card\pass\route.ts    # wallet pass generator (force-dynamic, nodejs runtime)
    │       ├── checkout\route.ts     # Stripe Checkout Sessions
    │       ├── booking-notify\route.ts  # Resend transactional email
    │       └── cron\refresh-instagram-token\route.ts
    ├── components\
    │   ├── Hero.tsx + Hero.module.css
    │   ├── Marquee.tsx + Marquee.module.css   # keyframes live inside the module
    │   ├── InstagramStrip.tsx
    │   ├── Events.tsx                # parseEventDate, linkify, YouTube embed, ics/share buttons
    │   ├── PassMockup.tsx + PassMockup.module.css  # visual .pkpass stand-in, tier-themed via CSS vars
    │   ├── SocialIcons.tsx           # IG + FB + TikTok
    │   ├── StripeReturnHandler.tsx   # post-checkout confirmation + cart clear
    │   ├── ImageOrPlaceholder.tsx    # <img> with fallback div
    │   └── ClientShell.tsx           # wires everything
    └── lib\
        ├── data.ts                   # central data, feature flags (SHOW_MERCH, SHOW_GIFT_CARDS), BRAND
        ├── supabase.ts               # getSupabase() + getServiceSupabase()
        ├── queries.ts                # fetchAll() + per-table queries + unmojibake() defense
        ├── instagram.ts              # token reader + media fetcher
        ├── cart.tsx                  # CartProvider with clearedRef race fix
        ├── ics.ts                    # RFC 5545 .ics generator (CRLF, VTIMEZONE, line folding)
        ├── share.ts                  # shareOrCopy() with Web Share + clipboard fallback chain
        └── rewards\                  # tiers, builder, signer for Apple Wallet
```

---

## Outstanding / next session candidates

### 🪧 Printable QR code artwork for in-bar enrollment
Saloon-aesthetic table tents, coasters, door decals featuring the enrollment QR code. Should match the western/dive bar visual language. Probably needs an illustrator.

### 💳 Phase 2 Corral Rewards: Square Loyalty wiring
Currently all generated passes hardcode `points: 0`. Phase 2 wires Square Loyalty API → `buildPass()` so pass shows real customer point balance. Requires Square API setup and probably webhooks.

### 📡 Phase 3 Corral Rewards: pass push updates
Currently `webServiceURL` is placeholder. Phase 3 implements Apple's push API so when a customer earns points at the bar, their pass updates without re-downloading.

### 🍻 Stripe live mode
Currently test mode. Activate when bank account is ready. Once live, enable `SHOW_MERCH = true` after product photos and build the Stripe webhook for order status. Flip `SHOW_GIFT_CARDS = true` to relaunch gift cards.

### 🐎 Vestaboard hero experiment (declined, archived)
Vestaboard-style animated marquee hero with flip cards was built and rejected. Branch `hero-vestaboard` deleted. Concept worked technically but felt more "boardwalk attraction" than "moody saloon."

---

## Brady's working preferences

- Slow-and-safe pacing on multi-step builds (one step at a time, verify each)
- Wants gap-free terminal commands with full strings (no placeholders to fill in)
- Strongly prefers seeing/testing builds locally before production deploy
- Comfortable trashing experiments cleanly via branch deletion
- Uses Claude Code as primary implementation tool, Claude chat for architecture and diagnostics
- Other active projects: prediction market trading bot (EU EC2, Polymarket repricing), "Wrapped" iOS app (HealthKit story recaps, working on iPhone, pending TestFlight), "It's 5 O'Clock Somewhere" social drinking app (Expo + Supabase), AutoLink automotive parts platform (Next.js 15)

---

## Notes / gotchas

- **PowerShell quirks:** No `-SkipHttpErrorCheck` flag (5.1 limitation). Long sessions sometimes suppress earlier `Write-Output` lines and only echo the last one — use `Out-File` + `notepad` for reliable multi-line output. `System.Net.Http` assembly drops out of session after time/restarts; reload with `Add-Type -AssemblyName System.Net.Http`.
- **Git line endings:** Windows shows `LF will be replaced by CRLF` warnings on commit — harmless, just informational.
- **Next.js ISR cache:** Hard refresh (Ctrl+Shift+R) + DevTools "Disable cache" needed to bust caching during dev. `Remove-Item -Recurse -Force .next` for full purge.
- **Instagram tokens:** Use Instagram Login flow (not Facebook Login). The Facebook Login path had unexplained "system error" 400s that never resolved. Instagram Login generates long-lived tokens directly from dashboard — no OAuth exchange dance needed.
- **Supabase service-role key:** Bypasses all RLS. Never expose to client code. Only used in server-side routes and the cron handler.
- **TZ bug to avoid:** `new Date('2026-06-25')` parses as UTC midnight, `getDate()` returns local day = 24 in PST. Use `parseEventDate()` helper which splits the ISO string and constructs `new Date(y, m-1, d)` for local components.
- **iframe aspect ratio:** Don't use CSS `aspect-ratio` on a wrapper containing an iframe — iframe's 300×150 intrinsic size breaks it. Use the `padding-bottom: 56.25%` (or `45%` for narrower) trick with `position: absolute; inset: 0` on the iframe.
- **CartProvider scope:** `Topbar` consumes `useCart()`. Any route mounting `Topbar` must be wrapped in `CartProvider` (see `CardClient` split pattern).
- **AgeGate centering is locked:** After 4 iterations the only layout that worked across desktop Chrome + iOS Safari is bare `position: fixed; inset: 0; display: grid; place-items: center` with a single `.inner` wrapper. Don't refactor.
- **Marquee keyframes location:** `@keyframes marqueeScroll` MUST live inside `Marquee.module.css` (not globals) — CSS Modules can't resolve external keyframe references reliably.
