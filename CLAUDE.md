# OK Corral Website — Handoff Doc

**Last updated:** May 17, 2026
**Owner:** Brady Olsen (25% co-owner, SIX SHOT LLC)
**Live site:** https://www.okcorralsaloon.com
**Repo:** https://github.com/Vitruvion/ok-corral-site
**Project root:** `C:\Projects\ok-corral-site`
**Latest deployed commit:** `bd2b410` (feat(ig): auto-refresh Instagram access token via Vercel cron)

---

## Stack

- **Frontend:** Next.js 14.2.x App Router, TypeScript
- **Database:** Supabase (project ref `oqfjlsmsthcuamkncpfb`)
- **Hosting:** Vercel (auto-deploy from `main` branch)
- **Payments:** Stripe (test mode — gift cards working, live mode pending bank account)
- **Email:** Resend
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
- IG account is registered as Instagram Tester on the Meta app

---

## Active features and their wiring

### 1. Site polish (deployed)

- Tagline: "NorCal's favorite western dive bar."
- Established year: 1954 (Hero.tsx line ~127 and `BRAND.since` in `src/lib/data.ts`)
- Hero: parallax storefront photo + dust particles + animated wordmark + NEXT UP badge + tagline + What's On button
- Marquee: rAF-driven scroll (50 px/s), drag-to-pan with smooth resume, mobile 16px font + 40px gap below 760px
- Marquee items in `data.ts` use `{text, accent}` shape; written with BOM-less UTF-8 via `[System.IO.File]::WriteAllText` to avoid mojibake
- Gallery labels (in `data.ts`): g4="Ladies", g9="Patio Night", g12="Locals", g14="Dillon", g15="The Boys"
- Dustin Dale Gaspard event has IG profile image at `public/assets/gallery/dustin-ig.jpg` (200×200, both `data.ts` and Supabase events table)

### 2. Apple Wallet — Corral Rewards (Phase 1, deployed)

Working `/card` page generates signed `.pkpass` files. Brady's iPhone test confirmed: THE OK CORRAL header, OK monogram icon, TIER: Newcomer, MEMBER: Brady Olsen, POINTS: 0, PROGRESS: 500 to Regular, all 5 tier perks on the back, QR code OKC-5303482062.

**5-tier ladder:** Newcomer (0) → Regular (500) → Local (1500) → Familiar Face (3500) → One of Ours (7500)

**Files:**
- `src/lib/rewards/tiers.ts`
- `src/lib/rewards/pass-builder.ts`
- `src/lib/rewards/pass-signer.ts`
- `src/app/api/card/pass/route.ts` (must keep `export const dynamic = 'force-dynamic'` + `runtime = 'nodejs'`)
- `src/app/card/page.tsx` + `CardClient.tsx`
- Wallet icons (OK monogram): `public/assets/wallet/icon.png` + `icon@2x.png` + `icon@3x.png` + `logo.png` + `logo@2x.png` + `logo@3x.png`

**Critical technical knowledge embedded in code (preserve when editing):**
- `pass-signer.ts` lazy-loads `passkit-generator` via `await import()` to fix Vercel build-trace ENOENT
- `passkit-generator` wipes `storeCard.*Fields` from `pass.json`; must populate via `pass.headerFields.push()` API plus `pass.type = 'storeCard'` setter
- `authenticationToken` must be ≥16 chars: `(serialNumber + '-okcorral-rewards').slice(0, 64)`
- Apple Wallet key encryption MUST be PKCS#1 traditional format with DES-EDE3-CBC (NOT AES-256, NOT PKCS#8) — `node-forge` parser limitation. Command: `openssl rsa -in signerKey.pem -des3 -traditional -out signerKey.encrypted.pem -passout "pass:$passphrase"`

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

**Refresh endpoint behavior:**
- Returns 401 if `Authorization: Bearer <CRON_SECRET>` header missing or wrong
- Returns 500 with detailed error JSON if Supabase read fails, Instagram API call fails, or response is malformed
- On any failure, does NOT update the Supabase row (old token stays valid)
- Returns 200 with `{ok: true, expires_at, days_until_expiry, token_length}` on success
- Vercel manual run button works (uses Vercel's automatic CRON_SECRET injection)

**Manual refresh (if ever needed):** Vercel Dashboard → Cron Jobs → click "Run" next to `/api/cron/refresh-instagram-token`. Or hit endpoint with curl/HTTP client including the Bearer header.

**If everything breaks:** Generate a fresh long-lived token directly from Meta dashboard at App → Instagram API → "API setup with Instagram login" → Generate token button. Then `UPDATE service_tokens SET access_token=..., expires_at=now()+interval '60 days', refreshed_at=now() WHERE id='instagram';`

### 4. Other features (status)

- Stripe gift card checkout (working in test mode; live mode pending bank account)
- Resend email integration (transactional emails)
- Square POS already connected to IG account (Square-IG app visible in IG settings)
- Drinks/events/merch CMS in Supabase
- Real bar photos uploaded
- GoDaddy DNS pointing to Vercel

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
├── public\
│   └── assets\
│       ├── wallet\                   # icon + logo (1x, 2x, 3x)
│       └── gallery\                  # site photos including dustin-ig.jpg
└── src\
    ├── app\
    │   ├── page.tsx                  # home → fetchAll() → ClientShell
    │   ├── card\page.tsx + CardClient.tsx
    │   └── api\
    │       ├── card\pass\route.ts    # wallet pass generator
    │       └── cron\refresh-instagram-token\route.ts
    ├── components\
    │   ├── Hero.tsx + Hero.module.css
    │   ├── Marquee.tsx + Marquee.module.css
    │   ├── InstagramStrip.tsx
    │   └── ClientShell.tsx           # wires everything
    └── lib\
        ├── data.ts                   # central data, feature flags (SHOW_MERCH, SHOW_GIFT_CARDS), BRAND
        ├── supabase.ts               # getSupabase() + getServiceSupabase()
        ├── queries.ts                # fetchAll() + per-table queries
        ├── instagram.ts              # token reader + media fetcher
        └── rewards\                  # tiers, builder, signer for Apple Wallet
```

---

## Outstanding / next session candidates

### 🎨 `/card` landing page Phase 4 polish
The Corral Rewards page works (pass generation pipeline complete) but the landing page UI is minimal scaffold. Needs:
- Pass mockup design / hero image
- Polished tier ladder visualization (currently text-only)
- Better CTA flow before pass download
- Mobile optimization

### 🪧 Printable QR code artwork for in-bar enrollment
Saloon-aesthetic table tents, coasters, door decals featuring the enrollment QR code. Should match the western/dive bar visual language. Probably needs an illustrator.

### 💳 Phase 2 Corral Rewards: Square Loyalty wiring
Currently all generated passes hardcode `points: 0`. Phase 2 wires Square Loyalty API → `buildPass()` so pass shows real customer point balance. Requires Square API setup and probably webhooks.

### 📡 Phase 3 Corral Rewards: pass push updates
Currently `webServiceURL` is placeholder. Phase 3 implements Apple's push API so when a customer earns points at the bar, their pass updates without re-downloading.

### 🍻 Stripe live mode
Currently test mode. Activate when bank account is ready. Once live, enable `SHOW_MERCH = true` after product photos and build the Stripe webhook for order status.

### 🐎 Vestaboard hero experiment (declined, archived)
We built a vestaboard-style animated marquee hero with flip cards cycling through brand line + next event. Brady decided the original cinematic storefront photo hero feels stronger ("I want to trash it all"). Branch `hero-vestaboard` was deleted cleanly. If we ever revisit: the concept worked technically but felt more "boardwalk attraction" than "moody saloon." Going back would require committing to the western-illustrated direction site-wide.

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
- **Instagram tokens:** Use Instagram Login flow (not Facebook Login). The Facebook Login path had unexplained "system error" 400s during our session that never resolved. Instagram Login generates long-lived tokens directly from dashboard — no OAuth exchange dance needed.
- **Supabase service-role key:** Bypasses all RLS. Never expose to client code. Only used in server-side routes and the cron handler.
