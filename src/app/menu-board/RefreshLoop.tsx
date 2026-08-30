'use client'

import { useEffect } from 'react'

/**
 * Kiosk refresh.
 *
 * `revalidate` only controls how stale Next's cached render may be — it does
 * nothing on its own for a TV that loaded this page days ago and never
 * navigates. This reloads the window on an interval so the panel actually
 * re-fetches and picks up menu edits.
 *
 * Renders nothing.
 */
export default function RefreshLoop({ intervalMs = 5 * 60 * 1000 }: { intervalMs?: number }) {
  useEffect(() => {
    const id = setInterval(() => {
      window.location.reload()
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return null
}
