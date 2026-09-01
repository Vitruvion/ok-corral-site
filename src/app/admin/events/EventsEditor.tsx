'use client'

import { useCallback, useMemo, useState } from 'react'
import type { AdminEvent } from '@/lib/admin/events-repo'
import PosterField from './PosterField'
import styles from './events.module.css'

/**
 * Phone-first event editor.
 *
 * Same shape as /admin/menu: per-row saves, an explicit state badge,
 * buttons rather than drag, collapsed by default. Used one-handed,
 * often the moment a show gets booked.
 *
 * CREATE SHOWS THREE FIELDS. name, date and time are the only columns
 * that are NOT NULL with no default and nothing to derive them from --
 * slug comes from the name, weekday from the date. Everything else is
 * behind "More details", because adding a show should be three taps and
 * a save, not a scroll past twelve inputs to reach the button. Editing
 * is a considered action and shows everything.
 */

type Props = { initial: AdminEvent[] }

type RowState = 'idle' | 'saving' | 'saved' | 'error'

const money = (n: number) => '$' + n.toFixed(n % 1 === 0 ? 0 : 2)

/**
 * Shown wherever a past show is or could be featured.
 *
 * Not a warning and not a block -- featuring a past show is harmless,
 * it simply has no effect, because the homepage filters past shows out
 * before it renders. Without this line the badge moves, the site looks
 * unchanged, and someone goes looking for a bug that is not there.
 */
const PAST_FEATURE_NOTE = 'Past shows don’t appear on the site, so featuring this has no effect.'

/** Mirrors events-repo.weekdayFor so the form can show it as you type. */
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
function weekdayFor(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!m) return ''
  // Date.UTC, not new Date(string) -- the latter is parsed as UTC
  // midnight and reads back a day earlier in Pacific.
  return WEEKDAYS[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()]
}

const prettyDate = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return MONTHS[+m[2] - 1] + ' ' + +m[3] + ', ' + m[1]
}

export default function EventsEditor({ initial }: Props) {
  const [events, setEvents] = useState<AdminEvent[]>(initial)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [state, setState] = useState<Record<string, RowState>>({})
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [creating, setCreating] = useState(false)
  const [showPast, setShowPast] = useState(false)

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/events', { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      setEvents(data.events ?? [])
    }
  }, [])

  const upcoming = useMemo(() => events.filter(e => e.upcoming), [events])
  const past = useMemo(() => [...events.filter(e => !e.upcoming)].reverse(), [events])
  const featured = useMemo(() => events.find(e => e.featured) ?? null, [events])

  const setRow = (id: string, s: RowState, err: string | null = null) => {
    setState(prev => ({ ...prev, [id]: s }))
    setErrors(prev => ({ ...prev, [id]: err }))
    if (s === 'saved') setTimeout(() => setState(prev => ({ ...prev, [id]: 'idle' })), 1800)
  }

  /**
   * Sends a patch, and re-sends it with the acknowledgement the server
   * asked for once the person confirms. The server decides what needs
   * confirming -- this only relays the question.
   */
  const patch = useCallback(
    async (id: string, body: Record<string, unknown>): Promise<boolean> => {
      setRow(id, 'saving')
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch('/api/admin/events', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...body }),
        })
        const data = await res.json().catch(() => ({}))

        if (res.ok) {
          setRow(id, 'saved')
          await refresh()
          return true
        }
        if (res.status === 409 && data.needs) {
          if (!window.confirm(data.error)) {
            setRow(id, 'idle')
            return false
          }
          body = { ...body, [data.needs]: true }
          continue
        }
        setRow(id, 'error', data.error || 'Could not save.')
        return false
      }
      setRow(id, 'error', 'Could not save.')
      return false
    },
    [refresh]
  )

  const feature = useCallback(
    async (id: string | null) => {
      const key = id ?? 'none'
      setRow(key, 'saving')
      const res = await fetch('/api/admin/events', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setRow(key, 'error', data.error || 'Could not change the featured show.')
      setRow(key, 'saved')
      await refresh()
    },
    [refresh]
  )

  const remove = useCallback(
    async (ev: AdminEvent) => {
      const warning =
        ev.sold > 0
          ? ev.name + ' has ' + ev.sold + ' admitted. It will be hidden from the site, not deleted, so those tickets still scan. Continue?'
          : 'Delete ' + ev.name + '? This cannot be undone.'
      if (!window.confirm(warning)) return

      setRow(ev.id, 'saving')
      const res = await fetch('/api/admin/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ev.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setRow(ev.id, 'error', data.error || 'Could not remove the show.')
      await refresh()
    },
    [refresh]
  )

  return (
    <div className={styles.editor}>
      <CreateForm
        busy={creating}
        onCreate={async body => {
          setCreating(true)
          try {
            const res = await fetch('/api/admin/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) return data.error || 'Could not create the show.'
            await refresh()
            return null
          } finally {
            setCreating(false)
          }
        }}
      />

      <div className={styles.featuredLine}>
        {featured ? (
          <>
            Featured show: <strong>{featured.name}</strong>
            <button className={styles.linkBtn} onClick={() => feature(null)}>
              clear
            </button>
            {/* The homepage drops past shows before it renders, so a
                featured past show does nothing at all. Said here rather
                than left to be discovered by checking the site and
                finding no change. */}
            {!featured.upcoming && <span className={styles.noEffect}>{PAST_FEATURE_NOTE}</span>}
          </>
        ) : (
          <>No featured show. One show can be featured; it auto-opens on the site.</>
        )}
      </div>

      <h2 className={styles.sectionHead}>Upcoming</h2>
      {upcoming.length === 0 && <p className={styles.empty}>No upcoming shows.</p>}
      {upcoming.map(ev => (
        <EventRow
          key={ev.id}
          ev={ev}
          open={open[ev.id] ?? false}
          state={state[ev.id] ?? 'idle'}
          error={errors[ev.id] ?? null}
          onToggle={() => setOpen(p => ({ ...p, [ev.id]: !p[ev.id] }))}
          onPatch={body => patch(ev.id, body)}
          onFeature={() => feature(ev.featured ? null : ev.id)}
          onRemove={() => remove(ev)}
          onRefresh={refresh}
          setRow={setRow}
        />
      ))}

      {past.length > 0 && (
        <>
          <button className={styles.pastToggle} onClick={() => setShowPast(s => !s)}>
            {showPast ? '−' : '+'} Past shows ({past.length})
          </button>
          {showPast &&
            past.map(ev => (
              <EventRow
                key={ev.id}
                ev={ev}
                open={open[ev.id] ?? false}
                state={state[ev.id] ?? 'idle'}
                error={errors[ev.id] ?? null}
                onToggle={() => setOpen(p => ({ ...p, [ev.id]: !p[ev.id] }))}
                onPatch={body => patch(ev.id, body)}
                onFeature={() => feature(ev.featured ? null : ev.id)}
                onRemove={() => remove(ev)}
                onRefresh={refresh}
                setRow={setRow}
              />
            ))}
        </>
      )}
    </div>
  )
}

// ── Create ────────────────────────────────────────────────────────
/**
 * Three fields and a save.
 *
 * name, date and time are the only ones the database cannot do without
 * and cannot derive. Everything else is optional and folded away: "we
 * just booked this, get it on the site" should not require scrolling
 * past a genre picker.
 */
function CreateForm({
  busy,
  onCreate,
}: {
  busy: boolean
  onCreate: (body: Record<string, unknown>) => Promise<string | null>
}) {
  const [openForm, setOpenForm] = useState(false)
  const [more, setMore] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [f, setF] = useState({
    name: '', date: '', time: '',
    support: '', doors: '', genre: '', tickets: '', description: '', tags: '',
    youtube_url: '', signup_url: '',
  })

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF(p => ({ ...p, [k]: e.target.value }))

  const weekday = weekdayFor(f.date)
  const ready = f.name.trim() && f.date && f.time.trim()

  if (!openForm) {
    return (
      <button className={styles.addBtn} onClick={() => setOpenForm(true)}>
        + Add a show
      </button>
    )
  }

  return (
    <section className={styles.create}>
      <h2 className={styles.sectionHead}>New show</h2>

      <label className={styles.field}>
        <span className={styles.label}>
          Name <em className={styles.req}>required</em>
        </span>
        <input className={styles.input} value={f.name} onChange={set('name')} placeholder="Who's playing" />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>
          Date <em className={styles.req}>required</em>
          {weekday && <em className={styles.derived}>{weekday}</em>}
        </span>
        <input className={styles.input} type="date" value={f.date} onChange={set('date')} />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>
          Time <em className={styles.req}>required</em>
        </span>
        <input className={styles.input} value={f.time} onChange={set('time')} placeholder="8:30 PM" />
      </label>

      <button className={styles.moreToggle} onClick={() => setMore(m => !m)}>
        {more ? '−' : '+'} More details
      </button>

      {more && (
        <div className={styles.moreFields}>
          <Field label="Support" value={f.support} onChange={set('support')} placeholder="w/ Tanner Bingaman" />
          <Field
            label="Doors"
            value={f.doors}
            onChange={set('doors')}
            placeholder="7:30 PM"
            hint="Not shown on the site, but used in the ticket email and at the door."
          />
          <Field label="Genre" value={f.genre} onChange={set('genre')} placeholder="Cajun alt-folk" />
          <Field label="Tickets line" value={f.tickets} onChange={set('tickets')} placeholder="$15 at the door" />
          <Field label="Tags" value={f.tags} onChange={set('tags')} placeholder="live music, 21+" hint="Comma separated." />
          <Field label="YouTube URL" value={f.youtube_url} onChange={set('youtube_url')} />
          <Field label="Sign-up URL" value={f.signup_url} onChange={set('signup_url')} hint="For contests. Separate from tickets." />
          <label className={styles.field}>
            <span className={styles.label}>Description</span>
            <textarea className={styles.textarea} rows={4} value={f.description} onChange={set('description')} />
          </label>
        </div>
      )}

      {err && <div className={styles.error}>{err}</div>}

      <div className={styles.createActions}>
        <button
          className={styles.saveBtn}
          disabled={!ready || busy}
          onClick={async () => {
            setErr(null)
            const message = await onCreate({
              name: f.name,
              date: f.date,
              time: f.time,
              support: f.support || undefined,
              doors: f.doors || undefined,
              genre: f.genre || undefined,
              tickets: f.tickets || undefined,
              description: f.description || undefined,
              youtube_url: f.youtube_url || undefined,
              signup_url: f.signup_url || undefined,
              tags: f.tags ? f.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
            })
            if (message) return setErr(message)
            setF({ name: '', date: '', time: '', support: '', doors: '', genre: '', tickets: '', description: '', tags: '', youtube_url: '', signup_url: '' })
            setMore(false)
            setOpenForm(false)
          }}
        >
          {busy ? 'Saving…' : 'Add show'}
        </button>
        <button className={styles.cancelBtn} onClick={() => setOpenForm(false)}>
          Cancel
        </button>
      </div>
    </section>
  )
}

function Field({
  label, value, onChange, placeholder, hint,
}: {
  label: string
  value: string
  onChange: (e: { target: { value: string } }) => void
  placeholder?: string
  hint?: string
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input className={styles.input} value={value} onChange={onChange} placeholder={placeholder} />
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  )
}

// ── One event ─────────────────────────────────────────────────────
function EventRow({
  ev, open, state, error, onToggle, onPatch, onFeature, onRemove, onRefresh, setRow,
}: {
  ev: AdminEvent
  open: boolean
  state: RowState
  error: string | null
  onToggle: () => void
  onPatch: (body: Record<string, unknown>) => Promise<boolean>
  onFeature: () => void
  onRemove: () => void
  onRefresh: () => Promise<void>
  setRow: (id: string, s: RowState, err?: string | null) => void
}) {
  const [d, setD] = useState({
    name: ev.name, date: ev.date, time: ev.time,
    support: ev.support ?? '', doors: ev.doors ?? '', genre: ev.genre ?? '',
    tickets: ev.tickets ?? '', description: ev.description ?? '',
    tags: (ev.tags ?? []).join(', '),
    youtube_url: ev.youtube_url ?? '', signup_url: ev.signup_url ?? '',
    sort_order: String(ev.sort_order),
  })
  const set = (k: keyof typeof d) => (e: { target: { value: string } }) =>
    setD(p => ({ ...p, [k]: e.target.value }))

  const weekday = weekdayFor(d.date)

  return (
    <section className={ev.active ? styles.row : styles.rowOff}>
      <button className={styles.rowHead} onClick={onToggle} aria-expanded={open}>
        <span className={styles.rowMain}>
          <span className={styles.rowName}>{ev.name}</span>
          <span className={styles.rowMeta}>
            {prettyDate(ev.date)} · {ev.time}
            {!ev.active && <span className={styles.tag}>hidden</span>}
            {ev.featured && <span className={styles.tagFeatured}>featured</span>}
          </span>
        </span>
        {ev.tickets_on_sale || ev.sold > 0 ? (
          <span className={styles.sold}>
            {ev.sold} sold
          </span>
        ) : null}
        <span className={styles.chevron}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className={styles.rowBody}>
          {/* The number that changes what every edit below means. */}
          {ev.sold > 0 && (
            <div className={styles.soldBanner}>
              {ev.sold} {ev.sold === 1 ? 'ticket' : 'tickets'} sold
            </div>
          )}

          <label className={styles.field}>
            <span className={styles.label}>Name</span>
            <input className={styles.input} value={d.name} onChange={set('name')} />
            <span className={styles.hint}>The link stays {ev.slug} even if you rename it.</span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>
              Date {weekday && <em className={styles.derived}>{weekday}</em>}
            </span>
            <input className={styles.input} type="date" value={d.date} onChange={set('date')} />
          </label>

          <Field label="Time" value={d.time} onChange={set('time')} />
          <Field label="Support" value={d.support} onChange={set('support')} />
          <Field
            label="Doors"
            value={d.doors}
            onChange={set('doors')}
            hint="Not shown on the site, but used in the ticket email and at the door."
          />
          <Field label="Genre" value={d.genre} onChange={set('genre')} />
          <Field label="Tickets line" value={d.tickets} onChange={set('tickets')} />
          <Field label="Tags" value={d.tags} onChange={set('tags')} hint="Comma separated." />
          <Field label="YouTube URL" value={d.youtube_url} onChange={set('youtube_url')} />
          <Field label="Sign-up URL" value={d.signup_url} onChange={set('signup_url')} />
          <Field label="Sort order" value={d.sort_order} onChange={set('sort_order')} hint="Lower sorts first." />

          <label className={styles.field}>
            <span className={styles.label}>Description</span>
            <textarea className={styles.textarea} rows={5} value={d.description} onChange={set('description')} />
          </label>

          <PosterField
            eventId={ev.id}
            posterUrl={ev.poster_url}
            onChange={() => void onRefresh()}
          />

          <SalesPanel ev={ev} onRefresh={onRefresh} setRow={setRow} />

          <div className={styles.rowActions}>
            <button
              className={styles.saveBtn}
              disabled={state === 'saving'}
              onClick={() =>
                onPatch({
                  name: d.name,
                  date: d.date,
                  time: d.time,
                  support: d.support,
                  doors: d.doors,
                  genre: d.genre,
                  tickets: d.tickets,
                  description: d.description,
                  youtube_url: d.youtube_url,
                  signup_url: d.signup_url,
                  sort_order: Number(d.sort_order) || 0,
                  tags: d.tags.split(',').map(t => t.trim()).filter(Boolean),
                })
              }
            >
              {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save'}
            </button>

            <button className={styles.ghostBtn} onClick={() => onPatch({ active: !ev.active })}>
              {ev.active ? 'Hide from site' : 'Show on site'}
            </button>

            <button className={ev.featured ? styles.featuredOn : styles.ghostBtn} onClick={onFeature}>
              {ev.featured ? 'Featured show' : 'Make featured'}
            </button>

            <button className={styles.dangerBtn} onClick={onRemove}>
              {ev.sold > 0 ? 'Retire' : 'Delete'}
            </button>
          </div>

          {/* Same fact, next to the control it applies to. Shown on any
              past show, so it heads the mistake off rather than only
              explaining it afterwards. */}
          {!ev.upcoming && <p className={styles.noEffectRow}>{PAST_FEATURE_NOTE}</p>}

          {error && <div className={styles.error}>{error}</div>}
        </div>
      )}
    </section>
  )
}

// ── Ticket sales ──────────────────────────────────────────────────
/**
 * Sales is one action, not a toggle plus a price.
 *
 * There is no control here that sets tickets_on_sale on its own: the
 * only way to switch sales on is to submit a price with it. On-sale
 * with a null price would render a purchase widget on the public site
 * with nothing to charge.
 */
function SalesPanel({
  ev, onRefresh, setRow,
}: {
  ev: AdminEvent
  onRefresh: () => Promise<void>
  setRow: (id: string, s: RowState, err?: string | null) => void
}) {
  const [form, setForm] = useState(false)
  const [price, setPrice] = useState(ev.ticket_price === null ? '' : String(ev.ticket_price))
  const [capacity, setCapacity] = useState(ev.ticket_capacity === null ? '' : String(ev.ticket_capacity))
  const [blurb, setBlurb] = useState(ev.ticket_blurb ?? '')
  const [err, setErr] = useState<string | null>(null)

  const send = async (body: Record<string, unknown>) => {
    setErr(null)
    setRow(ev.id, 'saving')
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch('/api/admin/events/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ev.id, ...body }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setRow(ev.id, 'saved')
        setForm(false)
        await onRefresh()
        return
      }
      if (res.status === 409 && data.needs) {
        if (!window.confirm(data.error)) return setRow(ev.id, 'idle')
        body = { ...body, [data.needs]: true }
        continue
      }
      setRow(ev.id, 'idle')
      return setErr(data.error || 'Could not update ticket sales.')
    }
  }

  return (
    <div className={styles.sales}>
      <span className={styles.label}>Ticket sales</span>

      {ev.tickets_on_sale ? (
        <div className={styles.salesOn}>
          <span className={styles.salesState}>
            On sale · {ev.ticket_price !== null ? money(ev.ticket_price) : 'no price'} ·{' '}
            {ev.ticket_capacity === null ? 'no cap' : ev.ticket_capacity + ' cap'}
          </span>
          <button className={styles.ghostBtn} onClick={() => setForm(f => !f)}>
            {form ? 'Cancel' : 'Change'}
          </button>
          <button className={styles.ghostBtn} onClick={() => send({ on: false })}>
            Stop selling
          </button>
        </div>
      ) : (
        <div className={styles.salesOff}>
          <span className={styles.salesState}>Not selling tickets</span>
          <button className={styles.ghostBtn} onClick={() => setForm(f => !f)}>
            {form ? 'Cancel' : 'Sell tickets'}
          </button>
        </div>
      )}

      {form && (
        <div className={styles.salesForm}>
          <label className={styles.field}>
            <span className={styles.label}>
              Price <em className={styles.req}>required</em>
            </span>
            <input
              className={styles.input}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="15"
            />
            {ev.sold > 0 && (
              <span className={styles.hint}>
                Changing this affects future buyers only. The {ev.sold} already sold are not
                refunded or charged the difference.
              </span>
            )}
          </label>

          <Field
            label="Capacity"
            value={capacity}
            onChange={e => setCapacity(e.target.value)}
            hint="Leave blank for unlimited."
          />
          <Field
            label="Checkout note"
            value={blurb}
            onChange={e => setBlurb(e.target.value)}
            hint="Shown at checkout. Refund policy, age limits."
          />

          {err && <div className={styles.error}>{err}</div>}

          <button
            className={styles.saveBtn}
            disabled={!price || Number(price) <= 0}
            onClick={() =>
              send({
                on: true,
                price: Number(price),
                capacity: capacity ? Number(capacity) : null,
                blurb: blurb || null,
              })
            }
          >
            {ev.tickets_on_sale ? 'Update sales' : 'Start selling'}
          </button>
        </div>
      )}
    </div>
  )
}
