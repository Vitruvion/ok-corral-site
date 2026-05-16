# Apple Wallet pass setup (Corral Rewards)

This document gets you from "nothing" to a working signed `.pkpass` that you
can install on your iPhone by tapping the **Add to Apple Wallet** button on
`/card`. It's Phase 1 of the loyalty system: the static pass. Phase 2 (Square
Loyalty) and Phase 3 (live pass updates via APNs) come later.

The pipeline is wired up in code; only thing left is the Apple-side keys and
the three small icon PNGs. Everything's read from env vars / `public/assets/wallet/`
so there's no fishing through code to enable it — drop the values in and the
existing `POST /api/card/pass` route starts returning signed passes.

## What you need from Apple

Active Apple Developer Program membership (your Team ID is already noted as
**`552ZY96UV6`**). If you're not enrolled yet: <https://developer.apple.com/programs/>
($99/year).

## Step 1 — register a Pass Type ID

1. Go to <https://developer.apple.com/account/resources/identifiers/list/passTypeId>
2. Click the **+** to register a new identifier
3. Choose **Pass Type IDs** → Continue
4. **Description:** `OK Corral Rewards`
5. **Identifier:** `pass.com.okcorralsaloon.rewards`
6. Click **Continue → Register**

This identifier is what the code uses for `passTypeIdentifier`. It's already
the default in `APPLE_PASS_TYPE_ID` — no change needed unless you used a
different name.

## Step 2 — generate a Pass Type signing certificate

Still on the same Pass Type ID detail page (or back at `identifiers/list/passTypeId`
→ click your new pass type):

1. Click **Create Certificate**
2. Apple asks for a Certificate Signing Request (CSR)
   - Open **Keychain Access** on a Mac
   - Menu: **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority**
   - Email: anything; Common Name: `OK Corral Pass Signing`
   - Choose **Saved to disk** → save the `.certSigningRequest` somewhere
3. Back in Apple's portal: upload the CSR
4. Apple gives you a `pass.cer` — download it
5. Double-click `pass.cer` — Keychain imports it (under "Certificates")
6. Find the cert in Keychain → expand the arrow → there's a private key
   nested underneath it (the one Keychain made when you created the CSR)
7. Select **both** the certificate and the private key → right-click → **Export 2 items…**
8. Save as `pass.p12`, set a password (you'll need this later)

## Step 3 — convert .p12 → PEM and base64-encode

The signing library wants PEM-encoded cert + key. The simplest path:

```bash
# Extract the signer certificate
openssl pkcs12 -in pass.p12 -clcerts -nokeys -out signerCert.pem -legacy

# Extract the private key (you'll be prompted for the .p12 password + a new
# passphrase to encrypt the output key). Use the SAME passphrase for both
# prompts to keep things simple; that's what goes in APPLE_PASS_KEY_PASSPHRASE.
openssl pkcs12 -in pass.p12 -nocerts -out signerKey.pem -legacy
```

> The `-legacy` flag is required on OpenSSL 3.x (macOS Sonoma+) because
> Apple's `.p12` files use older RC2 encryption.

Then base64-encode each PEM for the env vars (the files contain newlines that
the Vercel env-var pipeline doesn't love — base64 is the cleanest workaround):

```bash
base64 -i signerCert.pem | tr -d '\n' > signerCert.b64
base64 -i signerKey.pem  | tr -d '\n' > signerKey.b64
```

## Step 4 — grab the WWDR intermediate certificate

Apple's signing chain has an intermediate CA. Download it:

<https://www.apple.com/certificateauthority/AppleWWDRCAG3.cer>

Convert to PEM and base64:

```bash
openssl x509 -inform der -in AppleWWDRCAG3.cer -out wwdr.pem
base64 -i wwdr.pem | tr -d '\n' > wwdr.b64
```

## Step 5 — populate environment variables

Open `.env.local` (and Vercel's project Environment Variables for production):

```
APPLE_TEAM_ID=552ZY96UV6
APPLE_PASS_TYPE_ID=pass.com.okcorralsaloon.rewards
APPLE_PASS_CERT_PEM_B64=<paste the contents of signerCert.b64>
APPLE_PASS_KEY_PEM_B64=<paste the contents of signerKey.b64>
APPLE_PASS_KEY_PASSPHRASE=<the password you set on the .p12 / signerKey.pem>
APPLE_WWDR_PEM_B64=<paste the contents of wwdr.b64>
```

## Step 6 — add icon images

Apple requires `icon.png` (29×29). Retina variants are highly recommended.
Drop into `public/assets/wallet/`:

| File              | Size      | Status      |
| ----------------- | --------- | ----------- |
| `icon.png`        | 29×29     | required    |
| `icon@2x.png`     | 58×58     | recommended |
| `icon@3x.png`     | 87×87     | recommended |
| `logo.png`        | 160×50    | optional    |
| `logo@2x.png`     | 320×100   | optional    |
| `strip.png`       | 375×123   | optional    |
| `strip@2x.png`    | 750×246   | optional    |

The `strip.png` is the main visual area on the front of the pass — a dark
background with the OK Corral wordmark in gold reads beautifully. Use the
existing horse-and-rider art or the wordmark.

Any image missing from the optional list is just skipped silently. If
`icon.png` is missing, the API returns a 503 telling you so.

## Step 7 — test locally

```
npm run dev
# → open http://localhost:3000/card
# → fill the form, click Add to Apple Wallet
# → on macOS: a .pkpass file downloads (double-click → preview opens)
# → on iOS Safari: tap the button, the pass opens directly in Wallet
```

If you see a 503 with a `missing` list, those env vars or files aren't in
place yet — work through the steps above to fill them in.

## Step 8 — deploy to Vercel

Push the env vars to Vercel:

```bash
# Or do this in the Vercel dashboard under Settings → Environment Variables
vercel env add APPLE_TEAM_ID
vercel env add APPLE_PASS_TYPE_ID
vercel env add APPLE_PASS_CERT_PEM_B64
vercel env add APPLE_PASS_KEY_PEM_B64
vercel env add APPLE_PASS_KEY_PASSPHRASE
vercel env add APPLE_WWDR_PEM_B64
```

The pass icons in `public/assets/wallet/` ship with the deploy automatically.
Redeploy after adding the env vars.

## Troubleshooting

- **"Apple Wallet pass signing is not configured"** — one or more env vars
  are missing. The 503 body lists which ones.
- **"Pass icon images are missing"** — `icon.png` isn't in `public/assets/wallet/`.
- **`getAsBuffer` throws / signing_failed** — the cert + key likely don't
  match each other, or the passphrase is wrong. Re-run Step 3 carefully.
- **Pass downloads but Wallet says "Cannot be added"** — usually a mismatch
  between the certificate's Pass Type ID and `APPLE_PASS_TYPE_ID`. Make sure
  both reference the same `pass.com.…` identifier.
- **macOS won't open the .pkpass** — drag it into the Wallet app in the
  iCloud sidebar, or open the file via Mail / Messages on iPhone.

## What's next (Phase 2)

Once Phase 1 passes are installing on your phone, Phase 2 plugs the pass
into Square Loyalty so points actually accrue. That brings in:

- Square Loyalty subscription + program config
- `CreateLoyaltyAccount` call during sign-up (replaces the Phase-1 phone-only flow)
- Webhook listener for `loyalty.account.updated`

Phase 3 closes the loop with APNs push notifications so the pass on the
customer's phone updates silently when their tier changes.
