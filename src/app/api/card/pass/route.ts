import { NextRequest, NextResponse } from 'next/server'
import { buildPass } from '@/lib/rewards/pass-builder'
import { signWalletPass } from '@/lib/rewards/pass-signer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  name?: string
  phone?: string
}

/**
 * POST /api/card/pass
 *
 * Body: { name: string, phone: string }
 *
 * Success → 200 application/vnd.apple.pkpass binary with download headers.
 * The browser hands it to Wallet on iOS, prompts a download otherwise.
 *
 * Errors:
 *   400 — bad input
 *   503 — Apple Wallet not yet configured (certs not in env, or icon.png
 *         not in /public/assets/wallet/). Body explains what's missing.
 *   500 — signing failed for an unexpected reason (signer returns detail)
 */
export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const name = String(body.name || '').trim()
  const phone = String(body.phone || '').trim()
  if (!name || !phone) {
    return NextResponse.json(
      { error: 'name and phone are required.' },
      { status: 400 }
    )
  }
  if (name.length > 60) {
    return NextResponse.json({ error: 'name too long.' }, { status: 400 })
  }
  if (!/\d{7,}/.test(phone.replace(/\D+/g, ''))) {
    return NextResponse.json(
      { error: 'phone must contain at least 7 digits.' },
      { status: 400 }
    )
  }

  // Phase 1: brand-new member, 0 points, Newcomer tier. Phase 2 will create a
  // Square loyalty account here and seed the real point balance.
  const built = buildPass({ name, phone, points: 0, memberSince: new Date() })

  const result = await signWalletPass(built)
  if (!result.ok) {
    if (result.reason === 'apple_not_configured') {
      return NextResponse.json(
        {
          error: 'Apple Wallet pass signing is not configured.',
          missing: result.missing,
          help: 'See docs/apple-wallet-setup.md',
        },
        { status: 503 }
      )
    }
    if (result.reason === 'icon_missing') {
      return NextResponse.json(
        {
          error: 'Pass icon images are missing.',
          missing: result.missing,
          help: 'Add icon.png (29x29) to public/assets/wallet/. See docs/apple-wallet-setup.md.',
        },
        { status: 503 }
      )
    }
    return NextResponse.json(
      { error: 'Failed to sign pass.', detail: result.detail },
      { status: 500 }
    )
  }

  // Return the binary. Content-Type and Content-Disposition trigger the
  // Wallet handoff on iOS Safari / Chrome download on other platforms.
  // Buffer → Uint8Array → BodyInit (NextResponse doesn't accept Node Buffer
  // directly under web-streams typings).
  const passBytes = new Uint8Array(result.buffer)
  return new NextResponse(passBytes, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.apple.pkpass',
      'Content-Disposition': `attachment; filename="okcorral-${result.serialNumber}.pkpass"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
