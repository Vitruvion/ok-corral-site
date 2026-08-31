'use client'

import { useEffect } from 'react'

/**
 * Registers the door service worker.
 *
 * SCOPE IS THE WHOLE POINT. The worker is served from
 * /admin/door/sw.js, so its default scope is /admin/door/ and it can
 * never see — let alone cache — a request for the public site.
 * okcorralsaloon.com is served through ISR, and a service worker
 * handing a customer a stale homepage or a sold-out show that still
 * says "Get Tickets" would be a real problem. The registration passes
 * the scope explicitly as well, so a future move of this file cannot
 * silently widen it.
 */
export default function DoorPwa() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/admin/door/sw.js', { scope: '/admin/door/' })
      .catch(err => {
        // Not fatal: the scanner works fine without it, it just is not
        // installable and has no offline shell.
        console.warn('[door] service worker registration failed', err)
      })
  }, [])

  return null
}
