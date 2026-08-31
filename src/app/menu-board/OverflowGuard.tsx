'use client'

import { useEffect, useState } from 'react'

/**
 * Catches silently clipped columns.
 *
 * The board is position:fixed with overflow:hidden, so when a column's content
 * runs past the board floor it is simply cut off — no scrollbar, no error, and
 * document.scrollHeight still reports zero overflow because there is nothing to
 * scroll. Two layout bugs have hidden behind exactly that. Now that anyone can
 * add a drink from a phone at /admin/menu, the failure is one tap away and
 * invisible to whoever caused it.
 *
 * Cheap by design: one measurement after mount, nothing else. No resize
 * listener, no polling, no MutationObserver. The 5-minute RefreshLoop reloads
 * the whole page, which remounts this and re-runs the check for free.
 *
 * In production it only warns to the console. It deliberately renders nothing
 * visible there: a warning banner on the TV, in front of customers, would be a
 * worse outcome than the clipping it is reporting.
 */

/**
 * Signatures already warned about in this page load.
 *
 * React StrictMode mounts, unmounts and remounts every component in dev, which
 * would otherwise print each warning twice and make the guard itself look like
 * it's misbehaving. Module scope is exactly the right lifetime: it outlives the
 * StrictMode double-mount and is wiped by the RefreshLoop's full page reload,
 * so a still-clipped board warns again five minutes later.
 */
const warned = new Set<string>()

type Clipped = {
  column: number
  categories: string
  overflowPx: number
  lastVisibleItem: string
  left: number
  width: number
  floor: number
}

export default function OverflowGuard() {
  const [clipped, setClipped] = useState<Clipped[]>([])

  useEffect(() => {
    // Must never throw: a guard that breaks the board is worse than the bug
    // it watches for.
    try {
      const board = document.querySelector<HTMLElement>('[data-board]')
      if (!board) return

      const boardBox = board.getBoundingClientRect()
      const padBottom = parseFloat(getComputedStyle(board).paddingBottom) || 0
      // The board's CONTENT floor, not a column's. A column is a grid item
      // that grows with its content, so measuring against the column would
      // compare the overflow to itself and always look fine.
      const floor = boardBox.bottom - padBottom

      const hits: Clipped[] = []

      board.querySelectorAll<HTMLElement>('[data-board-column]').forEach(col => {
        const descendants = Array.from(col.querySelectorAll<HTMLElement>('*'))
        if (descendants.length === 0) return

        const lowest = Math.max(...descendants.map(el => el.getBoundingClientRect().bottom))
        const overflowPx = Math.round(lowest - floor)
        if (overflowPx <= 1) return // sub-pixel rounding is not a bug

        const items = Array.from(col.querySelectorAll<HTMLElement>('[data-board-item]'))
        const visible = items.filter(el => el.getBoundingClientRect().bottom <= floor)
        const lastVisible = visible[visible.length - 1]
        const colBox = col.getBoundingClientRect()

        hits.push({
          column: Number(col.dataset.boardColumn ?? 0) + 1,
          categories:
            Array.from(col.querySelectorAll<HTMLElement>('[data-board-category]'))
              .map(el => el.dataset.boardCategory)
              .filter(Boolean)
              .join(' + ') || '(none)',
          overflowPx,
          lastVisibleItem: lastVisible?.dataset.boardItem ?? '(nothing fits)',
          left: colBox.left,
          width: colBox.width,
          floor,
        })
      })

      if (hits.length === 0) return

      for (const hit of hits) {
        const signature = `${hit.column}:${hit.overflowPx}:${hit.lastVisibleItem}`
        if (warned.has(signature)) continue
        warned.add(signature)

        console.warn(
          `[menu-board] Column ${hit.column} (${hit.categories}) overflows the board by ` +
            `${hit.overflowPx}px — content past this point is CLIPPED and invisible. ` +
            `Last item still visible: "${hit.lastVisibleItem}". ` +
            `Remove an item from this category, or shorten the board's content.`
        )
      }

      if (process.env.NODE_ENV !== 'production') setClipped(hits)
    } catch {
      // Swallowed on purpose.
    }
  }, [])

  // Production renders nothing at all, whatever was measured.
  // process.env.NODE_ENV is compared inline rather than via a hoisted
  // constant so Next's build-time literal substitution folds this to a
  // constant true and the minifier drops the marker JSX from the bundle.
  if (process.env.NODE_ENV === 'production' || clipped.length === 0) return null

  return (
    <>
      {clipped.map(hit => (
        <div
          key={hit.column}
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: hit.left,
            width: hit.width,
            top: hit.floor - 26,
            height: 26,
            zIndex: 9999,
            pointerEvents: 'none',
            background: 'rgba(255, 68, 51, 0.92)',
            color: '#fff',
            font: '600 13px/26px ui-monospace, SFMono-Regular, Menlo, monospace',
            textAlign: 'center',
            letterSpacing: '0.04em',
          }}
        >
          CLIPPED · +{hit.overflowPx}px
        </div>
      ))}
    </>
  )
}
