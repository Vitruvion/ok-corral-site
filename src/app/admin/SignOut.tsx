'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './dashboard.module.css'

/**
 * Sign out.
 *
 * Same POST as the one in the menu editor, which until now was the only
 * way off a phone. Uses replace(), not push(), so Back can't land on a
 * rendered admin page from the bfcache after the cookie is gone.
 */
export default function SignOut() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const signOut = async () => {
    if (busy) return
    setBusy(true)
    try {
      await fetch('/api/admin/logout', { method: 'POST' })
    } finally {
      router.replace('/admin/login')
      router.refresh()
    }
  }

  return (
    <button className={styles.signOut} onClick={signOut} disabled={busy}>
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
