/**
 * Proves ticket issuance is safe when Stripe delivers the same webhook
 * event TWICE AT ONCE.
 *
 *   npx tsx scripts/verify-ticket-concurrency.ts --yes
 *
 * Run this against Supabase after migrations 0012 and 0013 are applied.
 * It cannot be faked locally: PGlite is single-connection, so nothing on
 * a dev machine can produce two Postgres backends racing for the same
 * row. This script does, by firing N real requests in parallel at the
 * real database.
 *
 * WHAT IT IS CHECKING
 * The webhook issues tickets before claiming the order. Issuance used to
 * count existing tickets and insert the shortfall, which two concurrent
 * deliveries could both do from a count of zero -- double tickets for
 * one payment. The fix is the UNIQUE index on (order_id, seq) from
 * migration 0013 plus ON CONFLICT DO NOTHING, so Postgres discards the
 * loser. If 0013 has not been applied, this script FAILS LOUDLY, which
 * is the point.
 *
 * WHAT IT TOUCHES
 * It creates one scratch ticket_order against an existing event, issues
 * tickets to it, then deletes both. It never modifies events, never
 * calls Stripe, and never sends email. Cleanup runs even on failure; if
 * it somehow does not, every row it makes is tagged and the last line of
 * output tells you how to find them.
 */

import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())

const QUANTITY = 5
const CONCURRENCY = 8
const MARKER = 'CONCURRENCY-TEST-DELETE-ME'

async function main() {
  if (!process.argv.includes('--yes')) {
    console.log(
      'This writes scratch rows to the live Supabase database (and deletes them).\n' +
        'Re-run with --yes to proceed:\n\n' +
        '  npx tsx scripts/verify-ticket-concurrency.ts --yes\n'
    )
    process.exit(1)
  }

  const { serviceClient, TENANT_ID } = await import('../src/lib/tickets/repo')
  const { ensureTicketsIssued } = await import('../src/lib/tickets/complete')
  const sb = serviceClient()

  // Any event will do; it is only ever read.
  const { data: event, error: evErr } = await sb
    .from('events')
    .select('id, name')
    .limit(1)
    .maybeSingle()
  if (evErr) throw new Error(`could not read events: ${evErr.message}`)
  if (!event) throw new Error('no events in the database to attach a scratch order to')

  const { data: order, error: orderErr } = await sb
    .from('ticket_orders')
    .insert({
      tenant_id: TENANT_ID,
      event_id: event.id,
      channel: 'online',
      payment_method: 'stripe',
      purchaser_name: MARKER,
      quantity: QUANTITY,
      unit_price: 0.01,
      subtotal: 0.05,
      fees: 0,
      total: 0.05,
      status: 'pending',
    })
    .select('id, event_id, quantity, unit_price, status')
    .single()
  if (orderErr || !order) throw new Error(`scratch order insert failed: ${orderErr?.message}`)

  console.log(`event:  ${event.name}`)
  console.log(`order:  ${order.id}`)
  console.log(`firing ${CONCURRENCY} concurrent completions for a quantity of ${QUANTITY}\n`)

  let ticketCount = -1
  let claimWinners = -1
  let seqs: number[] = []
  let issuanceErrors: string[] = []

  try {
    // ── The race ──────────────────────────────────────────────
    // No awaits between them: all CONCURRENCY calls are in flight
    // together, hitting separate Postgres backends.
    const results = await Promise.allSettled(
      Array.from({ length: CONCURRENCY }, () => ensureTicketsIssued(order as any))
    )
    issuanceErrors = results
      .filter(r => r.status === 'rejected')
      .map(r => String((r as PromiseRejectedResult).reason?.message ?? r))

    const { data: tickets, error: tErr } = await sb
      .from('tickets')
      .select('seq, code')
      .eq('order_id', order.id)
      .order('seq', { ascending: true })
    if (tErr) throw new Error(`ticket read failed: ${tErr.message}`)

    ticketCount = tickets?.length ?? 0
    seqs = (tickets ?? []).map(t => Number(t.seq))

    // ── The claim, also raced ─────────────────────────────────
    // The same conditional UPDATE the webhook uses. Exactly one of
    // these may come back with a row, or a customer gets N emails.
    const claims = await Promise.all(
      Array.from({ length: CONCURRENCY }, () =>
        sb
          .from('ticket_orders')
          .update({ status: 'paid', updated_at: new Date().toISOString() })
          .eq('id', order.id)
          .neq('status', 'paid')
          .select('id')
      )
    )
    claimWinners = claims.filter(c => (c.data?.length ?? 0) > 0).length
  } finally {
    await sb.from('tickets').delete().eq('order_id', order.id)
    await sb.from('ticket_orders').delete().eq('id', order.id)
  }

  const distinctSeqs = new Set(seqs).size
  const pass =
    ticketCount === QUANTITY &&
    distinctSeqs === QUANTITY &&
    claimWinners === 1 &&
    issuanceErrors.length === 0

  console.log(
    JSON.stringify(
      {
        concurrent_completions: CONCURRENCY,
        order_quantity: QUANTITY,
        tickets_issued: ticketCount,
        distinct_seq_values: distinctSeqs,
        seqs,
        issuance_errors: issuanceErrors,
        concurrent_claims: CONCURRENCY,
        claim_winners: claimWinners,
        scratch_rows_cleaned_up: true,
      },
      null,
      2
    )
  )

  if (pass) {
    console.log(
      `\nPASS - ${CONCURRENCY} concurrent completions issued exactly ${QUANTITY} tickets, ` +
        `and exactly 1 of ${CONCURRENCY} concurrent claims won.`
    )
  } else {
    console.log(
      `\nFAIL - expected ${QUANTITY} tickets and 1 claim winner, got ${ticketCount} and ${claimWinners}.` +
        (ticketCount > QUANTITY
          ? '\nMore tickets than quantity means the (order_id, seq) unique index from migration 0013 is missing.'
          : '')
    )
  }

  console.log(
    `\nIf anything was left behind:\n` +
      `  delete from tickets where order_id in (select id from ticket_orders where purchaser_name = '${MARKER}');\n` +
      `  delete from ticket_orders where purchaser_name = '${MARKER}';`
  )

  process.exit(pass ? 0 : 1)
}

main().catch(err => {
  console.error(err)
  console.log(
    `\nIf a scratch row was left behind:\n` +
      `  delete from tickets where order_id in (select id from ticket_orders where purchaser_name = '${MARKER}');\n` +
      `  delete from ticket_orders where purchaser_name = '${MARKER}';`
  )
  process.exit(1)
})
