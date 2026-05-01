'use client'
import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setLines(JSON.parse(raw))
    } catch {}
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lines)) } catch {}
  }, [lines, hydrated])

  const value = useMemo<CartCtx>(() => ({
    lines,
    count: lines.reduce((n, l) => n + l.qty, 0),
    subtotal: lines.reduce((s, l) => s + l.price * l.qty, 0),
    open,
    setOpen,
    addItem: (item, size) => {
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
    clear: () => setLines([]),
  }), [lines, open])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useCart must be used inside CartProvider')
  return c
}

export const lineKeyOf = lineKey
