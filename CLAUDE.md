# OK Corral Website — Handoff Doc

**Last updated:** August 31, 2026
**Owner:** Brady Olsen (25% co-owner, SIX SHOT LLC)
**Live site:** https://www.okcorralsaloon.com
**Repo:** https://github.com/Vitruvion/ok-corral-site
**Project root:** `C:\Projects\ok-corral-site`

> There is deliberately no "latest deployed commit" line. It was wrong for
> months, and a wrong line is worse than no line — `git log -1` is always
> right. `main` auto-deploys to Vercel, so HEAD on `main` *is* production.

---

## WORKFLOW: AUTO-PUSH AFTER EVERY COMMIT

After making any commit, immediately run `git push origin main` without asking for confirmation. Brady prefers continuous deployment over per-commit review.

**Exceptions:**

1. **Not on `main`.** If the commit is to a branch other than `main` (e.g., a feature branch for review), do NOT auto-push — wait for instruction.
2. **Controversial or destructive.** If the commit deletes large amounts of code, rewrites git history, or would require a force push, STOP and ask before pushing.
3. **Failed verification.** If the commit fails verification (visual check, test, build), roll it back locally rather than pushing broken code.

For normal feature work, bug fixes, content updates, brand assets, and data changes: commit + push in one motion. After pushing, remind Brady of any manual deploy steps (e.g., running `supabase/seed.sql` in the Supabase SQL Editor, refreshing an Instagram token, re-running `npm run export-poster`).

---

## WORKFLOW: NEVER MUTATE PRODUCTION DATA WHILE TESTING

There is one Supabase database and it is production. Nothing done to *verify*
work may change data Brady created. These three rules exist because each was
broken, with a real consequence:

### 1. No side-effectful probes. Ask instead.

Never call a function to find out whether it exists, and never infer whether a
migration has been applied — Brady applies migrations by hand the moment he is
given them, and his database state is not observable from here.

- **What went wrong:** probing for migration 0015 by invoking
  `set_featured_event(null)` and reading the error. That function's entire
  purpose is to clear the featured flag. Detecting applied state is not worth a
  write.
- **Instead:** ask, or say the applied state can't be determined. If a probe is
  genuinely unavoidable it must be provably inert — e.g. re-featuring the row
  that is already featured, which is a no-op by construction.

### 2. Scope every test selector to rows the test created.

Never `.first()` on a list that also contains real rows, in Playwright or in a
query.

- **What went wrong:** `page.locator('button', { hasText: /^Restore$/ }).first()`
  clicked Brady's "The ducks" instead of the scratch row, because it sorted
  ahead of the 2099-dated test data. It silently un-hid an event he had
  deliberately hidden.
- **Instead:** filter to the row by name or id first, then act inside it:
  `page.locator('section').filter({ hasText: 'ZZ Test' }).locator('button', ...)`.
- **Better still:** use PGlite or the in-memory PostgREST fake unless the test
  specifically needs production. Most don't.

### 3. Verify cleanup with an independent read, and paste its output.

A `console.log` inside the script that performed the mutation is **not**
verification. It can run before the write commits, report what the code
intended rather than what landed, or sit downstream of an error that was never
checked.

- **What went wrong:** twice reported "featured restored to Dustin Dale
  Gaspard" when a scratch row still held the flag. Brady found it by querying
  directly and fixed it by hand, both times. In Brady's words: *"I restored it"
  is not evidence.*
- **Instead:** check the `error` field on every mutation, then run a SEPARATE
  query afterwards and paste its result — zero rows for anything created, and
  any flag that was moved (`featured`, `active`) shown back where it started.
- If the read disagrees with what was expected, say so plainly rather than
  describing the intent.

---

## Routes

**Public**

| Route | What it is |
|---|---|
| `/` | The site. Hero, events, drinks, gallery, Instagram strip. ISR, `revalidate = 60`. |
| `/card` | Corral Rewards — Apple Wallet pass landing + enrollment. |
| `/tickets/success` | Where Stripe returns a ticket buyer. Shows no codes; those go by email. |
| `/menu-board` | The TV behind the bar. Fixed 3-column board, self-refreshing every 5 min. No chrome, no login. |
| `/poster/dustin-gaspard` + `/instagram` | Print and 4:5 social poster for one show. |

**Admin** — all behind the `corral_admin` cookie via `src/middleware.ts`. One
shared passcode, 30-day cookie, no per-user accounts. Every route re-checks the
cookie itself rather than trusting middleware.

| Route | What it is |
|---|---|
| `/admin/login` | The only ungated admin route. |
| `/admin/menu` | Drinks editor. Phone-first, per-row saves. |
| `/admin/events` | Events editor: create/edit/delete shows, ticket sales, poster upload. |
| `/admin/tickets` | Sales + will-call sheet. Revenue split by payment method, never summed. |
| `/admin/door` | The door scanner. Installable PWA, works offline. |

**API** — `/api/checkout` (merch + gift cards), `/api/tickets/checkout`,
`/api/tickets/availability`, `/api/stripe/webhook` (merch AND tickets, branched
on `metadata.kind`), `/api/order-summary`, `/api/card/pass`,
`/api/booking-notify`, `/api/cron/refresh-instagram-token`, and under
`/api/admin/`: `drinks`, `events`, `events/sales`, `events/poster`,
`door/manifest`, `door/scan`, `door/sale`, `login`, `logout`.

---

## Source of truth — read before editing seed.sql

**Drinks and events are authoritative in Supabase.** They are edited at
`/admin/menu` and `/admin/events`, so re-running `supabase/seed.sql` used to
silently throw away every price, date and description the owners had entered.

Both blocks are now wrapped in `if not exists (select 1 from <table>)`, so on
any seeded database they are a **no-op**. They exist only to bootstrap a
completely empty database. To deliberately reset, empty the table first.

Anything else in seed.sql (recurring events, merch, settings) is still
authoritative in the file.

**Eventbrite is retired.** Nothing reads `events.eventbrite_url` and nothing
renders from it. The column and its values are kept as a record of past shows —
do not drop it, and do not add a UI that writes to it. A show either sells
tickets directly (`tickets_on_sale` + `ticket_price`) or shows the
"Free Admission" badge. There is deliberately no third path.

---

## Migrations

Brady applies these by hand in the Supabase SQL Editor, immediately, the moment
he is handed the file. **Never infer whether one has been applied — ask.**

`0001_init` · `0002_events_eventbrite_url` · `0003_orders_and_gift_cards` ·
`0004_events_featured_and_related` · `0005_events_youtube_url` ·
`0006_events_signup_url` · `0007_merch_orders_fulfillment` ·
`0008_recurring_events_poster` · `0009_drinks_editor` · `0010_drinks_cigars` ·
`0011_cigars_price_order` · `0012_ticketing` · `0013_tickets_seq` ·
`0014_door_sales` · `0015_events_editor`

Run every new migration through `python scripts/ascii-seed.py <file>` before
handing it over — the Supabase SQL editor has mojibake'd UTF-8 in the past, so
migration and seed files are kept pure 7-bit ASCII.

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
- Gallery (16 items): photos render in a 12-col masonry grid with per-item `cols`/`rows` spans from `GALLERY` in `src/lib/data.ts`. No captions (removed); each tile keeps its hover zoom glyph and click-to-lightbox behavior.
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
- "Get Tickets" when `tickets_on_sale` is true, "Free Admission" badge otherwise. Eventbrite is gone — see **Source of truth** above
- Past shows drop off the homepage by **venue calendar day** (America/Los_Angeles), not by UTC and not by the browser's clock. `filterUpcomingEvents` / `isEventUpcoming` / `venueTodayParts` in `src/lib/events.ts` are the only correct comparison — import them, never re-derive one
- All "Doors" references removed from public copy, but `doors` is still a real field: the ticket confirmation email and the door manifest both read it
- Only one event may be `featured` at a time, enforced by a partial unique index. Featuring is a **swap**, done atomically by `set_featured_event(uuid)` — not a toggle, and not two UPDATEs

### 6. Event posters + export pipeline (deployed)

A show can get a standalone poster route: `/poster/<slug>` renders a 1080x1800
print broadside, `/poster/<slug>/instagram` the same content reflowed to
1080x1350 for a 4:5 post. `PosterScaler.tsx` / `InstagramPosterScaler.tsx`
letterbox the fixed-pixel design into the viewport and re-fit on
`visualViewport.resize` (see the iOS `100vh` note under Notes / gotchas).
`/poster/dustin-gaspard` is the one built so far and the template to copy.

**`npm run export-poster`** turns those routes into print-ready artifacts.
`scripts/export-poster.ts` spawns its own Next dev server on port 4099, waits
for fonts and images, pins the poster to native 1:1 (overriding the scaler's
transform), and writes two PNGs — a 2160x3600 print master and the 1080x1350
IG image — to `public/poster-exports/<slug>/`, alongside a README explaining
what to do with each. No PDF; the print shops take the PNG.

- The slug is hardcoded in constants at the top of the script (`OUT_DIR`,
  `PRINT_ROUTE`, `IG_ROUTE`). A second poster means editing those three.
- Deps are devDependencies: `playwright` + `tsx`. Chromium is a one-time
  `npx playwright install chromium`.
- **Windows:** `spawn('npx', ...)` needs `shell: true` for the `.cmd` shim to
  resolve. Already wired in the script.

### 7. Brand assets (committed)

Master brand files in `/brand/`:

- `brand/OK_Corral_Logos_for_dark.pdf` — 19-page vector PDF of OK Corral logos for dark backgrounds. White artwork on solid black. **Page 9** is the hand-drawn OK monogram used as the source for the favicon set and the red variants below.
- `brand/ok-monogram-red-transparent.png` — 1024×1024 RGBA, strokes recolored to `#902C1A` (barn red, matches the flyer ink), background transparent. Anti-aliased edges preserved as continuous alpha gradient.
- `brand/ok-monogram-red-on-cream-rounded.png` — same monogram on a `#E9D9BB` cream rounded square (radius ~12% of canvas), corners outside the rounded shape are transparent. Drop-in QR center logo when the QR pattern is busy.
- `brand/README.md` — enumerates all three variants with "use when" notes + regeneration instructions.

**Brand red is `#902C1A`** (oxblood, matches the printed flyer). The poster CSS uses `#8e2a18` for some legacy "tobacco red" elements — both are very close visually; treat them as effectively the same hue.

### 8. Drinks (deployed)

- Hucklebeer featured beer card (replaced old Scorpion Shot)
- Tabs: `Saloon Cocktails` / `Shots & Bombs` / `Featured Beer`
- **Supabase is the only source.** The old `data.ts` fallback is gone — `fetchDrinks()` throws rather than quietly serving stale hardcoded prices to the bar
- Edited at `/admin/menu`; a subset is excluded from the TV board (see §12)
- Mobile fix: Hucklebeer meta grid `white-space: normal; word-break: break-word; line-height: 1.15` at ≤760px

### 9. Stripe + Resend (deployed, test mode)

- `/api/checkout` — Stripe Checkout Sessions with discriminated union `kind: 'gift_card' | 'merch'`. No explicit `apiVersion` on the client.
- `/api/booking-notify` — Resend transactional email; no-ops gracefully when `RESEND_API_KEY` missing
- `StripeReturnHandler.tsx` — reads `?stripe=success&kind=...&session_id=...` on mount, shows confirmation modal, clears cart for merch, strips params via `history.replaceState`
- **Cart-clearing race fix in `src/lib/cart.tsx`:** `clear()` sets `clearedRef.current = true` + sync `localStorage.removeItem` + `setLines([])` + `setOpen(false)`. Hydration and persist effects honor `clearedRef`. `addItem` resets the ref.

### 10. Mojibake defense (multi-layer)

- **Layer 1 — source:** `scripts/ascii-seed.py` produces pure 7-bit ASCII `supabase/seed.sql` (idempotent).
- **Layer 2 — runtime:** `unmojibake()` in `src/lib/queries.ts` self-heals UTF-8-as-Latin-1 round-trips via `TextDecoder` round-trip detection. Applied to all string fields read from Supabase.
- **Layer 3 — write hygiene:** All seed/data file edits use BOM-less UTF-8.

### 11. Other status

- Square POS already connected to IG account
- Drinks, events and merch live in Supabase; drinks and events are edited in-app (§15)
- GoDaddy DNS pointing to Vercel
- `SHOW_MERCH = false` and `SHOW_GIFT_CARDS = false` — flip a single bool to launch each section
- **Mobile pass flip + ladder rungs:** both formerly broken on iOS; fixed in commits `89dc740` (filter removed) + `7e490d9` (local fade-up keyframes). Don't reintroduce filter on `.card`.

### 12. Menu board — the TV behind the bar (deployed)

`/menu-board` renders drinks as a fixed 3-column board for a wall-mounted TV.
No nav, no age gate, no login. ISR `revalidate = 300` plus a client refresh, so
a price edited at `/admin/menu` reaches the screen without anyone touching it.

- `BOARD_EXCLUDED_CATEGORIES` keeps some categories off the board. `/admin/menu`
  labels those rows **website only** by importing that same list — do not
  re-declare it.
- The board cannot scroll, so extra drinks silently fall off the bottom. An
  overflow guard measures each column against the content floor after mount and
  `console.warn`s; in dev it also draws a visible marker. It never throws — a
  guard that breaks the board is worse than the overflow it detects.

### 13. Ticketing (deployed — Stripe test mode)

Tickets are sold on our own site. Replaces Eventbrite entirely.

**Buy → pay → issue.** `/api/tickets/checkout` creates a Stripe Checkout Session
against a pending `ticket_orders` row; `/api/stripe/webhook` (branching on
`metadata.kind`) marks it paid and issues the `tickets`; Resend sends the codes.
`/tickets/success` deliberately shows no codes — email is the delivery channel,
and the success URL is guessable.

- **Issuance is safe under concurrent webhook delivery, and the guarantee is in
  the schema, not in JS.** Stripe retries and can deliver the same event twice
  in parallel; a count-then-insert cannot be made safe by checking first.
  `tickets` has `UNIQUE (order_id, seq)` and issuance is `ON CONFLICT DO
  NOTHING`, so a second delivery inserts nothing. Claiming an order is a single
  conditional UPDATE (`where status = 'pending'`), so exactly one delivery wins.
  Keep both properties if you touch `src/lib/tickets/complete.ts`.
- **`src/lib/tickets/occupancy.ts` is THE count.** Sold = non-void `tickets`
  rows + `sum(quantity)` of paid door orders. Six call sites read it. Do not
  count tickets anywhere else.
- Ticket codes are signed with `TICKET_SIGNING_SECRET`. **Server-only — it must
  never appear in a `NEXT_PUBLIC_` var or reach a browser.**
- `/admin/tickets` is the sales + will-call sheet. Online, door-card and
  door-cash revenue are shown **separately and never summed** — card money
  arrives via Stripe and door money via the bar's own till, so a combined figure
  would be one nobody can reconcile.

### 14. Door scanner + door sales (deployed)

`/admin/door` is one phone, one person, at the door. Installable to the home
screen and **works with no signal** — the venue's connectivity is unreliable and
a scanner that needs the network is a scanner that fails at 8pm.

- Downloads a manifest of the night's tickets up front, then validates scans
  locally against it. Four outcomes: valid, already used, wrong event, unknown.
- The service worker is scoped to `/admin/door` **only** — it must never cache
  the public site. Scope is a URL-prefix string compare, so the default scope
  `/admin/door/` would exclude the page itself; the route sends
  `Service-Worker-Allowed: /admin/door` to widen it. If you change the SW,
  re-verify offline behaviour **on the installed PWA on a device**, not in a
  harness. The iOS install tags live on this route, not in the root layout.
- **Door sales are a tally, not a payment.** Cash, or Square rung at the bar, is
  recorded so the headcount is right. This code processes no money — no Stripe
  Terminal, no Square API. Do not add one. A door sale issues no ticket, no QR
  and no email, so nothing in the UI should call a door row's quantity "tickets".
- Sales queue in IndexedDB when offline and sync later. The scan screen shows the
  queued count and does not scroll (`dvh`, fixed bottom dock for LOOK UP / SELL).

### 15. Admin editors (deployed)

`/admin/menu` (drinks) and `/admin/events` (shows). Both are phone-first — the
owners edit from behind the bar — with per-row saves rather than one big form.

- Auth is the existing `corral_admin` cookie and middleware: one shared passcode,
  no per-user accounts. Every admin route re-checks the cookie itself.
- **Creating a show is three fields** (name, date, time); everything else hides
  behind "More details". Adding a show on a phone should take three taps and a save.
- Poster upload resizes **in the browser** before upload (quality ladder, then
  edge ladder, until under 500KB). The endpoint re-checks the cookie, sniffs
  magic bytes rather than trusting the client's content-type, and caps size
  server-side. Bucket: `event-posters`, public read.
- Changes with money or attendance consequences — moving a date, changing price,
  cutting capacity below tickets sold, stopping sales — return **409 until
  explicitly confirmed**, decided server-side so the client cannot skip it.
- **Delete is a soft delete only when it has to be:** any issued ticket or any
  paid order → deactivate (row kept, poster kept). Otherwise the event is really
  deleted, along with its pending orders and its poster in Storage.
- Featuring a past show is allowed but does nothing visible; the UI says so
  rather than blocking it.

---

## Env vars

### `.env.local` (Brady's machine)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (length 219, starts `eyJh`)
- `STRIPE_SECRET_KEY` (test mode)
- `STRIPE_WEBHOOK_SECRET` (test mode)
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_TO_EMAIL`
- `INSTAGRAM_USER_ID` = `17841403015684418`
- `CRON_SECRET`
- `NEXT_PUBLIC_SITE_URL` — used to build absolute URLs in emails and Stripe redirects
- `ADMIN_PASSCODE` + `ADMIN_COOKIE_SECRET` — the shared admin login and the cookie signing key
- `TICKET_SIGNING_SECRET` — signs ticket codes. **Server-only. Never prefix it `NEXT_PUBLIC_`, never send it to a browser.** Rotating it invalidates every issued ticket
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
│   └── migrations\                  # 0001..0015, listed under Migrations above
├── public\
│   ├── favicon.ico + icon.png + apple-icon.png + icon-192.png + icon-512.png
│   ├── manifest.json
│   ├── poster-exports\dustin-gaspard\  # 2x print PNG + IG PNG + README
│   └── assets\
│       ├── wallet\                   # OK monogram for .pkpass (icon + logo, 1x/2x/3x)
│       ├── posters\                  # dustin-gaspard.jpg + dustin-gaspard-qr.svg
│       └── gallery\                  # site photos + event poster thumbs
└── src\
    ├── middleware.ts                 # gates /admin/* on the corral_admin cookie
    ├── app\
    │   ├── layout.tsx                # Metadata: icons + manifest wiring
    │   ├── page.tsx                  # home → fetchAll() → ClientShell
    │   ├── menu-board\               # the TV board + its overflow guard
    │   ├── tickets\success\          # Stripe return page (shows no codes)
    │   ├── admin\
    │   │   ├── login\
    │   │   ├── menu\                 # drinks editor
    │   │   ├── events\               # events editor + poster upload
    │   │   ├── tickets\              # sales + will-call sheet
    │   │   └── door\                 # scanner PWA: page + DoorClient + DoorPwa
    │   │       ├── manifest.webmanifest\route.ts
    │   │       └── sw.js\route.ts    # Service-Worker-Allowed: /admin/door
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
    │       ├── checkout\route.ts     # Stripe Checkout Sessions (merch + gift cards)
    │       ├── stripe\webhook\       # merch AND tickets, branched on metadata.kind
    │       ├── tickets\              # checkout + availability
    │       ├── admin\                # drinks, events(+sales,poster), door(manifest,scan,sale), login, logout
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
        ├── data.ts                   # BRAND, feature flags. NO drinks/events arrays — those live in Supabase
        ├── events.ts                 # venue-day rules: filterUpcomingEvents, isEventUpcoming
        ├── tickets\                  # codes, complete (issuance), occupancy (THE count), door, manifest, scan, emails
        ├── admin\                    # drinks-repo, events-repo, session/guard, image-resize, rate-limit
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

### 🍻 Stripe live mode — now the blocker for selling tickets
Still test mode, which means **no real ticket can be sold yet**. Activate when the bank account is ready, then re-verify the webhook against the live endpoint secret before announcing a show. Once live: flip `SHOW_MERCH = true` after product photos, `SHOW_GIFT_CARDS = true` to relaunch gift cards.

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

- **A Next route module may only export handlers and a fixed config set.** Exporting a plain const or helper from `route.ts` fails the build with a confusing type error. Hit three times — put shared values in a `lib/` module instead.
- **CSS Modules resolve a missing class to `undefined`.** Deleting a rule that JSX still references does NOT fail the build; the element just loses its styling silently. After removing CSS, grep for every class the file used to define.
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
