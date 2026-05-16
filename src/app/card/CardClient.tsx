'use client'
import { useState } from 'react'
import { TIERS } from '@/lib/rewards/tiers'
import styles from './card.module.css'

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string; help?: string; missing?: string[] }

export default function CardClient() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return

    setStatus({ kind: 'submitting' })

    try {
      const res = await fetch('/api/card/pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      })

      if (!res.ok) {
        let detail: any = null
        try { detail = await res.json() } catch {}
        setStatus({
          kind: 'error',
          message: detail?.error || `Pass generation failed (${res.status}).`,
          help: detail?.help,
          missing: detail?.missing,
        })
        return
      }

      // Success → trigger download. On iOS this hands off to Wallet.
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `okcorral-rewards.pkpass`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)

      setStatus({ kind: 'success' })
    } catch (err: any) {
      setStatus({
        kind: 'error',
        message: err?.message || 'Network error.',
      })
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <span className={styles.kicker}>◆ CORRAL REWARDS</span>
        <h1 className={styles.title}>
          Earn your<br /><em>rank.</em>
        </h1>
        <p className={styles.intro}>
          Every dollar spent at the bar moves you up. Your tier lives on a digital
          card in Apple Wallet — no app, no punch card, no plastic. Just show it
          when you order.
        </p>
      </header>

      <section className={styles.section}>
        <div className={styles.tierStack}>
          {TIERS.map((t, i) => (
            <div key={t.key} className={styles.tierRow} style={{ '--accent': t.web.accent } as React.CSSProperties}>
              <div className={styles.tierBadge}>{i + 1}</div>
              <div className={styles.tierInfo}>
                <div className={styles.tierName}>{t.name}</div>
                <div className={styles.tierPerk}>{t.perk}</div>
              </div>
              <div className={styles.tierThreshold}>
                {t.minPoints === 0 ? 'START' : `${t.minPoints.toLocaleString()} pts`}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.formSection}>
        <h2 className={styles.formTitle}>
          ◆ Sign Up
        </h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="card-name">Your Name</label>
            <input
              id="card-name"
              className={styles.input}
              type="text"
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              maxLength={60}
              disabled={status.kind === 'submitting'}
              placeholder="Jane Doe"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="card-phone">Phone</label>
            <input
              id="card-phone"
              className={styles.input}
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              required
              disabled={status.kind === 'submitting'}
              placeholder="(530) 555-0142"
            />
            <span className={styles.hint}>
              Used to link your card to your tab at the bar. We won&apos;t text you.
            </span>
          </div>

          <button
            type="submit"
            className={styles.submit}
            disabled={status.kind === 'submitting' || !name.trim() || !phone.trim()}
          >
            {status.kind === 'submitting' ? 'Generating…' : 'Add to Apple Wallet →'}
          </button>

          {status.kind === 'success' && (
            <div className={styles.success}>
              <em>Pass downloaded. Open it on your iPhone to add it to Wallet.</em>
            </div>
          )}

          {status.kind === 'error' && (
            <div className={styles.error}>
              <strong>{status.message}</strong>
              {status.help && <div className={styles.errorHelp}>{status.help}</div>}
              {status.missing && status.missing.length > 0 && (
                <ul className={styles.errorList}>
                  {status.missing.map(m => <li key={m}><code>{m}</code></li>)}
                </ul>
              )}
            </div>
          )}
        </form>
      </section>

      <footer className={styles.foot}>
        <span>◆ Phase 1 preview · Updates roll in when you pay at the bar</span>
      </footer>
    </main>
  )
}
