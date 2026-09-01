'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { canAccess, isRole } from '@/lib/admin/roles'
import styles from './login.module.css'

export default function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy || !passcode) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(json?.error || 'Could not sign in.')

      // Where this role lands with no ?next=: the dashboard for an
      // admin, the scanner for the door. The server decides it, because
      // the server is what knows which passcode was typed.
      const home: string = typeof json?.home === 'string' ? json.home : '/admin'

      // Only ever follow a same-site path, so ?next= can't be used to bounce
      // someone off to another host after a successful login -- and only one
      // this role may actually open, so a door person who tapped a link to
      // the menu editor lands on the scanner rather than on a redirect.
      const next = params.get('next')
      const sameSite = !!next && next.startsWith('/') && !next.startsWith('//')
      const allowed =
        sameSite && isRole(json?.role) && canAccess(json.role, next!.split('?')[0])

      router.replace(allowed ? next! : home)
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Could not sign in.')
      setBusy(false)
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <label className={styles.label} htmlFor="passcode">Passcode</label>
      <input
        id="passcode"
        className={styles.input}
        type="password"
        inputMode="text"
        autoComplete="current-password"
        autoFocus
        value={passcode}
        onChange={e => setPasscode(e.target.value)}
        disabled={busy}
      />
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.button} type="submit" disabled={busy || !passcode}>
        {busy ? 'Checking…' : 'Enter'}
      </button>
    </form>
  )
}
