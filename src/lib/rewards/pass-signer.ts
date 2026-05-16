/**
 * Wraps passkit-generator to produce a signed .pkpass byte stream.
 *
 * Certs come from base64-encoded env vars instead of files because Vercel's
 * serverless filesystem is ephemeral / read-only — easier to ship secrets
 * through the env-var pipeline than to wrangle bundled cert files.
 *
 * If any required cert env var is missing, signWalletPass returns null and
 * lets the API route turn that into a structured 503 response.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { PKPass } from 'passkit-generator'
import type { BuiltPass } from './pass-builder'

// ── Env / image asset paths ───────────────────────────────────────────

const PASS_TYPE_ID = process.env.APPLE_PASS_TYPE_ID || 'pass.com.okcorralsaloon.rewards'
const TEAM_ID      = process.env.APPLE_TEAM_ID      || ''
const KEY_PASS     = process.env.APPLE_PASS_KEY_PASSPHRASE || ''

const CERT_B64 = process.env.APPLE_PASS_CERT_PEM_B64 || ''
const KEY_B64  = process.env.APPLE_PASS_KEY_PEM_B64  || ''
const WWDR_B64 = process.env.APPLE_WWDR_PEM_B64      || ''

/**
 * Apple Wallet requires icon.png at minimum. icon@2x.png + icon@3x.png are
 * highly recommended (Retina rendering). All other images are optional.
 *
 * Drop these in /public/assets/wallet/ — see docs/apple-wallet-setup.md.
 */
const REQUIRED_IMAGES = ['icon.png'] as const
const OPTIONAL_IMAGES = [
  'icon@2x.png',
  'icon@3x.png',
  'logo.png',
  'logo@2x.png',
  'strip.png',
  'strip@2x.png',
] as const

const WALLET_ASSETS_DIR = path.join(process.cwd(), 'public', 'assets', 'wallet')

// ── Public types ──────────────────────────────────────────────────────

export type SignResult =
  | { ok: true; buffer: Buffer; serialNumber: string }
  | { ok: false; reason: SignErrorReason; missing?: string[]; detail?: string }

export type SignErrorReason =
  | 'apple_not_configured'
  | 'icon_missing'
  | 'signing_failed'

/** Quick check the API route can use to short-circuit before doing work. */
export function isAppleWalletConfigured(): boolean {
  return Boolean(TEAM_ID && CERT_B64 && KEY_B64 && WWDR_B64)
}

/** What's missing if isAppleWalletConfigured() is false. */
export function missingAppleConfig(): string[] {
  const missing: string[] = []
  if (!TEAM_ID)  missing.push('APPLE_TEAM_ID')
  if (!CERT_B64) missing.push('APPLE_PASS_CERT_PEM_B64')
  if (!KEY_B64)  missing.push('APPLE_PASS_KEY_PEM_B64')
  if (!WWDR_B64) missing.push('APPLE_WWDR_PEM_B64')
  return missing
}

// ── Main ──────────────────────────────────────────────────────────────

export async function signWalletPass(built: BuiltPass): Promise<SignResult> {
  if (!isAppleWalletConfigured()) {
    return { ok: false, reason: 'apple_not_configured', missing: missingAppleConfig() }
  }

  // Load image assets from disk. icon.png is mandatory — others are
  // included only if present (the user might not have generated retina /
  // logo / strip variants yet).
  const imageBundle: Record<string, Buffer> = {}
  try {
    for (const name of REQUIRED_IMAGES) {
      imageBundle[name] = await fs.readFile(path.join(WALLET_ASSETS_DIR, name))
    }
  } catch {
    return { ok: false, reason: 'icon_missing', missing: [...REQUIRED_IMAGES] }
  }
  for (const name of OPTIONAL_IMAGES) {
    try {
      imageBundle[name] = await fs.readFile(path.join(WALLET_ASSETS_DIR, name))
    } catch {
      // optional — skip silently
    }
  }

  // Decode certs from base64 env vars to PEM buffers.
  const certs = {
    wwdr: Buffer.from(WWDR_B64, 'base64'),
    signerCert: Buffer.from(CERT_B64, 'base64'),
    signerKey: Buffer.from(KEY_B64, 'base64'),
    signerKeyPassphrase: KEY_PASS || undefined,
  }

  // Assemble the in-memory pass model: pass.json + image bundle, plus the
  // top-level identifiers that passkit-generator wants at construction time.
  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: PASS_TYPE_ID,
    teamIdentifier: TEAM_ID,
    serialNumber: built.serialNumber,
    ...built.passOverrides,
  }

  try {
    const pass = new PKPass(
      {
        ...imageBundle,
        'pass.json': Buffer.from(JSON.stringify(passJson)),
      },
      certs as ConstructorParameters<typeof PKPass>[1],
    )

    return {
      ok: true,
      buffer: pass.getAsBuffer(),
      serialNumber: built.serialNumber,
    }
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err)
    return { ok: false, reason: 'signing_failed', detail }
  }
}
