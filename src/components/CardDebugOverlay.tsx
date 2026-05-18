'use client'

/**
 * /card debug overlay — renders a fixed panel at the top of the
 * page when the URL contains `?debug=1`, otherwise renders nothing.
 *
 * Purpose: capture the actual computed state of the three known
 * mobile-only bug zones (flip backface, QR layout, How It Works
 * section) from a real device. Brady opens the URL on his iPhone,
 * screenshots the panel, shares back. No fixes ship in this commit.
 *
 * Polls the DOM every 500ms via setInterval. CSS-module class
 * names are hashed at build time, so we match on substring
 * (e.g. `[class*="face__"]`) rather than literal class names.
 */

import { useEffect, useState } from 'react'

// ─── Types ───────────────────────────────────────────────
type CSMap = Record<string, string>
type Rect = { top: number; height: number; width: number } | null

type Snapshot = {
  flip: {
    found: boolean
    cardRect: Rect
    cardCS: CSMap
    isFlipped: boolean
    frontCS: CSMap
    frontRect: Rect
    backCS: CSMap
    backRect: Rect
  }
  ladder: {
    found: boolean
    rect: Rect
    cs: CSMap
    childCount: number
    rungs: Array<{ rect: Rect; cs: CSMap }>
  }
  how: {
    found: boolean
    sectionRect: Rect
    sectionCS: CSMap
    stepsRect: Rect
    stepsCS: CSMap
    stepsChildCount: number
    stepCards: Array<{ rect: Rect; cs: CSMap }>
  }
  global: {
    hoverHover: boolean
    reducedMotion: boolean
    vw: number
    vh: number
    ua: string
  }
}

// ─── DOM readers ─────────────────────────────────────────
function rect(el: Element | null | undefined): Rect {
  if (!el) return null
  const r = (el as HTMLElement).getBoundingClientRect()
  return { top: Math.round(r.top), height: Math.round(r.height), width: Math.round(r.width) }
}

function pick(el: Element | null | undefined, props: string[]): CSMap {
  const out: CSMap = {}
  if (!el) return out
  const cs = getComputedStyle(el as HTMLElement) as any
  for (const p of props) out[p] = String(cs[p] ?? '')
  return out
}

function readSnapshot(): Snapshot {
  // Pass mockup
  const card = document.querySelector('button[aria-label*="pass mockup"]')
  const front = card?.querySelector('[class*="face__"]:not([class*="faceBack"])') ?? null
  const back = card?.querySelector('[class*="faceBack"]') ?? null
  const isFlipped = !!card && /cardFlipped/.test((card as HTMLElement).className)

  // Ranks ladder — id="ranks" then <ol> inside
  const ranksSection = document.getElementById('ranks')
  const ladder = ranksSection?.querySelector('ol') ?? null
  const rungs = ladder ? Array.from(ladder.children) : []

  // How It Works — id="how" (NOT "how-it-works" as some specs say)
  const how = document.getElementById('how') ?? document.getElementById('how-it-works')
  const stepsContainer = how?.querySelector('[class*="steps__"]') ?? null
  const stepCards = stepsContainer ? Array.from(stepsContainer.children) : []

  return {
    flip: {
      found: !!(card && front && back),
      cardRect: rect(card),
      cardCS: pick(card, ['transform', 'transformStyle', 'webkitTransformStyle', 'backfaceVisibility', 'webkitBackfaceVisibility']),
      isFlipped,
      frontCS: pick(front, ['transform', 'webkitTransform', 'backfaceVisibility', 'webkitBackfaceVisibility', 'zIndex']),
      frontRect: rect(front),
      backCS: pick(back, ['transform', 'webkitTransform', 'backfaceVisibility', 'webkitBackfaceVisibility', 'zIndex']),
      backRect: rect(back),
    },
    ladder: {
      found: !!ladder,
      rect: rect(ladder),
      cs: pick(ladder, ['opacity', 'transform', 'display']),
      childCount: ladder?.children.length ?? 0,
      rungs: rungs.map(r => ({
        rect: rect(r),
        cs: pick(r, ['opacity', 'transform', 'animationName', 'animationDelay', 'animationFillMode', 'animationPlayState']),
      })),
    },
    how: {
      found: !!how,
      sectionRect: rect(how),
      sectionCS: pick(how, ['opacity', 'transform', 'display', 'visibility']),
      stepsRect: rect(stepsContainer),
      stepsCS: pick(stepsContainer, ['opacity', 'transform', 'display']),
      stepsChildCount: stepsContainer?.children.length ?? 0,
      stepCards: stepCards.map(c => ({
        rect: rect(c),
        cs: pick(c, ['opacity', 'transform', 'display', 'visibility', 'background']),
      })),
    },
    global: {
      hoverHover: window.matchMedia('(hover: hover)').matches,
      reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      vw: document.documentElement.clientWidth,
      vh: document.documentElement.clientHeight,
      ua: navigator.userAgent.slice(0, 80),
    },
  }
}

// ─── Rendering ───────────────────────────────────────────
/** A value worth highlighting in red — usually invisibility signals. */
function isBad(key: string, val: string): boolean {
  if (key === 'opacity' && val === '0') return true
  if (key === 'display' && val === 'none') return true
  if (key === 'visibility' && val === 'hidden') return true
  return false
}

function Val({ k, v }: { k: string; v: string }) {
  if (isBad(k, v)) {
    return <span style={{ color: '#ff5757', fontWeight: 700 }}>{v}</span>
  }
  return <>{v}</>
}

function CSLines({ cs }: { cs: CSMap }) {
  const entries = Object.entries(cs)
  if (entries.length === 0) return null
  return (
    <>
      {entries.map(([k, v]) => (
        <div key={k} style={{ paddingLeft: 8 }}>
          {k}: <Val k={k} v={v} />
        </div>
      ))}
    </>
  )
}

function RectLine({ r, label = 'rect' }: { r: Rect; label?: string }) {
  if (!r) return <div style={{ paddingLeft: 8, color: '#ff5757' }}>{label}: null</div>
  const bad = r.height === 0
  return (
    <div style={{ paddingLeft: 8 }}>
      {label}: top={r.top} {bad ? <span style={{ color: '#ff5757', fontWeight: 700 }}>h={r.height}</span> : `h=${r.height}`} w={r.width}
    </div>
  )
}

function Header({ children }: { children: React.ReactNode }) {
  return <div style={{ color: 'orange', fontWeight: 700, marginTop: 6 }}>━━ {children} ━━</div>
}

// ─── Component ───────────────────────────────────────────
export default function CardDebugOverlay() {
  const [enabled, setEnabled] = useState(false)
  const [data, setData] = useState<Snapshot | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    if (params.get('debug') !== '1') return
    setEnabled(true)

    const tick = () => {
      try { setData(readSnapshot()) } catch (e) { /* swallow — DOM may be mid-mount */ }
    }
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [])

  if (!enabled) return null

  const handleFlip = () => {
    const cardBtn = document.querySelector('button[aria-label*="pass mockup"]') as HTMLButtonElement | null
    cardBtn?.click()
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 8,
        left: 8,
        right: 8,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.85)',
        border: '1px solid orange',
        padding: 8,
        fontFamily: 'monospace',
        fontSize: 10,
        color: 'white',
        maxHeight: '50vh',
        overflow: 'auto',
        lineHeight: 1.3,
        // iOS Safari sometimes drops fixed elements behind content; this
        // makes the panel a stacking context of its own.
        isolation: 'isolate',
      }}
      role="region"
      aria-label="Card debug overlay"
    >
      <button
        onClick={handleFlip}
        style={{
          background: 'orange',
          color: 'black',
          border: 0,
          padding: '4px 10px',
          fontFamily: 'monospace',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: 6,
          borderRadius: 2,
        }}
      >
        Flip Now
      </button>

      {!data ? (
        <div>collecting…</div>
      ) : (
        <>
          {/* FLIP */}
          <Header>FLIP</Header>
          {!data.flip.found ? (
            <div style={{ color: '#ff5757' }}>pass mockup not found</div>
          ) : (
            <>
              <div>isFlipped: <Val k="isFlipped" v={String(data.flip.isFlipped)} /></div>
              <div>card:</div>
              <RectLine r={data.flip.cardRect} />
              <CSLines cs={data.flip.cardCS} />
              <div>front:</div>
              <RectLine r={data.flip.frontRect} />
              <CSLines cs={data.flip.frontCS} />
              <div>back:</div>
              <RectLine r={data.flip.backRect} />
              <CSLines cs={data.flip.backCS} />
            </>
          )}

          {/* LADDER */}
          <Header>LADDER</Header>
          {!data.ladder.found ? (
            <div style={{ color: '#ff5757' }}>ladder ol not found</div>
          ) : (
            <>
              <div>ol:</div>
              <RectLine r={data.ladder.rect} />
              <CSLines cs={data.ladder.cs} />
              <div>
                children: {data.ladder.childCount === 5 ? '5' : <span style={{ color: '#ff5757' }}>{data.ladder.childCount}</span>}
              </div>
              {data.ladder.rungs.map((r, i) => (
                <div key={i}>
                  <div>rung[{i}]:</div>
                  <RectLine r={r.rect} />
                  <CSLines cs={r.cs} />
                </div>
              ))}
            </>
          )}

          {/* HOWITWORKS */}
          <Header>HOWITWORKS</Header>
          {!data.how.found ? (
            <div style={{ color: '#ff5757' }}>section not found</div>
          ) : (
            <>
              <div>section:</div>
              <RectLine r={data.how.sectionRect} />
              <CSLines cs={data.how.sectionCS} />
              <div>steps container:</div>
              <RectLine r={data.how.stepsRect} />
              <CSLines cs={data.how.stepsCS} />
              <div>
                children: {data.how.stepsChildCount === 3 ? '3' : <span style={{ color: '#ff5757' }}>{data.how.stepsChildCount}</span>}
              </div>
              {data.how.stepCards.map((c, i) => (
                <div key={i}>
                  <div>step[{i}]:</div>
                  <RectLine r={c.rect} />
                  <CSLines cs={c.cs} />
                </div>
              ))}
            </>
          )}

          {/* GLOBAL */}
          <Header>GLOBAL</Header>
          <div>(hover:hover): {String(data.global.hoverHover)}</div>
          <div>(prefers-reduced-motion:reduce): {String(data.global.reducedMotion)}</div>
          <div>viewport: {data.global.vw}×{data.global.vh}</div>
          <div style={{ wordBreak: 'break-all' }}>ua: {data.global.ua}</div>
        </>
      )}
    </div>
  )
}
