import { serviceClient } from './repo'
import { normalizeTicketCode } from './codes'

/**
 * Recording a scan.
 *
 * IDEMPOTENT BY DESIGN. The scanner queues scans while offline and
 * flushes them on reconnect, so the same code can arrive twice, and a
 * code can arrive that this device already burned locally. None of
 * that is an error: scanning an already-used ticket returns the
 * ORIGINAL used_at rather than failing, so a queue flush never gets
 * stuck on a row it cannot write.
 */

/** Anything older than this is a clock that cannot be trusted. */
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000

export type ScanOutcome =
  | { code: string; result: 'valid'; used_at: string; purchaser_name: string | null; seq: number; order_size: number }
  | { code: string; result: 'already_used'; used_at: string; used_by: string | null; purchaser_name: string | null; seq: number; order_size: number }
  | { code: string; result: 'void'; purchaser_name: string | null }
  | { code: string; result: 'not_found' }

export type ScanRequest = {
  code: string
  /** Client clock at the moment of the scan. Used for queued offline scans. */
  scanned_at?: string | null
}

/**
 * Chooses the timestamp to record.
 *
 * An online scan uses the server clock. A queued offline scan has only
 * the device's clock, which is the sole record of when it happened --
 * but a device clock can also be wrong, so anything in the future or
 * more than a day old is discarded in favour of now.
 */
function resolveScanTime(supplied: string | null | undefined, now: number): string {
  if (!supplied) return new Date(now).toISOString()
  const t = Date.parse(supplied)
  if (!Number.isFinite(t)) return new Date(now).toISOString()
  if (t > now + 60_000) return new Date(now).toISOString()
  if (t < now - MAX_CLOCK_SKEW_MS) return new Date(now).toISOString()
  return new Date(t).toISOString()
}

/**
 * Marks one ticket used, or reports why it could not be.
 *
 * The claim is a conditional UPDATE on status='valid', so two devices
 * (or a scan racing its own queued copy) cannot both come away thinking
 * they were first -- Postgres decides.
 */
export async function recordScan(
  eventId: string,
  req: ScanRequest,
  deviceId: string
): Promise<ScanOutcome> {
  const sb = serviceClient()
  const code = normalizeTicketCode(req.code)
  const scannedAt = resolveScanTime(req.scanned_at, Date.now())

  const select =
    'code, status, used_at, used_by, seq, order_id, ticket_orders(purchaser_name, quantity)'

  const { data: existing, error: findErr } = await sb
    .from('tickets')
    .select(select)
    .eq('event_id', eventId)
    .eq('code', code)
    .maybeSingle()

  if (findErr) throw new Error(`ticket lookup failed: ${findErr.message}`)
  if (!existing) return { code, result: 'not_found' }

  const who = (row: any) => {
    const o = Array.isArray(row.ticket_orders) ? row.ticket_orders[0] : row.ticket_orders
    return { purchaser_name: o?.purchaser_name ?? null, order_size: Number(o?.quantity ?? 1) }
  }

  if (existing.status === 'void') {
    return { code, result: 'void', purchaser_name: who(existing).purchaser_name }
  }

  // Claim it. Only a row still 'valid' can be taken, so a duplicate
  // delivery of the same queued scan finds nothing to update.
  const { data: claimed, error: claimErr } = await sb
    .from('tickets')
    .update({ status: 'used', used_at: scannedAt, used_by: deviceId })
    .eq('event_id', eventId)
    .eq('code', code)
    .eq('status', 'valid')
    .select(select)

  if (claimErr) throw new Error(`scan update failed: ${claimErr.message}`)

  if (claimed && claimed.length > 0) {
    const row = claimed[0] as any
    const w = who(row)
    return {
      code,
      result: 'valid',
      used_at: scannedAt,
      purchaser_name: w.purchaser_name,
      seq: Number(row.seq),
      order_size: w.order_size,
    }
  }

  // Already used. Re-read rather than trusting the row we read before
  // the claim -- something may have written in between.
  const { data: current, error: reErr } = await sb
    .from('tickets')
    .select(select)
    .eq('event_id', eventId)
    .eq('code', code)
    .maybeSingle()

  if (reErr) throw new Error(`ticket re-read failed: ${reErr.message}`)
  if (!current) return { code, result: 'not_found' }

  let usedAt = current.used_at as string | null

  // Keep the EARLIEST scan. A queued offline scan can land after an
  // online one for the same ticket; the moment the person actually
  // walked in is the honest answer, not the moment the queue drained.
  if (usedAt && Date.parse(scannedAt) < Date.parse(usedAt)) {
    const { error: backdateErr } = await sb
      .from('tickets')
      .update({ used_at: scannedAt })
      .eq('event_id', eventId)
      .eq('code', code)
      .gt('used_at', scannedAt)
    if (backdateErr) {
      console.warn(`[door] could not backdate ${code}`, backdateErr)
    } else {
      usedAt = scannedAt
    }
  }

  const w = who(current)
  return {
    code,
    result: 'already_used',
    used_at: usedAt ?? scannedAt,
    used_by: (current.used_by as string | null) ?? null,
    purchaser_name: w.purchaser_name,
    seq: Number((current as any).seq),
    order_size: w.order_size,
  }
}
