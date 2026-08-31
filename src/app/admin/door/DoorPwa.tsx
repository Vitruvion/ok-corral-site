'use client'

import { useEffect } from 'react'

/**
 * Registers the door service worker.
 *
 * SCOPE IS THE WHOLE POINT, and the trailing slash is the whole trap.
 *
 * The worker is served from /admin/door/sw.js, whose DEFAULT scope is
 * '/admin/door/' — which does NOT include '/admin/door', the page it
 * exists for. Scope is a URL-prefix string compare, so with the default
 * the worker registers, reaches 'activated', and controls nothing:
 * navigator.serviceWorker.controller stays null forever and the app
 * cannot open without a network. The scope below is therefore
 * '/admin/door' with no trailing slash, which the worker's
 * Service-Worker-Allowed header permits.
 *
 * It stays narrow. okcorralsaloon.com is served through ISR, and a
 * worker handing a customer a stale homepage — or a sold-out show still
 * advertising tickets — would be a real problem. Passing the scope
 * explicitly means a future move of this file cannot silently widen it.
 */
export default function DoorPwa() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker
      .register('/admin/door/sw.js', { scope: '/admin/door' })
      .catch(err => {
        // Not fatal: the scanner works fine without it, it just is not
        // installable and has no offline shell.
        console.warn('[door] service worker registration failed', err)
      })
  }, [])

  return null
}
