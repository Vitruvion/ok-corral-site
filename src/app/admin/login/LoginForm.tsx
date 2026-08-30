'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

      // Only ever follow a same-site path, so ?next= can't be used to bounce
      // someone off to another host after a successful login.
      const next = params.get('next')
      const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/admin/menu'
      router.replace(dest)
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
