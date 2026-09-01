'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './login.module.css'

/**
 * Shown only when whoever loaded this page already holds a session.
 *
 * The case that needs it: a DOOR cookie. Every other admin URL bounces
 * that session back to /admin/door, so without this the only ways out
 * are clearing site data or knowing to POST /api/admin/logout. The
 * login page is the one admin screen middleware lets an unauthorised
 * role reach, which makes it the right place for the escape hatch.
 *
 * No confirmation here, unlike the door's own control -- this screen is
 * not being used with a line waiting, and nothing on this device can be
 * stranded by signing out from it.
 */
export default function SignedInNotice({ role }: { role: 'admin' | 'door' }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const signOut = async () => {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } catch {
      // Nothing useful to say: the page reload below shows the truth.
    }
    router.refresh()
    setBusy(false)
  }

  return (
    <p className={styles.signedIn}>
      Already signed in as <strong>{role === 'door' ? 'the door' : 'admin'}</strong>.{' '}
      <button className={styles.signedInBtn} onClick={signOut} disabled={busy}>
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
    </p>
  )
}
