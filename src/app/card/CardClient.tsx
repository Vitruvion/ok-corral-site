'use client'
import { useEffect, useRef, useState } from 'react'
import Topbar from '@/components/Topbar'
import Footer from '@/components/Footer'
import PassMockup from '@/components/PassMockup'
import CardDebugOverlay from '@/components/CardDebugOverlay'
import { CartProvider } from '@/lib/cart'
import { TIERS, type TierKey } from '@/lib/rewards/tiers'
import styles from './card.module.css'

type Status =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error'; message: string; help?: string; missing?: string[] }

export default function CardClient() {
  // Topbar reaches for useCart() so the whole tree needs a CartProvider in
  // scope even though merch is hidden right now and the cart never opens
  // here. Wrapping the page is the least-invasive way to keep Topbar
  // shared between this route and the homepage without refactoring it.
  return (
    <CartProvider>
      <CardClientInner />
    </CartProvider>
  )
}

function CardClientInner() {
  // ─── Pass mockup tier preview ─────────────────────────────────
  const [previewKey, setPreviewKey] = useState<TierKey>('newcomer')

  // ─── Form state (logic preserved verbatim from Phase 1) ───────
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

  // ─── Sticky mobile CTA: hide when the form scrolls into view ──
  const formRef = useRef<HTMLDivElement>(null)
  const [formInView, setFormInView] = useState(false)

  useEffect(() => {
    const el = formRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setFormInView(entry.isIntersecting),
      { threshold: 0.1, rootMargin: '-80px 0px 0px 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ─── Hero background parallax (mirrors Hero.tsx exactly) ──────
  const bgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const onScroll = () => {
      if (bgRef.current) {
        const y = window.scrollY
        bgRef.current.style.transform = `translateY(${y * 0.35}px) scale(${1 + y * 0.0004})`
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // ─── Hero dust particles (mirrors Hero.tsx exactly) ───────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    let w = 0, h = 0
    const particles: { x: number; y: number; r: number; vx: number; vy: number; phase: number }[] = []

    const resize = () => {
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.scale(dpr, dpr)
    }

    const init = () => {
      resize()
      for (let i = 0; i < 40; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: (0.4 + Math.random() * 1.4) * dpr,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.2,
          phase: Math.random() * Math.PI * 2,
        })
      }
    }

    let raf: number
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = w
        if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h
        if (p.y > h) p.y = 0
        const alpha = 0.15 + 0.15 * Math.sin(t * 0.001 + p.phase)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r / dpr, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(235,228,212,${alpha})`
        ctx.fill()
      }
      raf = requestAnimationFrame(draw)
    }

    init()
    raf = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const [bgFailed, setBgFailed] = useState(false)

  return (
    <>
      <Topbar />
      <CardDebugOverlay />

      <main className={styles.page}>
        {/* ═══ HERO ═══════════════════════════════════════════ */}
        <section className={styles.hero}>
          {bgFailed ? (
            <div className={styles.bg} aria-hidden="true" />
          ) : (
            <img
              ref={bgRef}
              className={styles.bg}
              src="/assets/gallery/cowboy-bar.jpg"
              alt=""
              aria-hidden="true"
              decoding="async"
              fetchPriority="high"
              onError={() => setBgFailed(true)}
            />
          )}
          <div className={styles.vignette} />
          <canvas className={styles.dust} ref={canvasRef} />

          <div className={styles.heroContent}>
            <div className={styles.heroCopy}>
              <div className={styles.kickerRule}>
                <span className={styles.kickerLine} />
                <span className={styles.kickerText}>◆ CORRAL REWARDS ◆</span>
                <span className={styles.kickerLine} />
              </div>
              <h1 className={styles.heroTitle}>
                Earn your<br /><em>rank.</em>
              </h1>
              <p className={styles.heroIntro}>
                <em>
                  Five tiers, Newcomer to One of Ours. Pay with the card or just
                  give your phone number — points roll in automatically. Bring a
                  friend with the QR on your pass and you&apos;ll move up faster.
                </em>
              </p>
              <div className={styles.heroCtas}>
                <a href="#form" className="btn btn-primary btn-door">
                  Get Your Card <span className="arrow">→</span>
                </a>
                <a href="#how" className="btn btn-ghost btn-door">
                  How It Works <span className="arrow">→</span>
                </a>
              </div>
            </div>

            <div className={styles.heroPass}>
              <PassMockup tierKey={previewKey} />
              <div className={styles.chips} role="tablist" aria-label="Preview a tier">
                {TIERS.map(t => {
                  const active = t.key === previewKey
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setPreviewKey(t.key)}
                      className={`${styles.chip} ${active ? styles.chipActive : ''}`}
                      style={{ '--chip-accent': t.web.accent } as React.CSSProperties}
                    >
                      {t.name}
                    </button>
                  )
                })}
              </div>
              <span className={styles.chipsHint}>
                <em>Tap a rank to preview · click the card to flip</em>
              </span>
            </div>
          </div>
        </section>

        {/* ═══ RANKS LADDER ═══════════════════════════════════ */}
        <section className={styles.section} id="ranks">
          <div className={styles.container}>
            <div className={styles.sectionHead}>
              <div>
                <span className="section-label">02 · The Climb</span>
                <h2 className={styles.sectionTitle}>
                  Five ranks,<br /><em>five reasons to stay.</em>
                </h2>
              </div>
              <p className={styles.sectionIntro}>
                <em>
                  Start at Newcomer. Tip well, drink slow, come back often.
                  Your rank lives on the card and updates as you go.
                </em>
              </p>
            </div>

            <ol className={styles.ladder}>
              <div className={styles.ladderRail} aria-hidden="true" />
              {TIERS.map((t, i) => (
                <li
                  key={t.key}
                  className={styles.rung}
                  style={{
                    '--rung-accent': t.web.accent,
                    '--rung-glow': t.web.glow ?? 'transparent',
                    animationDelay: `${i * 90}ms`,
                  } as React.CSSProperties}
                >
                  <div className={styles.rungBadge}>{String(i + 1).padStart(2, '0')}</div>
                  <div className={styles.rungInfo}>
                    <div className={styles.rungName}>{t.name}</div>
                    <div className={styles.rungPerk}>{t.perk}</div>
                  </div>
                  <div className={styles.rungThreshold}>
                    {t.minPoints === 0 ? (
                      <>
                        <span className={styles.rungThresholdLabel}>START</span>
                        <span className={styles.rungThresholdValue}>0 pts</span>
                      </>
                    ) : (
                      <>
                        <span className={styles.rungThresholdLabel}>AT</span>
                        <span className={styles.rungThresholdValue}>{t.minPoints.toLocaleString()} pts</span>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══════════════════════════════════ */}
        <section className={styles.section} id="how">
          <div className={styles.container}>
            <div className={styles.sectionHead}>
              <div>
                <span className="section-label">03 · How It Works</span>
                <h2 className={styles.sectionTitle}>
                  Simple as<br /><em>a handshake.</em>
                </h2>
              </div>
              <p className={styles.sectionIntro}>
                <em>
                  No app to download. No plastic to lose. The whole thing
                  takes about a minute from QR scan to wallet card.
                </em>
              </p>
            </div>

            <div className={styles.steps}>
              <div className={styles.step}>
                <span className={styles.stepNum}>01</span>
                <h3 className={styles.stepTitle}>Sign Up</h3>
                <p className={styles.stepBody}>
                  <em>
                    Name and phone — that&apos;s it. We use the number to link your
                    card to your tab. No texts, no marketing list.
                  </em>
                </p>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNum}>02</span>
                <h3 className={styles.stepTitle}>Add to Wallet</h3>
                <p className={styles.stepBody}>
                  <em>
                    One tap and the card lives in Apple Wallet next to your
                    boarding passes. Lock-screen access, updates over the air.
                  </em>
                </p>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNum}>03</span>
                <h3 className={styles.stepTitle}>Earn Points</h3>
                <p className={styles.stepBody}>
                  <em>
                    Pay with the card on your Wallet, or give the bartender your
                    phone number at checkout. Points hit your tier automatically
                    — no scanning required.
                  </em>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ SIGN-UP FORM ═══════════════════════════════════ */}
        <section className={styles.section} id="form" ref={formRef}>
          <div className={styles.container}>
            <div className={styles.formCard}>
              <div className={styles.formCorners} aria-hidden="true">
                <span className={styles.cornerTL} />
                <span className={styles.cornerTR} />
                <span className={styles.cornerBL} />
                <span className={styles.cornerBR} />
              </div>

              <div className={styles.formHead}>
                <span className={styles.formKicker}>◆ SIGN UP</span>
                <h2 className={styles.formTitle}>
                  Get your<br /><em>card.</em>
                </h2>
                <p className={styles.formIntro}>
                  <em>Name and phone. Pass goes straight to Wallet.</em>
                </p>
              </div>

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor="card-name">Your Name</label>
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
                  <label className={styles.fieldLabel} htmlFor="card-phone">Phone</label>
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
                  <span className={styles.fieldHint}>
                    <em>Used to link your card to your tab. We won&apos;t text you.</em>
                  </span>
                </div>

                <button
                  type="submit"
                  className={styles.submit}
                  disabled={status.kind === 'submitting' || !name.trim() || !phone.trim()}
                >
                  {status.kind === 'submitting' ? 'GENERATING…' : 'ADD TO APPLE WALLET →'}
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
            </div>
          </div>
        </section>
      </main>

      {/* ═══ STICKY MOBILE CTA ═════════════════════════════════ */}
      <div
        className={`${styles.stickyMobile} ${formInView ? styles.stickyHidden : ''}`}
        aria-hidden={formInView}
      >
        <a href="#form" className={styles.stickyBtn}>
          Add to Apple Wallet <span className={styles.stickyArrow}>→</span>
        </a>
      </div>

      <Footer />
    </>
  )
}
