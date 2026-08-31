import type { DoorManifest, ManifestTicket } from '@/lib/tickets/door'

/**
 * IndexedDB for the door scanner.
 *
 * NOT localStorage. A manifest is hundreds of rows; localStorage is
 * synchronous (so every write janks the camera loop), capped around 5MB,
 * and stores strings only, meaning a full parse and re-serialise on
 * every scan. IndexedDB is asynchronous and structured.
 *
 * Two stores:
 *   manifests  keyed by event id -- the guest list plus its signatures
 *   queue      auto-increment    -- scans taken while offline
 *
 * Everything here fails soft. A door that stops working because storage
 * misbehaved is worse than a door running on a stale list, so callers
 * get null or an empty array rather than an exception.
 */

const DB_NAME = 'okcorral-door'
const DB_VERSION = 1
const MANIFESTS = 'manifests'
const QUEUE = 'queue'

export type QueuedScan = {
  id?: number
  event_id: string
  code: string
  scanned_at: string
}

/** Local copy of a manifest, plus when this device fetched it. */
export type StoredManifest = DoorManifest & { fetched_at: number }

let dbPromise: Promise<IDBDatabase | null> | null = null

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise(resolve => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(MANIFESTS)) {
          db.createObjectStore(MANIFESTS, { keyPath: 'event_id' })
        }
        if (!db.objectStoreNames.contains(QUEUE)) {
          db.createObjectStore(QUEUE, { keyPath: 'id', autoIncrement: true })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => {
        console.warn('[door] IndexedDB unavailable', req.error)
        resolve(null)
      }
    } catch (err) {
      console.warn('[door] IndexedDB open threw', err)
      resolve(null)
    }
  })
  return dbPromise
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return open().then(
    db =>
      new Promise<T | null>(resolve => {
        if (!db) return resolve(null)
        try {
          const t = db.transaction(store, mode)
          const req = run(t.objectStore(store))
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => {
            console.warn('[door] IndexedDB request failed', req.error)
            resolve(null)
          }
        } catch (err) {
          console.warn('[door] IndexedDB transaction threw', err)
          resolve(null)
        }
      })
  )
}

// ── Manifests ─────────────────────────────────────────────────────
export async function saveManifest(manifest: DoorManifest): Promise<void> {
  const stored: StoredManifest & { event_id: string } = {
    ...manifest,
    event_id: manifest.event.id,
    fetched_at: Date.now(),
  }
  await tx(MANIFESTS, 'readwrite', s => s.put(stored))
}

export async function loadManifest(eventId: string): Promise<StoredManifest | null> {
  const row = await tx<any>(MANIFESTS, 'readonly', s => s.get(eventId))
  return row ?? null
}

/**
 * Applies a scan to the stored manifest immediately, network or not.
 *
 * This is what makes duplicate detection exact offline: one phone works
 * the door, so a ticket this device has already burned is known to be
 * burned even with no signal. Returns the updated ticket, or null if the
 * code is not in the manifest.
 */
export async function markUsedLocally(
  eventId: string,
  code: string,
  usedAt: string,
  usedBy: string
): Promise<ManifestTicket | null> {
  const stored = await loadManifest(eventId)
  if (!stored) return null

  const ticket = stored.tickets.find(t => t.code === code)
  if (!ticket) return null

  // Never move a used_at later. If the server already recorded an
  // earlier scan, that earlier moment is the true one.
  //
  // Compared as INSTANTS, not strings. Postgres returns
  // '...T20:20:00.407+00:00' while the client generates '...T20:20:00.407Z'
  // for the same moment, and '+' sorts before 'Z', so a string compare
  // would read every server timestamp as earlier than every local one and
  // silently refuse to record the scan time.
  const incoming = Date.parse(usedAt)
  const existing = ticket.used_at ? Date.parse(ticket.used_at) : NaN
  if (ticket.status !== 'used' || !Number.isFinite(existing) || incoming < existing) {
    ticket.used_at = usedAt
    ticket.used_by = usedBy
  }
  ticket.status = 'used'

  await tx(MANIFESTS, 'readwrite', s => s.put(stored))
  return ticket
}

// ── Offline queue ─────────────────────────────────────────────────
export async function enqueueScan(scan: QueuedScan): Promise<void> {
  await tx(QUEUE, 'readwrite', s => s.add(scan))
}

export async function listQueue(): Promise<QueuedScan[]> {
  const rows = await tx<any[]>(QUEUE, 'readonly', s => s.getAll())
  return rows ?? []
}

export async function removeQueued(ids: number[]): Promise<void> {
  const db = await open()
  if (!db || ids.length === 0) return
  try {
    const t = db.transaction(QUEUE, 'readwrite')
    const store = t.objectStore(QUEUE)
    for (const id of ids) store.delete(id)
  } catch (err) {
    console.warn('[door] could not clear queued scans', err)
  }
}

/**
 * Distinct queued codes per event.
 *
 * Distinct because a double-tap offline enqueues the same code twice,
 * and one person cannot walk in twice.
 */
export async function queuedByEvent(): Promise<Record<string, string[]>> {
  const rows = await listQueue()
  const byEvent: Record<string, Set<string>> = {}
  for (const r of rows) {
    ;(byEvent[r.event_id] ??= new Set()).add(r.code)
  }
  return Object.fromEntries(Object.entries(byEvent).map(([k, v]) => [k, [...v]]))
}

/**
 * How many tickets this device believes are used, per event, from the
 * stored manifests.
 *
 * This is the local truth the picker needs: a scan sitting in the
 * offline queue has already happened as far as the door is concerned,
 * and the count must not go backwards just because the server has not
 * heard about it yet.
 */
export async function localUsedByEvent(eventIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const id of eventIds) {
    const stored = await loadManifest(id)
    if (!stored) continue
    out[id] = stored.tickets.filter(t => t.status === 'used').length
  }
  return out
}

export async function queueSize(): Promise<number> {
  const n = await tx<number>(QUEUE, 'readonly', s => s.count())
  return n ?? 0
}

/**
 * A stable id for this phone, so used_by says which device let someone
 * in. Random, stored once. Not a credential -- the admin cookie is the
 * only thing that authorises anything.
 */
export function deviceId(): string {
  const KEY = 'okcorral-door-device'
  try {
    let id = localStorage.getItem(KEY)
    if (!id) {
      id = `door-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`
      localStorage.setItem(KEY, id)
    }
    return id
  } catch {
    // Private mode, or storage blocked. A per-session label still beats
    // recording nothing.
    return 'door-ephemeral'
  }
}
