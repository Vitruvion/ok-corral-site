'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DoorEvent, DoorManifest, ManifestTicket } from '@/lib/tickets/door'
import { formatTicketCode, normalizeTicketCode } from '@/lib/tickets/code-format'
import {
  deviceId,
  enqueueScan,
  listQueue,
  loadManifest,
  localUsedByEvent,
  markUsedLocally,
  queuedByEvent,
  removeQueued,
  saveManifest,
} from '@/lib/door/db'
import { startScanner, type ScannerHandle } from '@/lib/door/scanner'
import { decideScan } from '@/lib/door/decide'
import styles from './door.module.css'

/**
 * The door scanner.
 *
 * One phone, one person, a line waiting, a dark room. Every decision
 * here follows from that: the result fills the screen so it reads at
 * arm's length without focusing, the camera never closes between
 * scans, and anything ambiguous stops and asks rather than guessing.
 *
 * Because it is ONE device, duplicate detection is exact even with no
 * network -- this phone knows every scan it has made, so a ticket
 * presented twice is caught offline just as reliably as online.
 */

/** How long a VALID result holds the screen before returning to camera. */
const VALID_DWELL_MS = 2000

/** Manifest refresh cadence while online and scanning. */
const REFRESH_MS = 60_000

/** Older than this and the manifest is called out as stale. */
const STALE_MS = 30 * 60_000

/** Retry cadence for the offline queue. */
const FLUSH_MS = 20_000

/**
 * How often the event picker refreshes its scanned counts.
 *
 * That count is how whoever is on the door knows how many people are
 * still outside, so a stale one is worse than useless. 30s is often
 * enough to be current and cheap enough to be invisible -- and it only
 * runs while the picker is actually on screen.
 */
const PICKER_POLL_MS = 30_000

/**
 * Ignore repeat decodes of the same code inside this window.
 *
 * The camera decodes ~10x a second and a ticket sits in frame for well
 * over a second, so without this a single presentation would fire a
 * dozen times. Deliberately shorter than VALID_DWELL_MS so that
 * genuinely presenting the same ticket again still registers.
 */
const DEDUPE_MS = 1500

type Result =
  | { kind: 'valid'; name: string | null; seq: number; size: number; code: string }
  | { kind: 'used'; name: string | null; code: string; usedAt: string | null }
  | { kind: 'notfound'; code: string; reason: 'absent' | 'offline' }
  | { kind: 'bad'; code: string | null }
  | { kind: 'void'; name: string | null; code: string }

type Mode = 'scan' | 'search'

const ago = (iso: string | null): string => {
  if (!iso) return 'a moment ago'
  const ms = Date.now() - Date.parse(iso)
  if (!Number.isFinite(ms) || ms < 0) return 'just now'
  const min = Math.floor(ms / 60000)
  if (min < 1) return `${Math.max(1, Math.floor(ms / 1000))} sec ago`
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  return `${h} hr ${min % 60} min ago`
}

/**
 * Short tone as scan feedback.
 *
 * navigator.vibrate is called too, but iOS Safari does not implement it
 * -- and an iPhone is the device this runs on. Without sound there
 * would be no non-visual confirmation at all on the target platform,
 * which matters when you are looking at a person rather than a screen.
 */
function beep(ok: boolean) {
  try {
    const Ctx = (window as any).AudioContext ?? (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = ok ? 880 : 240
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.12 : 0.3))
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (ok ? 0.14 : 0.32))
    osc.onended = () => ctx.close().catch(() => {})
  } catch {
    // No audio is survivable; the screen still says everything.
  }
}

function buzz(ok: boolean) {
  try {
    navigator.vibrate?.(ok ? 60 : [80, 60, 80])
  } catch {
    /* not on iOS, and not required */
  }
}

export default function DoorClient({ events }: { events: DoorEvent[] }) {
  const [event, setEvent] = useState<DoorEvent | null>(null)
  /** Server counts. Seeded from the server render, refreshed thereafter. */
  const [serverEvents, setServerEvents] = useState<DoorEvent[]>(events)
  /** What THIS device knows, including scans the server has not seen. */
  const [localUsed, setLocalUsed] = useState<Record<string, number>>({})
  const [pendingByEvent, setPendingByEvent] = useState<Record<string, number>>({})
  const [manifest, setManifest] = useState<DoorManifest | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode>('scan')
  const [result, setResult] = useState<Result | null>(null)
  const [online, setOnline] = useState(true)
  const [queued, setQueued] = useState(0)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [decoder, setDecoder] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [conflicts, setConflicts] = useState<string[]>([])
  const [, forceTick] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scannerRef = useRef<ScannerHandle | null>(null)
  const lastDecode = useRef<{ code: string; at: number } | null>(null)
  // Read inside the decode callback, which is created once.
  const manifestRef = useRef<DoorManifest | null>(null)
  const eventRef = useRef<DoorEvent | null>(null)
  const busyRef = useRef(false)
  const device = useRef<string>('door-unknown')

  useEffect(() => { manifestRef.current = manifest }, [manifest])
  useEffect(() => { eventRef.current = event }, [event])
  useEffect(() => { device.current = deviceId() }, [])

  // Re-render once a minute so "Loaded 4 min ago" stays honest.
  useEffect(() => {
    const t = setInterval(() => forceTick(n => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const set = () => setOnline(navigator.onLine)
    set()
    window.addEventListener('online', set)
    window.addEventListener('offline', set)
    return () => {
      window.removeEventListener('online', set)
      window.removeEventListener('offline', set)
    }
  }, [])

  const refreshQueueCount = useCallback(async () => {
    setQueued((await listQueue()).length)
  }, [])

  // ── Manifest ──────────────────────────────────────────────────
  const fetchManifest = useCallback(async (ev: DoorEvent, quiet = false) => {
    if (!quiet) setRefreshing(true)
    try {
      const res = await fetch(`/api/admin/door/manifest?event_id=${encodeURIComponent(ev.id)}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`manifest ${res.status}`)
      const data: DoorManifest = await res.json()
      await saveManifest(data)
      setManifest(data)
      setFetchedAt(Date.now())
    } catch {
      // Fall back to whatever this device already has. A stale list is
      // the entire reason it is stored; the age indicator says so.
      const stored = await loadManifest(ev.id)
      if (stored) {
        setManifest(stored)
        setFetchedAt(stored.fetched_at)
      }
    } finally {
      if (!quiet) setRefreshing(false)
    }
  }, [])

  const chooseEvent = useCallback(
    async (ev: DoorEvent) => {
      setEvent(ev)
      setMode('scan')
      const stored = await loadManifest(ev.id)
      if (stored) {
        setManifest(stored)
        setFetchedAt(stored.fetched_at)
      }
      await fetchManifest(ev, Boolean(stored))
      await refreshQueueCount()
    },
    [fetchManifest, refreshQueueCount]
  )

  useEffect(() => {
    if (!event || mode !== 'scan') return
    const t = setInterval(() => {
      if (navigator.onLine) fetchManifest(event, true)
    }, REFRESH_MS)
    return () => clearInterval(t)
  }, [event, mode, fetchManifest])

  // ── Offline queue ─────────────────────────────────────────────
  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) return
    const ev = eventRef.current
    if (!ev) return

    const pending = (await listQueue()).filter(q => q.event_id === ev.id)
    if (pending.length === 0) return

    try {
      const res = await fetch('/api/admin/door/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: ev.id,
          device_id: device.current,
          scans: pending.map(p => ({ code: p.code, scanned_at: p.scanned_at })),
        }),
      })
      const data = await res.json()
      const results: Array<{ code: string; result: string; used_at?: string }> = data.results ?? []

      // Everything the server answered for is settled, whatever the
      // answer was. An already-used ticket is a RESULT, not a failure --
      // it must not sit in the queue forever being retried.
      const answered = new Set(results.map(r => r.code))
      const done = pending.filter(p => answered.has(p.code)).map(p => p.id!).filter(Boolean)
      await removeQueued(done)

      const clashes = results
        .filter(r => r.result === 'already_used' || r.result === 'not_found')
        .map(r =>
          r.result === 'not_found'
            ? `${formatTicketCode(r.code)} — not on the server's list`
            : `${formatTicketCode(r.code)} — was already scanned`
        )
      if (clashes.length) setConflicts(prev => [...clashes, ...prev].slice(0, 20))
    } catch {
      // Still offline, or the request died. Leave the queue alone.
    }
    await refreshQueueCount()
  }, [refreshQueueCount])

  useEffect(() => {
    if (!event) return
    flushQueue()
    const t = setInterval(flushQueue, FLUSH_MS)
    const onOnline = () => flushQueue()
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(t)
      window.removeEventListener('online', onOnline)
    }
  }, [event, flushQueue])

  // ── Picker counts ─────────────────────────────────────────────
  /**
   * Reads what this device knows: used marks in the stored manifests,
   * plus anything still sitting in the offline queue.
   *
   * Always runs, even when the server fetch fails. That is the point --
   * going offline must not make the number go backwards.
   */
  const refreshLocalCounts = useCallback(async (ids: string[]) => {
    const [used, queued] = await Promise.all([localUsedByEvent(ids), queuedByEvent()])
    setLocalUsed(used)
    setPendingByEvent(
      Object.fromEntries(Object.entries(queued).map(([id, codes]) => [id, codes.length]))
    )
  }, [])

  const refreshCounts = useCallback(async () => {
    let ids = serverEvents.map(e => e.id)
    try {
      const res = await fetch('/api/admin/door/manifest', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.events)) {
          setServerEvents(data.events)
          ids = data.events.map((e: DoorEvent) => e.id)
        }
      }
    } catch {
      // Keep the counts we have. Replacing them with nothing would make
      // the door look emptier than it is, which is the worst direction
      // for this particular number to be wrong in.
    }
    await refreshLocalCounts(ids)
  }, [serverEvents, refreshLocalCounts])

  /**
   * Keeps the picker current WHILE IT IS VISIBLE, and only then.
   *
   * Three triggers, because a phone at a door hits all three: coming
   * back from scan mode (this effect re-runs when `event` becomes
   * null), the app being reopened after iOS backgrounded it, and the
   * plain passage of time.
   *
   * Everything is torn down on the way out, so entering scan mode
   * leaves no interval and no listeners behind -- the camera loop
   * should not be competing with a poll for a screen nobody is looking
   * at.
   */
  useEffect(() => {
    if (event) return

    let cancelled = false
    const run = () => {
      if (!cancelled) void refreshCounts()
    }

    run()
    const timer = window.setInterval(run, PICKER_POLL_MS)

    // visibilitychange covers backgrounding; pageshow additionally
    // covers iOS restoring a page from its back/forward cache, which
    // does not always fire visibilitychange.
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', run)
    window.addEventListener('pageshow', run)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', run)
      window.removeEventListener('pageshow', run)
    }
    // Deliberately keyed on `event` only. Including refreshCounts would
    // tear down and rebuild the interval every time the counts change,
    // which is every poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event])

  // ── Admitting a ticket ────────────────────────────────────────
  const admit = useCallback(
    async (ticket: ManifestTicket) => {
      const ev = eventRef.current!
      const at = new Date().toISOString()

      // Local state first, always. This is what makes the same ticket
      // scanned twice on this phone an ALREADY USED the second time,
      // network or no network.
      await markUsedLocally(ev.id, ticket.code, at, device.current)
      const stored = await loadManifest(ev.id)
      if (stored) setManifest(stored)

      setResult({
        kind: 'valid',
        name: ticket.purchaser_name,
        seq: ticket.seq,
        size: ticket.order_size,
        code: ticket.code,
      })
      beep(true)
      buzz(true)

      if (navigator.onLine) {
        try {
          const res = await fetch('/api/admin/door/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event_id: ev.id,
              device_id: device.current,
              code: ticket.code,
              scanned_at: at,
            }),
          })
          if (!res.ok) throw new Error(String(res.status))
          return
        } catch {
          // Fall through to the queue.
        }
      }
      await enqueueScan({ event_id: ev.id, code: ticket.code, scanned_at: at })
      await refreshQueueCount()
    },
    [refreshQueueCount]
  )

  /** Asks the server about one code the local manifest does not have. */
  const requery = useCallback(async (code: string): Promise<Result> => {
    const ev = eventRef.current!
    if (!navigator.onLine) return { kind: 'notfound', code, reason: 'offline' }
    try {
      await fetchManifest(ev, true)
      const stored = await loadManifest(ev.id)
      const found = stored?.tickets.find(t => t.code === code)
      if (!found) return { kind: 'notfound', code, reason: 'absent' }
      if (stored) setManifest(stored)
      if (found.status === 'void') {
        return { kind: 'void', name: found.purchaser_name, code }
      }
      if (found.status === 'used') {
        return { kind: 'used', name: found.purchaser_name, code, usedAt: found.used_at }
      }
      // It exists after all -- bought after the last refresh. Admit it,
      // but only after the signature check, which the caller has already
      // done against a manifest that did not contain it. Re-check here.
      return { kind: 'notfound', code, reason: 'absent' }
    } catch {
      return { kind: 'notfound', code, reason: 'offline' }
    }
  }, [fetchManifest])

  const handlePayload = useCallback(
    async (payload: string) => {
      if (busyRef.current) return
      const ev = eventRef.current
      if (!ev) return

      const tickets = manifestRef.current?.tickets ?? []
      const decision = decideScan(payload, tickets)

      // Dedupe by whatever code we could extract. The camera decodes ten
      // times a second and a ticket sits in frame far longer than that,
      // so without this one presentation fires a dozen times.
      const codeKey = decision.kind === 'unknown' || decision.kind === 'bad'
        ? decision.code
        : decision.ticket.code
      if (codeKey) {
        const now = Date.now()
        if (lastDecode.current?.code === codeKey && now - lastDecode.current.at < DEDUPE_MS) {
          return
        }
        lastDecode.current = { code: codeKey, at: now }
      }

      busyRef.current = true

      switch (decision.kind) {
        case 'valid':
          await admit(decision.ticket)
          return

        case 'used':
          setResult({
            kind: 'used',
            name: decision.ticket.purchaser_name,
            code: decision.ticket.code,
            usedAt: decision.ticket.used_at,
          })
          break

        case 'void':
          setResult({
            kind: 'void',
            name: decision.ticket.purchaser_name,
            code: decision.ticket.code,
          })
          break

        case 'bad':
          setResult({ kind: 'bad', code: decision.code })
          break

        case 'unknown': {
          // Undecidable from what this device holds. Ask the server; if
          // the ticket was bought after the last refresh it will appear
          // and can be admitted, signature and all.
          const r = await requery(decision.code)
          if (r.kind === 'notfound') {
            const after = manifestRef.current?.tickets ?? []
            const second = decideScan(payload, after)
            if (second.kind === 'valid') {
              await admit(second.ticket)
              return
            }
            if (second.kind === 'bad') {
              setResult({ kind: 'bad', code: second.code })
              break
            }
          }
          setResult(r)
          break
        }
      }

      beep(false)
      buzz(false)
    },
    [admit, requery]
  )

  // VALID clears itself; everything else waits for a tap.
  useEffect(() => {
    if (result?.kind !== 'valid') return
    const t = setTimeout(() => {
      setResult(null)
      busyRef.current = false
    }, VALID_DWELL_MS)
    return () => clearTimeout(t)
  }, [result])

  const dismiss = () => {
    setResult(null)
    busyRef.current = false
  }

  // ── Camera lifecycle ──────────────────────────────────────────
  useEffect(() => {
    if (!event || mode !== 'scan') return
    let handle: ScannerHandle | null = null
    let cancelled = false

    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    setCameraError(null)
    startScanner({
      video,
      canvas,
      onDecode: p => void handlePayload(p),
      onError: setCameraError,
    }).then(h => {
      if (cancelled) {
        h.stop()
        return
      }
      handle = h
      scannerRef.current = h
      setDecoder(h.decoder)
    })

    return () => {
      cancelled = true
      handle?.stop()
      scannerRef.current = null
    }
    // handlePayload is stable via useCallback; the camera must NOT be
    // torn down and rebuilt on every render or every scan costs a second
    // of black screen.
  }, [event, mode, handlePayload])

  // ── Screens ───────────────────────────────────────────────────
  if (!event) {
    return (
      <div className={styles.events}>
        {serverEvents.length === 0 && (
          <p className={styles.empty}>
            No events have ticket sales switched on. Set <code>tickets_on_sale</code> on
            an event first.
          </p>
        )}
        {serverEvents.map(ev => {
          // The higher of the two, never the server's alone. A scan
          // waiting in the queue has happened as far as the door is
          // concerned, and the count going backwards when the wifi drops
          // would be actively misleading about how many people are
          // still outside.
          const used = Math.max(ev.used, localUsed[ev.id] ?? 0)
          const pending = pendingByEvent[ev.id] ?? 0
          return (
            <button key={ev.id} className={styles.eventCard} onClick={() => chooseEvent(ev)}>
              <span className={styles.eventName}>{ev.name}</span>
              <span className={styles.eventDate}>{ev.dateLabel}</span>
              <span className={styles.eventCount}>
                {used} of {ev.issued} scanned
                {pending > 0 && (
                  <span className={styles.pending} title={`${pending} not yet sent to the server`}>
                    +{pending} unsent
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  const age = fetchedAt ? Date.now() - fetchedAt : null
  const stale = age !== null && age > STALE_MS

  return (
    <div className={styles.scanner}>
      <header className={styles.bar}>
        <button className={styles.back} onClick={() => setEvent(null)} aria-label="Change event">
          ‹
        </button>
        <div className={styles.barMain}>
          <div className={styles.barName}>{event.name}</div>
          <button
            className={stale ? styles.ageStale : styles.age}
            onClick={() => fetchManifest(event)}
            disabled={refreshing}
          >
            {refreshing
              ? 'Refreshing…'
              : fetchedAt
                ? `Loaded ${ago(new Date(fetchedAt).toISOString())} · tap to refresh`
                : 'Not loaded · tap to refresh'}
          </button>
        </div>
        <button
          className={styles.modeBtn}
          onClick={() => setMode(m => (m === 'scan' ? 'search' : 'scan'))}
        >
          {mode === 'scan' ? 'Look up' : 'Scan'}
        </button>
      </header>

      {stale && (
        <div className={styles.staleWarn}>
          This list is over 30 minutes old. Tickets bought since then are not on it.
        </div>
      )}

      {!online && (
        <div className={styles.offline}>
          OFFLINE{queued > 0 ? ` · ${queued} scan${queued === 1 ? '' : 's'} waiting` : ''}
        </div>
      )}
      {online && queued > 0 && (
        <div className={styles.queued}>
          Sending {queued} queued scan{queued === 1 ? '' : 's'}…
        </div>
      )}

      {mode === 'scan' ? (
        <div className={styles.camera}>
          <video ref={videoRef} className={styles.video} playsInline muted autoPlay />
          <canvas ref={canvasRef} className={styles.canvas} />
          <div className={styles.reticle} aria-hidden="true" />
          {cameraError && <div className={styles.cameraError}>{cameraError}</div>}
          {decoder && <div className={styles.decoder}>{decoder}</div>}
        </div>
      ) : (
        <Lookup
          manifest={manifest}
          onAdmit={async t => {
            await admit(t)
          }}
        />
      )}

      {conflicts.length > 0 && (
        <div className={styles.conflicts}>
          <div className={styles.conflictsHead}>
            Queued scans the server saw differently
            <button onClick={() => setConflicts([])}>Clear</button>
          </div>
          <ul>
            {conflicts.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {result && <ResultScreen result={result} onDismiss={dismiss} />}
    </div>
  )
}

// ── Result overlay ────────────────────────────────────────────────
function ResultScreen({ result, onDismiss }: { result: Result; onDismiss: () => void }) {
  const cls =
    result.kind === 'valid'
      ? styles.resValid
      : result.kind === 'used'
        ? styles.resUsed
        : styles.resBad

  return (
    <div
      className={`${styles.result} ${cls}`}
      onClick={result.kind === 'valid' ? undefined : onDismiss}
      role="alert"
    >
      {result.kind === 'valid' && (
        <>
          <div className={styles.resHead}>IN</div>
          <div className={styles.resName}>{result.name || 'Ticket holder'}</div>
          {result.size > 1 && (
            <div className={styles.resSub}>
              {result.seq} of {result.size}
            </div>
          )}
        </>
      )}

      {result.kind === 'used' && (
        <>
          <div className={styles.resHead}>ALREADY USED</div>
          <div className={styles.resName}>{result.name || 'Ticket holder'}</div>
          <div className={styles.resSub}>Scanned {ago(result.usedAt)}</div>
          <div className={styles.resTap}>Tap to dismiss</div>
        </>
      )}

      {result.kind === 'void' && (
        <>
          <div className={styles.resHead}>REFUNDED</div>
          <div className={styles.resName}>{result.name || 'Ticket holder'}</div>
          <div className={styles.resSub}>This ticket was cancelled.</div>
          <div className={styles.resTap}>Tap to dismiss</div>
        </>
      )}

      {result.kind === 'bad' && (
        <>
          <div className={styles.resHead}>INVALID TICKET</div>
          <div className={styles.resSub}>
            {result.code
              ? 'The code does not match its signature.'
              : 'That is not an OK Corral ticket.'}
          </div>
          <div className={styles.resTap}>Tap to dismiss</div>
        </>
      )}

      {result.kind === 'notfound' && (
        <>
          <div className={styles.resHead}>NOT FOUND</div>
          <div className={styles.resSub}>
            {result.reason === 'offline'
              ? "Couldn't reach the server — try refreshing the list."
              : 'Not on the list.'}
          </div>
          <div className={styles.resCode}>{formatTicketCode(result.code)}</div>
          <div className={styles.resTap}>Tap to dismiss</div>
        </>
      )}
    </div>
  )
}

// ── Will-call ─────────────────────────────────────────────────────
/**
 * The phone-died case, which is common rather than exceptional --
 * hence one tap from scan mode, not buried.
 */
function Lookup({
  manifest,
  onAdmit,
}: {
  manifest: DoorManifest | null
  onAdmit: (t: ManifestTicket) => Promise<void>
}) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const codeNeedle = normalizeTicketCode(q)

  const tickets = manifest?.tickets ?? []
  const matches = needle
    ? tickets.filter(
        t =>
          (t.purchaser_name ?? '').toLowerCase().includes(needle) ||
          // Normalised on both sides, so PNGV-XSBT-67MR and pngvxsbt67mr
          // both find the same ticket.
          (codeNeedle.length >= 3 && t.code.includes(codeNeedle))
      )
    : []

  // Group by order so a party of four reads as one person with four.
  const orders = new Map<string, ManifestTicket[]>()
  for (const t of matches) {
    orders.set(t.order_id, [...(orders.get(t.order_id) ?? []), t])
  }

  return (
    <div className={styles.lookup}>
      <input
        className={styles.search}
        type="search"
        inputMode="search"
        autoFocus
        placeholder="Name or ticket code…"
        value={q}
        onChange={e => setQ(e.target.value)}
        aria-label="Search by purchaser name or ticket code"
      />

      {!needle && <p className={styles.hint}>Type a name or a code from their email.</p>}
      {needle && orders.size === 0 && <p className={styles.hint}>Nothing matches “{q.trim()}”.</p>}

      {[...orders.entries()].map(([orderId, group]) => (
        <div key={orderId} className={styles.order}>
          <div className={styles.orderName}>{group[0].purchaser_name || 'No name given'}</div>
          <div className={styles.orderMeta}>
            {group.length} of {group[0].order_size} shown
          </div>
          <ul className={styles.orderTickets}>
            {group
              .slice()
              .sort((a, b) => a.seq - b.seq)
              .map(t => (
                <li key={t.code} className={styles.orderTicket}>
                  <span className={styles.ticketCode}>{formatTicketCode(t.code)}</span>
                  {t.status === 'valid' ? (
                    <button className={styles.admit} onClick={() => onAdmit(t)}>
                      Admit
                    </button>
                  ) : (
                    <span className={t.status === 'used' ? styles.tagUsed : styles.tagVoid}>
                      {t.status === 'used' ? `used ${ago(t.used_at)}` : 'refunded'}
                    </span>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
