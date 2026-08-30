'use client'

import { useMemo, useState } from 'react'
import type { AdminDrink } from '@/lib/admin/drinks-repo'
import styles from './menu.module.css'

/**
 * Phone-first menu editor.
 *
 * Used one-handed behind a bar, often in low light, sometimes by whoever is
 * closest to the phone. So: per-row saves rather than one giant form, an
 * explicit state badge on every row so there's never a question of whether
 * something stuck, buttons instead of drag for reordering, and categories
 * collapsed by default so the list isn't an endless scroll.
 */

type RowState = 'idle' | 'saving' | 'saved' | 'error'

type Draft = {
  name: string
  price: string
  tagline: string
  description: string
  category: string
  active: boolean
}

const draftOf = (d: AdminDrink): Draft => ({
  name: d.name,
  price: d.price,
  tagline: d.tagline ?? '',
  description: d.description ?? '',
  category: d.category,
  active: d.active,
})

const dirty = (a: Draft, b: Draft) =>
  a.name !== b.name ||
  a.price !== b.price ||
  a.tagline !== b.tagline ||
  a.description !== b.description ||
  a.category !== b.category ||
  a.active !== b.active

export default function MenuEditor({ initialDrinks }: { initialDrinks: AdminDrink[] }) {
  const [drinks, setDrinks] = useState<AdminDrink[]>(initialDrinks)
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(initialDrinks.map(d => [d.id, draftOf(d)]))
  )
  const [state, setState] = useState<Record<string, RowState>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [adding, setAdding] = useState(false)

  const categories = useMemo(() => {
    const map = new Map<string, AdminDrink[]>()
    for (const d of drinks) {
      if (!map.has(d.category)) map.set(d.category, [])
      map.get(d.category)!.push(d)
    }
    for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order)
    return [...map.entries()]
  }, [drinks])

  const setRow = (id: string, s: RowState, message = '') => {
    setState(prev => ({ ...prev, [id]: s }))
    setErrors(prev => ({ ...prev, [id]: message }))
    // Let a success tick linger long enough to be believed, then clear it.
    if (s === 'saved') {
      setTimeout(() => {
        setState(prev => (prev[id] === 'saved' ? { ...prev, [id]: 'idle' } : prev))
      }, 2500)
    }
  }

  const patch = async (id: string) => {
    const draft = drafts[id]
    if (!draft) return
    setRow(id, 'saving')
    try {
      const res = await fetch('/api/admin/drinks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: draft.name,
          price: draft.price,
          category: draft.category,
          tagline: draft.tagline,
          description: draft.description,
          active: draft.active,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || `Save failed (${res.status}).`)
      setDrinks(prev => prev.map(d => (d.id === id ? json.drink : d)))
      setDrafts(prev => ({ ...prev, [id]: draftOf(json.drink) }))
      setRow(id, 'saved')
    } catch (err: any) {
      setRow(id, 'error', err?.message || 'Save failed.')
    }
  }

  const toggleActive = async (d: AdminDrink) => {
    const next = !drafts[d.id]?.active
    setDrafts(prev => ({ ...prev, [d.id]: { ...prev[d.id], active: next } }))
    setRow(d.id, 'saving')
    try {
      const res = await fetch('/api/admin/drinks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: d.id, active: next }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || `Save failed (${res.status}).`)
      setDrinks(prev => prev.map(x => (x.id === d.id ? json.drink : x)))
      setRow(d.id, 'saved')
    } catch (err: any) {
      // Put the toggle back where it was so the UI never lies about state.
      setDrafts(prev => ({ ...prev, [d.id]: { ...prev[d.id], active: !next } }))
      setRow(d.id, 'error', err?.message || 'Save failed.')
    }
  }

  const move = async (d: AdminDrink, direction: 'up' | 'down') => {
    setRow(d.id, 'saving')
    try {
      const res = await fetch('/api/admin/drinks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: d.id, direction }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || `Move failed (${res.status}).`)

      if (json.moved) {
        // Swap locally rather than refetching — instant on a slow connection.
        setDrinks(prev => {
          const same = prev.filter(x => x.category === d.category).sort((a, b) => a.sort_order - b.sort_order)
          const i = same.findIndex(x => x.id === d.id)
          const j = direction === 'up' ? i - 1 : i + 1
          if (i < 0 || j < 0 || j >= same.length) return prev
          const a = same[i], b = same[j]
          return prev.map(x =>
            x.id === a.id ? { ...x, sort_order: b.sort_order }
            : x.id === b.id ? { ...x, sort_order: a.sort_order }
            : x
          )
        })
      }
      setRow(d.id, json.moved ? 'saved' : 'idle')
    } catch (err: any) {
      setRow(d.id, 'error', err?.message || 'Move failed.')
    }
  }

  const addDrink = async (category: string) => {
    setAdding(true)
    try {
      const res = await fetch('/api/admin/drinks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New drink', price: '$0', category }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'Could not add.')
      setDrinks(prev => [...prev, json.drink])
      setDrafts(prev => ({ ...prev, [json.drink.id]: draftOf(json.drink) }))
      setOpen(prev => ({ ...prev, [category]: true }))
    } catch (err: any) {
      window.alert(err?.message || 'Could not add the drink.')
    } finally {
      setAdding(false)
    }
  }

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' })
    window.location.href = '/admin/login'
  }

  return (
    <div className={styles.editor}>
      {categories.map(([category, list]) => {
        const isOpen = open[category] ?? false
        const liveCount = list.filter(d => d.active).length
        return (
          <section key={category} className={styles.category}>
            <button
              className={styles.categoryToggle}
              onClick={() => setOpen(prev => ({ ...prev, [category]: !isOpen }))}
              aria-expanded={isOpen}
            >
              <span className={styles.categoryName}>{category}</span>
              <span className={styles.categoryCount}>
                {liveCount}/{list.length} live
              </span>
              <span className={styles.chevron}>{isOpen ? '−' : '+'}</span>
            </button>

            {isOpen && (
              <div className={styles.rows}>
                {list.map((d, i) => {
                  const draft = drafts[d.id] ?? draftOf(d)
                  const rowState = state[d.id] ?? 'idle'
                  const changed = dirty(draft, draftOf(d))
                  return (
                    <div
                      key={d.id}
                      className={`${styles.row} ${draft.active ? '' : styles.rowOff}`}
                    >
                      <div className={styles.rowTop}>
                        <input
                          className={styles.inputName}
                          value={draft.name}
                          onChange={e =>
                            setDrafts(p => ({ ...p, [d.id]: { ...draft, name: e.target.value } }))
                          }
                          aria-label="Drink name"
                        />
                        <input
                          className={styles.inputPrice}
                          value={draft.price}
                          onChange={e =>
                            setDrafts(p => ({ ...p, [d.id]: { ...draft, price: e.target.value } }))
                          }
                          aria-label="Price"
                        />
                      </div>

                      <input
                        className={styles.input}
                        value={draft.tagline}
                        placeholder="Tagline (shown under the name)"
                        onChange={e =>
                          setDrafts(p => ({ ...p, [d.id]: { ...draft, tagline: e.target.value } }))
                        }
                        aria-label="Tagline"
                      />

                      <textarea
                        className={styles.textarea}
                        value={draft.description}
                        placeholder="Description"
                        rows={3}
                        onChange={e =>
                          setDrafts(p => ({ ...p, [d.id]: { ...draft, description: e.target.value } }))
                        }
                        aria-label="Description"
                      />

                      <input
                        className={styles.input}
                        value={draft.category}
                        onChange={e =>
                          setDrafts(p => ({ ...p, [d.id]: { ...draft, category: e.target.value } }))
                        }
                        aria-label="Category"
                      />

                      <div className={styles.rowActions}>
                        <button
                          className={styles.moveBtn}
                          onClick={() => move(d, 'up')}
                          disabled={i === 0 || rowState === 'saving'}
                          aria-label="Move up"
                        >↑</button>
                        <button
                          className={styles.moveBtn}
                          onClick={() => move(d, 'down')}
                          disabled={i === list.length - 1 || rowState === 'saving'}
                          aria-label="Move down"
                        >↓</button>

                        <button
                          className={`${styles.toggle} ${draft.active ? styles.toggleOn : ''}`}
                          onClick={() => toggleActive(d)}
                          disabled={rowState === 'saving'}
                        >
                          {draft.active ? 'On menu' : 'Hidden'}
                        </button>

                        <button
                          className={styles.saveBtn}
                          onClick={() => patch(d.id)}
                          disabled={rowState === 'saving' || !changed}
                        >
                          {rowState === 'saving' ? 'Saving…' : changed ? 'Save' : 'Saved'}
                        </button>
                      </div>

                      <div className={styles.rowStatus} role="status" aria-live="polite">
                        {rowState === 'saved' && <span className={styles.ok}>✓ Saved</span>}
                        {rowState === 'saving' && <span className={styles.pending}>Saving…</span>}
                        {rowState === 'error' && (
                          <span className={styles.bad}>✕ {errors[d.id] || 'Save failed.'}</span>
                        )}
                        {rowState === 'idle' && changed && (
                          <span className={styles.pending}>Unsaved changes</span>
                        )}
                      </div>
                    </div>
                  )
                })}

                <button
                  className={styles.addBtn}
                  onClick={() => addDrink(category)}
                  disabled={adding}
                >
                  + Add drink to {category}
                </button>
              </div>
            )}
          </section>
        )
      })}

      <button className={styles.logout} onClick={logout}>Sign out</button>
    </div>
  )
}
