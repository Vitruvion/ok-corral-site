'use client'
import { useEffect, useRef, useState } from 'react'
import { BRAND, EVENTS } from '@/lib/data'
import styles from './Hero.module.css'

export default function Hero() {
  const bgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [bgFailed, setBgFailed] = useState(false)

  // Parallax
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

  // Dust particles
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

  return (
    <section className={styles.hero}>
      {bgFailed ? (
        <div className={styles.bg} aria-hidden="true" />
      ) : (
        <img
          ref={bgRef}
          className={styles.bg}
          src="/assets/gallery/storefront.jpg"
          alt=""
          aria-hidden="true"
          decoding="async"
          fetchPriority="high"
          onError={() => setBgFailed(true)}
        />
      )}
      <div className={styles.vignette} />
      <canvas className={styles.dust} ref={canvasRef} />

      <div className={styles.content}>
        <div className={styles.top}>
          <LiveBadge />
        </div>

        <div className={styles.wordmark}>
          <div className={styles.wmRuleTop}>
            <span className={styles.wmLine} />
            <span className={styles.wmKicker}>THE</span>
            <span className={styles.wmLine} />
          </div>
          <h1 className={styles.wmMain}>
            {'O.K.\u00A0CORRAL'.split('').map((ch, i) => (
              <span
                key={i}
                className={styles.heroLetter}
                style={{ animationDelay: `${120 + i * 55}ms` }}
              >
                {ch}
              </span>
            ))}
          </h1>
          <div className={styles.wmRuleBottom}>
            <span className={styles.wmLineDim} />
            <span className={styles.wmSub}>COTTONWOOD · CA · EST. 2025</span>
            <span className={styles.wmLineDim} />
          </div>
        </div>

        <div className={styles.bottom}>
          <div className={styles.tagline}>
            <em>
              A saloon for the present century.{' '}
              <span className={styles.tagEmber}>Home of the Scorpion Shot.</span>{' '}
              Cold beer, live music, and a hell of a jukebox.
            </em>
          </div>
          <div className={styles.meta}>
            <div className={styles.metaRow}>
              <span><strong>{BRAND.coords.lat}° N</strong> / {Math.abs(BRAND.coords.lon)}° W</span>
              <span><strong>Open Daily</strong> / 8 AM – 2 AM</span>
            </div>
            <div className={styles.metaActions}>
              <a href="#events" className="btn btn-primary btn-door">
                What&apos;s On <span className="arrow">→</span>
              </a>
              <a href="#merch" className="btn btn-ghost btn-door">
                Shop Merch <span className="arrow">→</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function LiveBadge() {
  const [next, setNext] = useState(EVENTS[0])

  return (
    <a href="#events" className={styles.liveBadge}>
      <span className={styles.liveDot} />
      <strong>NEXT UP</strong>
      <span className={styles.liveSep}>·</span>
      <em className={styles.liveName}>{next?.name}</em>
    </a>
  )
}
