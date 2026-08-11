import { NextRequest, NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { getSupabase } from '@/lib/supabase'
import {
  shippingCentsForSubtotal,
  shipLabelForSubtotal,
  PICKUP_LABEL,
} from '@/lib/fulfillment'

export const runtime = 'nodejs'

// ── Request shape ─────────────────────────────────────────────────
type GiftCardBody = {
  kind: 'gift_card'
  amount: number          // dollars, integer
  to_name: string
  to_email: string
  from_name?: string
  note?: string
}

type MerchItem = {
  name: string
  price: number          // dollars, can be float
  qty: number
  size?: string
  color?: string
}

type MerchBody = {
  kind: 'merch'
  items: MerchItem[]
}

type Body = GiftCardBody | MerchBody

// ── Helpers ───────────────────────────────────────────────────────
const dollarsToCents = (n: number) => Math.round(n * 100)

function getOrigin(req: NextRequest): string {
  // Prefer the request's own origin so dev (localhost) and prod (vercel.app /
  // okcorralsaloon.com) both work without an env var.
  const origin = req.nextUrl.origin
  if (origin && origin !== 'null') return origin
  return process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
}

// ── Handler ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' },
      { status: 500 }
    )
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const origin = getOrigin(req)
  const successBase = `${origin}/?stripe=success&kind=${body.kind}&session_id={CHECKOUT_SESSION_ID}`
  const cancelUrl   = `${origin}/?stripe=cancel&kind=${body.kind}`

  try {
    if (body.kind === 'gift_card') {
      return await handleGiftCard(body, stripe, successBase, cancelUrl)
    }
    if (body.kind === 'merch') {
      return await handleMerch(body, stripe, successBase, cancelUrl)
    }
    return NextResponse.json({ error: 'Unknown kind.' }, { status: 400 })
  } catch (err: any) {
    console.error('[/api/checkout] error', err)
    return NextResponse.json(
      { error: err?.message || 'Checkout failed.' },
      { status: 500 }
    )
  }
}

// ── Gift card flow ────────────────────────────────────────────────
async function handleGiftCard(
  body: GiftCardBody,
  stripe: ReturnType<typeof getStripe>,
  successBase: string,
  cancelUrl: string
) {
  if (!stripe) throw new Error('Stripe not configured.')

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount < 5 || amount > 500) {
    return NextResponse.json(
      { error: 'Amount must be between $5 and $500.' },
      { status: 400 }
    )
  }
  if (!body.to_name?.trim() || !body.to_email?.trim()) {
    return NextResponse.json(
      { error: 'Recipient name and email are required.' },
      { status: 400 }
    )
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: body.to_email,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: dollarsToCents(amount),
          product_data: {
            name: `OK Corral Gift Card — $${amount}`,
            description: body.from_name
              ? `From ${body.from_name} to ${body.to_name}`
              : `For ${body.to_name}`,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      kind: 'gift_card',
      to_name: body.to_name,
      to_email: body.to_email,
      from_name: body.from_name ?? '',
      note: (body.note ?? '').slice(0, 400),
      amount_dollars: String(amount),
    },
    success_url: successBase,
    cancel_url: cancelUrl,
  })

  // Best-effort row insert. Don't block checkout on Supabase failures.
  const sb = getSupabase()
  if (sb && session.id) {
    const { error } = await sb.from('gift_card_orders').insert({
      stripe_session_id: session.id,
      amount,
      to_name: body.to_name,
      to_email: body.to_email,
      from_name: body.from_name || null,
      note: body.note || null,
      status: 'pending',
    })
    if (error) console.warn('[gift_card_orders insert]', error)
  }

  return NextResponse.json({ url: session.url, session_id: session.id })
}

// ── Merch cart flow ───────────────────────────────────────────────
async function handleMerch(
  body: MerchBody,
  stripe: ReturnType<typeof getStripe>,
  successBase: string,
  cancelUrl: string
) {
  if (!stripe) throw new Error('Stripe not configured.')

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ error: 'Cart is empty.' }, { status: 400 })
  }

  // Validate items
  for (const it of body.items) {
    if (!it.name || !Number.isFinite(it.price) || it.price <= 0) {
      return NextResponse.json({ error: 'Invalid cart item.' }, { status: 400 })
    }
    if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 50) {
      return NextResponse.json({ error: 'Invalid quantity.' }, { status: 400 })
    }
  }

  const subtotal = body.items.reduce((s, it) => s + it.price * it.qty, 0)

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: body.items.map(it => ({
      price_data: {
        currency: 'usd',
        unit_amount: dollarsToCents(it.price),
        product_data: {
          name: it.name,
          description: [it.color, it.size].filter(Boolean).join(' · ') || undefined,
        },
      },
      quantity: it.qty,
    })),
    // Address is collected for BOTH fulfillment paths. Stripe can't make it
    // conditional on the selected shipping option, and a stray address on a
    // pickup order is harmless — whereas missing one on a shipment is not.
    shipping_address_collection: {
      allowed_countries: ['US'],
    },
    // The customer's ship-or-pickup choice. The webhook reads the selected
    // rate back off the session to set fulfillment_type on the order row.
    //
    // The ship rate is tiered on subtotal via the same helper the cart
    // renders from, so Stripe quotes exactly what the cart quoted.
    shipping_options: [
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: shippingCentsForSubtotal(subtotal), currency: 'usd' },
          display_name: shipLabelForSubtotal(subtotal),
          delivery_estimate: {
            minimum: { unit: 'business_day', value: 3 },
            maximum: { unit: 'business_day', value: 7 },
          },
        },
      },
      {
        shipping_rate_data: {
          type: 'fixed_amount',
          fixed_amount: { amount: 0, currency: 'usd' },
          display_name: PICKUP_LABEL,
        },
      },
    ],
    automatic_tax: { enabled: false },
    metadata: {
      kind: 'merch',
      item_count: String(body.items.reduce((n, it) => n + it.qty, 0)),
    },
    success_url: successBase,
    cancel_url: cancelUrl,
  })

  // Best-effort row insert.
  const sb = getSupabase()
  if (sb && session.id) {
    const { error } = await sb.from('merch_orders').insert({
      stripe_session_id: session.id,
      items: body.items,
      subtotal,
      total: subtotal, // shipping/tax computed by Stripe at checkout; refine via webhook later
      customer_email: null,
      status: 'pending',
    })
    if (error) console.warn('[merch_orders insert]', error)
  }

  return NextResponse.json({ url: session.url, session_id: session.id })
}
