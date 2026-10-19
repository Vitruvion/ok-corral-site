'use client'

import { useCallback, useId, useMemo, useState } from 'react'
import type { AdminEvent } from '@/lib/admin/events-repo'
import type { AdminRecurring } from '@/lib/admin/recurring-repo'
import {
  HHMM,
  WEEK_DAYS,
  dayName,
  formatWeeklyTime,
  parseWeeklyTime,
  type DayAbbr,
} from '@/lib/recurring'
import PosterField, { uploadPoster } from './PosterField'
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
 *
 * WEEKLY SPECIALS live here too ("Every week"), but in their own table
 * and their own API -- /api/admin/recurring. They have a day of the week
 * instead of a date, and no tickets, no featuring and no "past", so the
 * sales panel is simply never rendered for them.
 */

type Props = { initial: AdminEvent[]; initialRecurring: AdminRecurring[] }

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

export default function EventsEditor({ initial, initialRecurring }: Props) {
  const [events, setEvents] = useState<AdminEvent[]>(initial)
  const [recurring, setRecurring] = useState<AdminRecurring[]>(initialRecurring)
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [state, setState] = useState<Record<string, RowState>>({})
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [creating, setCreating] = useState(false)
  /**
   * Set when a show was created but its poster upload failed.
   *
   * Not an error on the create form: the show is saved and the form has
   * already closed. It belongs on the page, next to the list the new row
   * is now in.
   */
  const [posterWarning, setPosterWarning] = useState<string | null>(null)
  const [showPast, setShowPast] = useState(false)
  /** Why a given row was hidden rather than deleted. Set at the moment
      it happens, so the outcome is explained where it occurred. */
  const [deactivated, setDeactivated] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    const res = await fetch('/api/admin/events', { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      setEvents(data.events ?? [])
    }
  }, [])

  // Already Monday-first: the API sorts with the same compareRecurring
  // the homepage uses.
  const refreshRecurring = useCallback(async () => {
    const res = await fetch('/api/admin/recurring', { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      setRecurring(data.recurring ?? [])
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
      // ev.sold counts admissions, which is what decides the outcome for
      // the common case. An abandoned checkout contributes nothing to it,
      // so a show with only one of those reads as an outright delete --
      // which is now what happens.
      const warning =
        ev.sold > 0
          ? ev.name + ' has ' + ev.sold + ' admitted. It will be hidden from the site, not deleted, so those tickets still scan. Continue?'
          : 'Delete ' + ev.name + '? The poster is deleted too. This cannot be undone.'
      if (!window.confirm(warning)) return

      setRow(ev.id, 'saving')
      const res = await fetch('/api/admin/events', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ev.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setRow(ev.id, 'error', data.error || 'Could not remove the show.')

      // A show someone actually holds something for is hidden, not
      // deleted. Say so here rather than leaving the row sitting there
      // looking like a failed delete -- and name the REAL reason, which
      // is issued tickets or settled money, not the mere existence of an
      // order row.
      if (data.mode === 'deactivated') {
        const tickets = data.tickets ?? 0
        const settled = data.settledOrders ?? 0
        const reason =
          tickets > 0
            ? (tickets === 1 ? '1 ticket has' : tickets + ' tickets have') + ' been issued for it'
            : (settled === 1 ? '1 paid order points' : settled + ' paid orders point') + ' at it'
        setDeactivated(prev => ({
          ...prev,
          [ev.id]:
            'Hidden from the site rather than deleted, because ' + reason +
            '. Those still have to scan at the door, which needs this show to ' +
            'exist. Restore it any time.',
        }))
      }
      await refresh()
    },
    [refresh]
  )

  /** A weekly special has nothing to confirm -- nobody holds a ticket for it. */
  const patchWeekly = useCallback(
    async (id: string, body: Record<string, unknown>): Promise<boolean> => {
      setRow(id, 'saving')
      const res = await fetch('/api/admin/recurring', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRow(id, 'error', data.error || 'Could not save.')
        return false
      }
      setRow(id, 'saved')
      await refreshRecurring()
      return true
    },
    [refreshRecurring]
  )

  const removeWeekly = useCallback(
    async (r: AdminRecurring) => {
      if (!window.confirm('Delete ' + r.name + '? The poster is deleted too. This cannot be undone.')) return
      setRow(r.id, 'saving')
      const res = await fetch('/api/admin/recurring', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setRow(r.id, 'error', data.error || 'Could not delete it.')
      await refreshRecurring()
    },
    [refreshRecurring]
  )

  return (
    <div className={styles.editor}>
      <CreateForm
        busy={creating}
        onCreate={async (kind, body, posterFile) => {
          setCreating(true)
          setPosterWarning(null)
          const weekly = kind === 'weekly'
          try {
            const res = await fetch(weekly ? '/api/admin/recurring' : '/api/admin/events', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) return data.error || (weekly ? 'Could not create the weekly event.' : 'Could not create the show.')

            /*
             * The poster goes up only now, with the id the insert just
             * returned. Deliberately in this order: the upload endpoint
             * writes the Storage object AND sets poster_url in one step,
             * so there is no moment at which an object exists for a show
             * that does not. If the create above had failed, nothing was
             * ever sent to Storage.
             *
             * A failure here does NOT fail the create -- the show is
             * saved and real. It is reported as a warning against the
             * list, and the poster can be added from the row.
             */
            if (posterFile) {
              try {
                await uploadPoster(data.id, posterFile, undefined, weekly ? 'recurring' : 'event')
              } catch (err: any) {
                setPosterWarning(
                  String(body.name) +
                    ' was added, but the poster did not upload: ' +
                    (err?.message || 'unknown error') +
                    (weekly ? ' Open it under Every week to add it.' : ' Open the show to add it.')
                )
              }
            }

            await (weekly ? refreshRecurring() : refresh())
            return null
          } finally {
            setCreating(false)
          }
        }}
      />

      {posterWarning && (
        <div className={styles.createWarn}>
          {posterWarning}
          <button className={styles.linkBtn} onClick={() => setPosterWarning(null)}>
            dismiss
          </button>
        </div>
      )}

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
          deactivatedNote={deactivated[ev.id] ?? null}
          onRestore={() => patch(ev.id, { active: true })}
        />
      ))}

      {/* Monday to Sunday, separate from dated shows. Hidden ones stay
          in place, marked, rather than dropping to the bottom. */}
      <h2 className={styles.sectionHead}>Every week</h2>
      {recurring.length === 0 && <p className={styles.empty}>No weekly events.</p>}
      {recurring.map(r => (
        <RecurringRow
          key={r.id}
          r={r}
          open={open[r.id] ?? false}
          state={state[r.id] ?? 'idle'}
          error={errors[r.id] ?? null}
          onToggle={() => setOpen(p => ({ ...p, [r.id]: !p[r.id] }))}
          onPatch={body => patchWeekly(r.id, body)}
          onRemove={() => removeWeekly(r)}
          onRefresh={refreshRecurring}
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
                deactivatedNote={deactivated[ev.id] ?? null}
                onRestore={() => patch(ev.id, { active: true })}
              />
            ))}
        </>
      )}
    </div>
  )
}

// ── Create ────────────────────────────────────────────────────────
type CreateKind = 'once' | 'weekly'

/**
 * Three fields and a save.
 *
 * name, date and time are the only ones the database cannot do without
 * and cannot derive. Everything else is optional and folded away: "we
 * just booked this, get it on the site" should not require scrolling
 * past a genre picker.
 *
 * "Every week" swaps the date for a day of the week and is the same
 * three fields: name, day, start time. One-time is the default because
 * that is what gets added most.
 */
function CreateForm({
  busy,
  onCreate,
}: {
  busy: boolean
  onCreate: (kind: CreateKind, body: Record<string, unknown>, posterFile: File | null) => Promise<string | null>
}) {
  const [openForm, setOpenForm] = useState(false)
  const [kind, setKind] = useState<CreateKind>('once')
  const [more, setMore] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  /**
   * Chosen and resized, but not sent: there is no row to attach it to
   * until the save below succeeds.
   */
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const BLANK = {
    name: '', date: '', time: '',
    support: '', doors: '', genre: '', tickets: '', description: '', tags: '',
    youtube_url: '', signup_url: '',
  }
  const [f, setF] = useState(BLANK)
  const [day, setDay] = useState<DayAbbr | ''>('')
  const [wt, setWt] = useState<TimeForm>(EMPTY_TIME)

  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF(p => ({ ...p, [k]: e.target.value }))

  const weekly = kind === 'weekly'
  const weekday = weekdayFor(f.date)
  const ready = weekly
    ? f.name.trim() && day && timeReady(wt)
    : f.name.trim() && f.date && f.time.trim()

  const reset = () => {
    setF(BLANK)
    setDay('')
    setWt(EMPTY_TIME)
    setPosterFile(null)
    setMore(false)
    setKind('once')
    setOpenForm(false)
  }

  if (!openForm) {
    return (
      <button className={styles.addBtn} onClick={() => setOpenForm(true)}>
        + Add a show or weekly event
      </button>
    )
  }

  return (
    <section className={styles.create}>
      <h2 className={styles.sectionHead}>{weekly ? 'New weekly event' : 'New show'}</h2>

      <div className={styles.kindToggle} role="radiogroup" aria-label="How often">
        <button
          type="button"
          role="radio"
          aria-checked={!weekly}
          className={!weekly ? styles.kindOn : styles.kindOff}
          onClick={() => setKind('once')}
        >
          One-time show
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={weekly}
          className={weekly ? styles.kindOn : styles.kindOff}
          onClick={() => setKind('weekly')}
        >
          Every week
        </button>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>
          Name <em className={styles.req}>required</em>
        </span>
        <input
          className={styles.input}
          value={f.name}
          onChange={set('name')}
          placeholder={weekly ? 'Karaoke Night' : "Who's playing"}
        />
      </label>

      {weekly ? (
        <>
          <DayPicker value={day} onChange={setDay} required />
          <StartTimeField t={wt} onChange={setWt} required />
        </>
      ) : (
        <>
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
        </>
      )}

      <button className={styles.moreToggle} onClick={() => setMore(m => !m)}>
        {more ? '−' : '+'} More details
      </button>

      {more && (
        <div className={styles.moreFields}>
          {weekly ? (
            <WeeklyDetails
              t={wt}
              onTime={setWt}
              support={f.support}
              tickets={f.tickets}
              onSupport={set('support')}
              onTickets={set('tickets')}
            />
          ) : (
            <>
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
            </>
          )}
          {/*
            eventId null -- the row does not exist yet, so this stages the
            file rather than uploading it. See PosterField. It sits in the
            same place for both kinds, so switching kind keeps a staged
            poster rather than silently dropping it.
          */}
          <PosterField
            eventId={null}
            kind={weekly ? 'recurring' : 'event'}
            posterUrl={null}
            onChange={() => {}}
            onStage={setPosterFile}
          />
        </div>
      )}

      {err && <div className={styles.error}>{err}</div>}

      <div className={styles.createActions}>
        <button
          className={styles.saveBtn}
          disabled={!ready || busy}
          onClick={async () => {
            setErr(null)
            const message = weekly
              ? await onCreate('weekly', {
                  name: f.name,
                  day,
                  time: timeBody(wt),
                  support: f.support || undefined,
                  tickets: f.tickets || undefined,
                }, posterFile)
              : await onCreate('once', {
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
                }, posterFile)
            if (message) return setErr(message)
            reset()
          }}
        >
          {busy ? 'Saving…' : weekly ? 'Add weekly event' : 'Add show'}
        </button>
        <button
          className={styles.cancelBtn}
          onClick={() => {
            setPosterFile(null)
            setOpenForm(false)
          }}
        >
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
  deactivatedNote, onRestore,
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
  deactivatedNote: string | null
  onRestore: () => void
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
      {/* An inactive show is off the site entirely. Without a strip
          saying so it looks like any other row -- and after a soft
          delete it reads as though the delete simply failed. */}
      {!ev.active && (
        <div className={styles.hiddenStrip}>
          <span className={styles.hiddenLabel}>Hidden from the site</span>
          <button className={styles.restoreBtn} onClick={onRestore}>
            Restore
          </button>
        </div>
      )}

      {deactivatedNote && <p className={styles.hiddenWhy}>{deactivatedNote}</p>}

      <button className={styles.rowHead} onClick={onToggle} aria-expanded={open}>
        <span className={styles.rowMain}>
          <span className={styles.rowName}>{ev.name}</span>
          <span className={styles.rowMeta}>
            {prettyDate(ev.date)} · {ev.time}
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

// ── Weekly ────────────────────────────────────────────────────────
/**
 * The time of a weekly special, as the form holds it.
 *
 * Real inputs, not free text: the API turns these parts into the
 * display string the homepage prints ("7 PM", "6–11 PM", "6 PM til
 * late", "All Day") -- see src/lib/recurring.ts -- so every row is in a
 * shape that sorts by start time and reads back into this form.
 */
type TimeForm = { allDay: boolean; start: string; endMode: 'none' | 'at' | 'late'; end: string }

const EMPTY_TIME: TimeForm = { allDay: false, start: '', endMode: 'none', end: '' }

function timeFormFrom(text: string | null): TimeForm {
  const t = parseWeeklyTime(text)
  if (!t) return EMPTY_TIME
  if (t.allDay) return { ...EMPTY_TIME, allDay: true }
  return {
    allDay: false,
    start: t.start,
    endMode: t.end ? 'at' : t.late ? 'late' : 'none',
    end: t.end ?? '',
  }
}

const timeReady = (t: TimeForm) =>
  t.allDay || (HHMM.test(t.start) && (t.endMode !== 'at' || HHMM.test(t.end)))

/** What the API takes. Only meaningful once timeReady(t). */
const timeBody = (t: TimeForm) => ({
  all_day: t.allDay,
  start: t.allDay ? null : t.start,
  end: !t.allDay && t.endMode === 'at' ? t.end : null,
  til_late: !t.allDay && t.endMode === 'late',
})

/** Exactly what the homepage will print, or '' while incomplete. */
const timePreview = (t: TimeForm) =>
  timeReady(t)
    ? formatWeeklyTime(
        t.allDay
          ? { allDay: true }
          : { allDay: false, start: t.start, end: t.endMode === 'at' ? t.end : null, late: t.endMode === 'late' }
      )
    : ''

/** Seven buttons, one tap. A select would be two taps and a wheel. */
function DayPicker({
  value, onChange, required,
}: {
  value: string
  onChange: (d: DayAbbr) => void
  required?: boolean
}) {
  return (
    <div className={styles.field}>
      <span className={styles.label}>
        Day {required && <em className={styles.req}>required</em>}
        {value && <em className={styles.derived}>Every {dayName(value)}</em>}
      </span>
      <div className={styles.dayPicker} role="radiogroup" aria-label="Day of the week">
        {WEEK_DAYS.map(d => (
          <button
            key={d.abbr}
            type="button"
            role="radio"
            aria-checked={value === d.abbr}
            aria-label={d.long}
            className={value === d.abbr ? styles.dayOn : styles.dayOff}
            onClick={() => onChange(d.abbr)}
          >
            {d.short}
          </button>
        ))}
      </div>
    </div>
  )
}

function StartTimeField({
  t, onChange, required, hint,
}: {
  t: TimeForm
  onChange: (t: TimeForm) => void
  required?: boolean
  hint?: string
}) {
  const preview = timePreview(t)
  const id = useId()
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        Start time {required && <em className={styles.req}>required</em>}
        {preview && <em className={styles.derived}>{preview}</em>}
      </label>
      <div className={styles.timeRow}>
        <input
          id={id}
          className={styles.input}
          type="time"
          step={900}
          value={t.allDay ? '' : t.start}
          disabled={t.allDay}
          onChange={e => onChange({ ...t, start: e.target.value })}
        />
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={t.allDay}
            onChange={e => onChange({ ...t, allDay: e.target.checked })}
          />
          All day
        </label>
      </div>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}

/** The optional half of a weekly special: when it ends, tagline, price. */
function WeeklyDetails({
  t, onTime, support, tickets, onSupport, onTickets,
}: {
  t: TimeForm
  onTime: (t: TimeForm) => void
  support: string
  tickets: string
  onSupport: (e: { target: { value: string } }) => void
  onTickets: (e: { target: { value: string } }) => void
}) {
  return (
    <>
      {!t.allDay && (
        <div className={styles.field}>
          <span className={styles.label}>Ends</span>
          <select
            className={styles.input}
            value={t.endMode}
            onChange={e => onTime({ ...t, endMode: e.target.value as TimeForm['endMode'] })}
            aria-label="Ends"
          >
            <option value="none">No end time</option>
            <option value="late">Til late</option>
            <option value="at">At a set time</option>
          </select>
          {t.endMode === 'at' && (
            <input
              className={styles.input + ' ' + styles.endInput}
              type="time"
              step={900}
              value={t.end}
              onChange={e => onTime({ ...t, end: e.target.value })}
              aria-label="End time"
            />
          )}
        </div>
      )}
      <Field
        label="Tagline"
        value={support}
        onChange={onSupport}
        placeholder="Grab the mic · anyone can sing"
        hint="The line under the name."
      />
      <Field label="Price line" value={tickets} onChange={onTickets} placeholder="No Cover" />
    </>
  )
}

// ── One weekly special ────────────────────────────────────────────
/**
 * Same row as a show -- name, state, hide/restore, delete -- minus
 * everything a weekly special does not have. There is deliberately no
 * SalesPanel and no "Make featured" here: weekly specials are never
 * ticketed, and featuring is for the one dated show that auto-opens.
 */
function RecurringRow({
  r, open, state, error, onToggle, onPatch, onRemove, onRefresh,
}: {
  r: AdminRecurring
  open: boolean
  state: RowState
  error: string | null
  onToggle: () => void
  onPatch: (body: Record<string, unknown>) => Promise<boolean>
  onRemove: () => void
  onRefresh: () => Promise<void>
}) {
  const [d, setD] = useState({
    name: r.name,
    support: r.support ?? '',
    tickets: r.tickets ?? '',
    sort_order: String(r.sort_order),
  })
  const [day, setDay] = useState<string>(r.day)
  const [t, setT] = useState<TimeForm>(() => timeFormFrom(r.time))
  const set = (k: keyof typeof d) => (e: { target: { value: string } }) =>
    setD(p => ({ ...p, [k]: e.target.value }))

  /**
   * Text from before the editor existed that is not in its grammar. Kept
   * as-is on save unless a start time is picked, so opening an old row
   * to fix a typo in its name cannot blank its time.
   */
  const legacy = r.time && !parseWeeklyTime(r.time) ? r.time : null
  const ready = timeReady(t)

  return (
    <section className={r.active ? styles.row : styles.rowOff}>
      {!r.active && (
        <div className={styles.hiddenStrip}>
          <span className={styles.hiddenLabel}>Hidden from the site</span>
          <button className={styles.restoreBtn} onClick={() => onPatch({ active: true })}>
            Restore
          </button>
        </div>
      )}

      <button className={styles.rowHead} onClick={onToggle} aria-expanded={open}>
        <span className={styles.rowMain}>
          <span className={styles.rowName}>{r.name}</span>
          <span className={styles.rowMeta}>
            Every {dayName(r.day)}
            {r.time ? ' · ' + r.time : ''}
          </span>
        </span>
        <span className={styles.chevron}>{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className={styles.rowBody}>
          <label className={styles.field}>
            <span className={styles.label}>Name</span>
            <input className={styles.input} value={d.name} onChange={set('name')} />
          </label>

          <DayPicker value={day} onChange={setDay} />
          <StartTimeField
            t={t}
            onChange={setT}
            hint={legacy ? 'Currently shows “' + legacy + '”. Pick a start time to change it.' : undefined}
          />
          <WeeklyDetails
            t={t}
            onTime={setT}
            support={d.support}
            tickets={d.tickets}
            onSupport={set('support')}
            onTickets={set('tickets')}
          />
          <Field
            label="Sort order"
            value={d.sort_order}
            onChange={set('sort_order')}
            hint="Only breaks a tie between two on the same day and time. Lower sorts first."
          />

          <PosterField
            eventId={r.id}
            kind="recurring"
            posterUrl={r.poster_url}
            onChange={() => void onRefresh()}
          />

          <div className={styles.rowActions}>
            <button
              className={styles.saveBtn}
              disabled={state === 'saving' || (!ready && !legacy)}
              onClick={() =>
                onPatch({
                  name: d.name,
                  day,
                  ...(ready ? { time: timeBody(t) } : {}),
                  support: d.support,
                  tickets: d.tickets,
                  sort_order: Number(d.sort_order) || 0,
                })
              }
            >
              {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Save'}
            </button>

            <button className={styles.ghostBtn} onClick={() => onPatch({ active: !r.active })}>
              {r.active ? 'Hide from site' : 'Show on site'}
            </button>

            <button className={styles.dangerBtn} onClick={onRemove}>
              Delete
            </button>
          </div>

          {error && <div className={styles.error}>{error}</div>}
        </div>
      )}
    </section>
  )
}
