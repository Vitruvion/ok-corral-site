/**
 * OK Corral loyalty tiers. Source of truth for tier names, point thresholds,
 * perks, and the visual treatment that propagates into both the Apple Wallet
 * pass design and the /card page preview.
 *
 * Colors are formatted as `rgb(r, g, b)` strings because that's what Apple's
 * pass.json schema requires for `backgroundColor`, `foregroundColor`, and
 * `labelColor` — hex isn't accepted there.
 *
 * Visual logic mirrors the design screenshot's progression:
 *   Newcomer       — muted gray text on pure ink
 *   Regular        — bronze/gold-dim accents
 *   Local          — brighter gold
 *   Familiar Face  — warm warm bg, full gold
 *   One of Ours    — bright gold glow on a warmer card
 */

export type TierKey =
  | 'newcomer'
  | 'regular'
  | 'local'
  | 'familiar_face'
  | 'one_of_ours'

export type Tier = {
  key: TierKey
  name: string                  // display name in caps
  minPoints: number             // inclusive lower bound
  maxPoints: number | null      // exclusive upper bound (null = top tier)
  perk: string                  // one-line description of the reward
  /** Apple Wallet pass colors, rgb(...) strings as the schema requires. */
  pass: {
    backgroundColor: string
    foregroundColor: string
    labelColor: string
  }
  /** Web preview colors — hex, used by the /card page's pass mockup. */
  web: {
    bg: string                  // card gradient end color
    bgAccent: string            // card gradient start color (warmer for higher tiers)
    fg: string                  // primary text
    label: string               // small labels
    accent: string              // tier-name color + progress fill
    glow?: string               // optional outer glow for top tier
  }
}

export const TIERS: Tier[] = [
  {
    key: 'newcomer',
    name: 'NEWCOMER',
    minPoints: 0,
    maxPoints: 500,
    perk: 'Welcome to the Corral',
    pass: {
      backgroundColor: 'rgb(11, 9, 8)',
      foregroundColor: 'rgb(158, 145, 130)',
      labelColor: 'rgb(107, 96, 88)',
    },
    web: {
      bg: '#0b0908',
      bgAccent: '#151311',
      fg: '#d4cab5',
      label: '#6b6058',
      accent: '#9e9182',
      glow: 'rgba(158, 145, 130, 0.10)',
    },
  },
  {
    key: 'regular',
    name: 'REGULAR',
    minPoints: 500,
    maxPoints: 1500,
    perk: 'Free shot on your birthday',
    pass: {
      backgroundColor: 'rgb(11, 9, 8)',
      foregroundColor: 'rgb(200, 169, 110)',
      labelColor: 'rgb(138, 115, 71)',
    },
    web: {
      bg: '#0b0908',
      bgAccent: '#1a1411',
      fg: '#f0e8db',
      label: '#8a7347',
      accent: '#c8a96e',
      glow: 'rgba(200, 169, 110, 0.12)',
    },
  },
  {
    key: 'local',
    name: 'LOCAL',
    minPoints: 1500,
    maxPoints: 3500,
    perk: 'OK Corral koozie + sticker pack',
    pass: {
      backgroundColor: 'rgb(20, 16, 12)',
      foregroundColor: 'rgb(212, 190, 138)',
      labelColor: 'rgb(200, 169, 110)',
    },
    web: {
      bg: '#14100c',
      bgAccent: '#221a13',
      fg: '#f0e8db',
      label: '#c8a96e',
      accent: '#d4be8a',
      glow: 'rgba(212, 190, 138, 0.14)',
    },
  },
  {
    key: 'familiar_face',
    name: 'FAMILIAR FACE',
    minPoints: 3500,
    maxPoints: 7500,
    perk: 'Exclusive OK Corral hat',
    pass: {
      backgroundColor: 'rgb(28, 22, 16)',
      foregroundColor: 'rgb(212, 190, 138)',
      labelColor: 'rgb(200, 169, 110)',
    },
    web: {
      bg: '#1c1610',
      bgAccent: '#2a2018',
      fg: '#f0e8db',
      label: '#c8a96e',
      accent: '#d4be8a',
      glow: 'rgba(212, 190, 138, 0.16)',
    },
  },
  {
    key: 'one_of_ours',
    name: 'ONE OF OURS',
    minPoints: 7500,
    maxPoints: null,
    perk: 'Exclusive OK Corral tee',
    pass: {
      backgroundColor: 'rgb(28, 22, 16)',
      foregroundColor: 'rgb(232, 204, 138)',
      labelColor: 'rgb(212, 190, 138)',
    },
    web: {
      bg: '#1c1610',
      bgAccent: '#2f2519',
      fg: '#f0e8db',
      label: '#d4be8a',
      accent: '#e8cc8a',
      glow: 'rgba(232, 204, 138, 0.18)',
    },
  },
]

/** Lookup a tier by its key. */
export function getTier(key: TierKey): Tier {
  const t = TIERS.find(t => t.key === key)
  if (!t) throw new Error(`Unknown tier: ${key}`)
  return t
}

/** Resolve a point balance to its tier (rounds down to the bucket it sits in). */
export function tierForPoints(points: number): Tier {
  for (const t of TIERS) {
    if (points >= t.minPoints && (t.maxPoints === null || points < t.maxPoints)) {
      return t
    }
  }
  // points below 0 (shouldn't happen) → newcomer
  return TIERS[0]
}

/** Returns the next tier above the given one, or null if at the top. */
export function nextTier(current: Tier): Tier | null {
  const i = TIERS.findIndex(t => t.key === current.key)
  return i >= 0 && i < TIERS.length - 1 ? TIERS[i + 1] : null
}

/**
 * Progress through the *current* tier, as a value in [0, 1]. Used for the
 * progress bar on the pass + the web preview. Caps at 1 for the top tier.
 */
export function progressInTier(points: number): number {
  const current = tierForPoints(points)
  const next = nextTier(current)
  if (!next) return 1
  const span = next.minPoints - current.minPoints
  if (span <= 0) return 1
  return Math.max(0, Math.min(1, (points - current.minPoints) / span))
}
