'use client'
import { useState } from 'react'
import {
  TIERS,
  getTier,
  nextTier,
  type Tier,
  type TierKey,
} from '@/lib/rewards/tiers'
import styles from './PassMockup.module.css'

type Props = {
  /** Which tier to display. Defaults to Newcomer. */
  tierKey?: TierKey
  /** Member name shown in the primaryField. */
  memberName?: string
  /** "Since" auxiliary field — defaults to current month. */
  memberSince?: string
  /**
   * Optional point balance. If omitted, a sensible value mid-bucket is used
   * so the progress bar reads naturally. The top tier always shows full.
   */
  points?: number
  /** Stable serial for the QR alt text. Defaults to a placeholder. */
  serial?: string
  /** Whether tapping the card flips it. */
  interactive?: boolean
  /** Extra class for parent layout. */
  className?: string
}

/**
 * Visual mockup of the .pkpass that mirrors what `pass-builder.ts` actually
 * produces — same field layout, same labels, same color tokens via TIERS.
 *
 * Front: logoText top-left + TIER chip top-right, large MEMBER primary,
 *        POINTS + PROGRESS secondary row, SINCE auxiliary, faux-QR strip.
 * Back:  the current tier's perk, the next tier's perk, the full ladder
 *        with the current rank marked, and the serial number.
 *
 * Click/tap to flip when `interactive`. Subtle float + diagonal shine
 * sweep run independently so the card always feels alive.
 */
export default function PassMockup({
  tierKey = 'newcomer',
  memberName = 'Jake Sullivan',
  memberSince,
  points,
  serial = 'OKC-5305550142',
  interactive = true,
  className = '',
}: Props) {
  const [flipped, setFlipped] = useState(false)
  const tier = getTier(tierKey)
  const next = nextTier(tier)

  // Pick a representative point value if none provided: ~40% into the bucket
  // so the progress bar reads as "started this tier, working toward the next".
  // Top tier always shows "Max rank" — saturate the bar.
  const livePoints =
    typeof points === 'number'
      ? points
      : next
      ? tier.minPoints + Math.round((next.minPoints - tier.minPoints) * 0.4)
      : tier.minPoints

  const sinceLabel =
    memberSince ??
    new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const progressPct = next
    ? Math.max(0, Math.min(100, ((livePoints - tier.minPoints) / (next.minPoints - tier.minPoints)) * 100))
    : 100

  const progressLabel = next
    ? `${(next.minPoints - livePoints).toLocaleString()} to ${title(next.name)}`
    : 'Max rank'

  // Per-tier CSS variables pumped through inline styles so the card themes
  // live in one place (TIERS) but the CSS module owns the structure.
  const themeVars = {
    '--card-bg':     tier.web.bg,
    '--card-bg2':    tier.web.bgAccent,
    '--card-fg':     tier.web.fg,
    '--card-label':  tier.web.label,
    '--card-accent': tier.web.accent,
    '--card-glow':   tier.web.glow ?? 'transparent',
  } as React.CSSProperties

  const handleClick = () => {
    if (interactive) setFlipped(f => !f)
  }

  return (
    <div className={`${styles.scene} ${className}`} style={themeVars}>
      <button
        type="button"
        className={`${styles.card} ${flipped ? styles.cardFlipped : ''}`}
        onClick={handleClick}
        aria-label={`OK Corral Rewards pass mockup — ${title(tier.name)} tier. ${interactive ? 'Click to flip.' : ''}`}
        aria-pressed={flipped}
      >
        {/* ── FRONT ────────────────────────────────────────────── */}
        <div className={styles.face}>
          <div className={styles.shine} aria-hidden="true" />

          <header className={styles.head}>
            <div className={styles.brand}>
              <div className={styles.monogram} aria-hidden="true">OK</div>
              <div className={styles.brandText}>
                <span className={styles.brandThe}>THE</span>
                <span className={styles.brandName}>OK CORRAL</span>
              </div>
            </div>
            <div className={styles.tierChip}>
              <span className={styles.tierLabel}>TIER</span>
              <span className={styles.tierValue}>{title(tier.name)}</span>
            </div>
          </header>

          <div className={styles.primary}>
            <span className={styles.fieldLabel}>MEMBER</span>
            <span className={styles.primaryValue}>{memberName}</span>
          </div>

          <div className={styles.secondary}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>POINTS</span>
              <span className={styles.fieldValue}>{livePoints.toLocaleString()}</span>
            </div>
            <div className={`${styles.field} ${styles.fieldRight}`}>
              <span className={styles.fieldLabel}>PROGRESS</span>
              <span className={styles.fieldValue}>{progressLabel}</span>
            </div>
          </div>

          <div className={styles.progressTrack} aria-hidden="true">
            <div
              className={styles.progressFill}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className={styles.auxiliary}>
            <span className={styles.fieldLabel}>SINCE</span>
            <span className={styles.fieldValue}>{sinceLabel}</span>
          </div>

          <footer className={styles.foot}>
            <div className={styles.qr} aria-hidden="true">
              <FauxQR />
            </div>
            <div className={styles.qrMeta}>
              <span className={styles.qrTitle}>Show at the bar to earn</span>
              <span className={styles.qrSerial}>{serial}</span>
            </div>
          </footer>
        </div>

        {/* ── BACK ─────────────────────────────────────────────── */}
        <div className={`${styles.face} ${styles.faceBack}`}>
          <header className={styles.backHead}>
            <span className={styles.backKicker}>◆ THE CARD</span>
            <span className={styles.backTitle}>What you get</span>
          </header>

          <div className={styles.perkBlock}>
            <span className={styles.fieldLabel}>{title(tier.name)} Perk</span>
            <span className={styles.perkValue}>{tier.perk}</span>
          </div>

          {next && (
            <div className={styles.perkBlock}>
              <span className={styles.fieldLabel}>Next: {title(next.name)}</span>
              <span className={styles.perkValue}>
                {next.perk}. {(next.minPoints - livePoints).toLocaleString()} points away.
              </span>
            </div>
          )}

          <div className={styles.ladder}>
            <span className={styles.fieldLabel}>All Ranks</span>
            <ul className={styles.ladderList}>
              {TIERS.map(t => {
                const isCurrent = t.key === tier.key
                return (
                  <li
                    key={t.key}
                    className={`${styles.ladderRow} ${isCurrent ? styles.ladderRowCurrent : ''}`}
                  >
                    <span className={styles.ladderDot}>{isCurrent ? '◆' : '·'}</span>
                    <span className={styles.ladderName}>{title(t.name)}</span>
                    <span className={styles.ladderPts}>{t.minPoints.toLocaleString()}+</span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className={styles.backFoot}>
            <span>{serial}</span>
            <span>okcorralsaloon.com</span>
          </div>
        </div>
      </button>
    </div>
  )
}

/** Title-cases an UPPER name like "FAMILIAR FACE" → "Familiar Face". */
function title(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Decorative QR-like glyph. Not a real scannable code — labeled as a serial
 * placeholder on the card. Five-by-five grid with the three finder patterns
 * and a fixed data pattern so it stays stable across renders.
 */
function FauxQR() {
  const cells: { x: number; y: number; size: number; finder?: boolean }[] = []
  // Three finder patterns (corner squares)
  const finders: Array<[number, number]> = [
    [0, 0],
    [4, 0],
    [0, 4],
  ]
  for (const [fx, fy] of finders) {
    cells.push({ x: fx, y: fy, size: 1, finder: true })
  }
  // Fixed data pattern
  const data: Array<[number, number]> = [
    [2, 1], [3, 2], [1, 2], [2, 3], [4, 3], [3, 4], [2, 4],
  ]
  for (const [x, y] of data) {
    cells.push({ x, y, size: 1 })
  }
  return (
    <svg viewBox="0 0 5 5" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0" y="0" width="5" height="5" fill="var(--card-fg)" rx="0.4" />
      {cells.map((c, i) =>
        c.finder ? (
          <g key={i} transform={`translate(${c.x},${c.y})`}>
            <rect x="0.08" y="0.08" width="0.84" height="0.84" fill="var(--card-bg)" rx="0.12" />
            <rect x="0.28" y="0.28" width="0.44" height="0.44" fill="var(--card-accent)" rx="0.08" />
          </g>
        ) : (
          <rect
            key={i}
            x={c.x + 0.12}
            y={c.y + 0.12}
            width={c.size - 0.24}
            height={c.size - 0.24}
            fill="var(--card-bg)"
            rx="0.06"
          />
        ),
      )}
    </svg>
  )
}
