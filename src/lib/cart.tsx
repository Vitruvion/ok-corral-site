'use client'
import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react'
import type { MerchItem } from './data'

export type CartLine = {
  id: string
  name: string
  price: number
  size?: string
  color?: string
  image?: string
  imageBg?: 'bone'
  qty: number
}

type CartCtx = {
  lines: CartLine[]
  count: number
  subtotal: number
  open: boolean
  setOpen: (v: boolean) => void
  addItem: (item: MerchItem, size?: string) => void
  removeLine: (key: string) => void
  setQty: (key: string, qty: number) => void
  /** Empty the cart (used after a successful Stripe checkout). */
  clear: () => void
}

const Ctx = createContext<CartCtx | null>(null)
const STORAGE_KEY = 'okcorral_cart_v1'

const lineKey = (l: { id: string; size?: string }) => `${l.id}::${l.size ?? ''}`

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [open, setOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  // Sentinel: true once a clear() has wiped the cart. The hydration effect
  // honors it so it doesn't refill from localStorage. The persist effect
  // honors it so it doesn't immediately re-write an empty array.
  // (Reset on next addItem.)
  const clearedRef = useRef(false)

  useEffect(() => {
    if (clearedRef.current) {
      // A clear() ran before hydration finished (typical on Stripe-success
      // landing where StripeReturnHandler.useEffect fires before this one).
      // Skip the localStorage read so we don't refill the cart we just
      // intentionally emptied.
      setHydrated(true)
      return
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setLines(JSON.parse(raw))
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (clearedRef.current) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)) } catch {}
  }, [lines, hydrated])

  const value = useMemo<CartCtx>(() => ({
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    subtotal: lines.reduce((s, l) => s + l.price * l.qty, 0),
    open,
    setOpen,
    addItem: (item, size) => {
      // Re-engage persistence on the next add after a clear.
      clearedRef.current = false
      const chosenSize = size ?? (item.sizes?.[0] || undefined)
      const key = lineKey({ id: item.id, size: chosenSize })
      setLines(prev => {
        const idx = prev.findIndex(l => lineKey(l) === key)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
          return next
        }
        return [
          ...prev,
          {
            id: item.id,
            name: item.name,
            price: item.price,
            size: chosenSize,
            color: item.color,
            image: item.image,
            imageBg: item.imageBg,
            qty: 1,
          },
        ]
      })
      setOpen(true)
    },
    removeLine: (key) => setLines(prev => prev.filter(l => lineKey(l) !== key)),
    setQty: (key, qty) => setLines(prev => {
      if (qty <= 0) return prev.filter(l => lineKey(l) !== key)
      return prev.map(l => lineKey(l) === key ? { ...l, qty } : l)
    }),
    clear: () => {
      // Three things, in order, to defeat the React effect-ordering race:
      //  1. Mark the sentinel so subsequent hydration/persist effects skip.
      //  2. Wipe localStorage synchronously so even if hydration runs
      //     after this in the same commit, getItem() returns null.
      //  3. Empty the in-memory state.
      clearedRef.current = true
      try { localStorage.removeItem(STORAGE_KEY) } catch {}
      setLines([])
      setOpen(false)
    },
  }), [lines, open])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCart must be used inside CartProvider')
  return c
}

export const lineKeyOf = lineKey
