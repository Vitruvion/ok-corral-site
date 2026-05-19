/**
 * Builds the pass.json payload for an Apple Wallet generic-style loyalty
 * pass. Returns a plain JS object that passkit-generator stamps with the
 * proper `passTypeIdentifier`, `teamIdentifier`, and serial number when it
 * builds the .pkpass archive.
 *
 * Reference: https://developer.apple.com/documentation/walletpasses/pass
 */

import { TIERS, tierForPoints, nextTier, progressInTier, type Tier } from './tiers'

export type MemberInput = {
  name: string
  phone: string
  /** Stable serial — derived from phone unless explicitly provided. */
  serialNumber?: string
  /** Square loyalty account ID — added in Phase 2; null for Phase 1 builds. */
  loyaltyAccountId?: string | null
  /** Current point balance. Defaults to 0 for new sign-ups. */
  points?: number
  /** When the member joined — used in the "Since" field. */
  memberSince?: Date
}

export type BuiltPass = {
  /**
   * The body of pass.json minus the bits passkit-generator injects
   * (passTypeIdentifier, teamIdentifier, serialNumber, formatVersion).
   */
  passOverrides: Record<string, unknown>
  /** The resolved tier (used downstream for image selection / theming). */
  tier: Tier
  /** Stable serial — used for both pass.json and the QR code payload. */
  serialNumber: string
  /** Points the pass was generated for (mostly for logging). */
  points: number
}

/**
 * Stable serial derived from phone number. Removes non-digits and prefixes
 * with the org slug so serials are unique across pass types if we ever add
 * more (e.g. event-specific passes).
 */
export function serialFromPhone(phone: string): string {
  const digits = String(phone).replace(/\D+/g, '')
  return `okc-${digits}`
}

/** Formats e.g. "May 2026". Used for the "SINCE" field on the pass. */
function formatMemberSince(d: Date): string {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

/**
 * Builds the pass.json overrides + supporting metadata. We use the
 * `storeCard` pass style because it gives us:
 *   - a primaryField (the tier name, big and centered)
 *   - secondaryFields / auxiliaryFields (member, since, points)
 *   - back fields (perks, member info, support contact)
 *   - a barcode for in-bar scan-in
 */
export function buildPass(member: MemberInput): BuiltPass {
  const points = member.points ?? 0
  const tier = tierForPoints(points)
  const next = nextTier(tier)
  const since = member.memberSince ?? new Date()
  const serialNumber = member.serialNumber || serialFromPhone(member.phone)

  // Progress label e.g. "Local — 1,200 to Familiar Face"
  const toNextLabel = next
    ? `${(next.minPoints - points).toLocaleString()} to ${titleCase(next.name)}`
    : 'Max rank'

  const pass: Record<string, unknown> = {
    description: 'The OK Corral Rewards',
    organizationName: 'The OK Corral',
    // Wallet logoText sits next to the logo image and truncates aggressively
    // on narrow lock-screen renders. "OK CORRAL" leaves headroom and lets
    // the logo carry the brand identity.
    logoText: 'OK CORRAL',
    foregroundColor: tier.pass.foregroundColor,
    backgroundColor: tier.pass.backgroundColor,
    labelColor: tier.pass.labelColor,

    // Used by the Pass Web Service later (Phase 3) to push updates.
    // Phase 1: include the placeholder so the field is in the JSON shape
    // even though we don't host the endpoints yet.
    webServiceURL: 'https://okcorralsaloon.com/api/wallet/',
    authenticationToken: (serialNumber + '-okcorral-rewards').slice(0, 64), // 16+ chars required by Apple

    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        // The QR is a share link, not a point-attribution code. Points
        // are tied to the phone number / Apple Pay tap at the bar; this
        // code opens the /card sign-up page so friends can join from
        // wherever the pass is shown.
        message: `https://okcorralsaloon.com/card?ref=${serialNumber}`,
        messageEncoding: 'iso-8859-1',
        altText: 'Share The OK Corral Rewards',
      },
    ],

    storeCard: {
      headerFields: [
        {
          key: 'tier',
          label: 'TIER',
          value: titleCase(tier.name),
        },
      ],
      primaryFields: [
        {
          key: 'member',
          label: 'MEMBER',
          value: member.name,
        },
      ],
      secondaryFields: [
        {
          key: 'points',
          label: 'POINTS',
          value: points.toLocaleString(),
        },
        {
          key: 'progress',
          label: 'PROGRESS',
          value: toNextLabel,
          textAlignment: 'PKTextAlignmentRight',
        },
      ],
      auxiliaryFields: [
        {
          key: 'since',
          label: 'SINCE',
          value: formatMemberSince(since),
        },
      ],
      // Back fields ordered for scan-ability: call-to-action first
      // (share + current perk), then progression (next perk + ladder),
      // then context (how it works), then account/contact (phone, find
      // us, questions), then terms/footer (more info).
      backFields: [
        {
          key: 'share',
          label: 'Share Your Card',
          value: 'The QR on this pass opens a sign-up link for friends. Bring them in.',
        },
        {
          key: 'perk',
          label: `${titleCase(tier.name)} Perk`,
          value: tier.perk,
        },
        {
          key: 'next_perk',
          label: next ? `Next: ${titleCase(next.name)}` : 'Top Rank',
          value: next
            ? `${next.perk}. ${(next.minPoints - points).toLocaleString()} points away.`
            : 'You’re one of ours — there’s no rank above this.',
        },
        {
          key: 'all_tiers',
          label: 'All Ranks',
          value: TIERS.map(t => `${titleCase(t.name)} (${t.minPoints.toLocaleString()}+) — ${t.perk}`).join('\n'),
        },
        {
          key: 'how_it_works',
          label: 'How It Works',
          value: 'Pay with this card at the bar or hand the bartender your phone number at checkout. Points hit automatically — no scanning required.',
        },
        {
          key: 'phone',
          label: 'Phone on File',
          value: member.phone,
        },
        {
          key: 'address',
          label: 'Find Us',
          value: '3633 Main Street, Cottonwood, CA 96022',
        },
        {
          key: 'questions',
          label: 'Questions?',
          value: 'howdy@okcorralsaloon.com  ·  (530) 348-2062',
        },
        {
          key: 'more_info',
          label: 'More Info',
          value: 'okcorralsaloon.com/card',
        },
      ],
    },
  }

  return {
    passOverrides: pass,
    tier,
    serialNumber,
    points,
  }
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Sanity: progressInTier re-exported so the API route can include it in dev logs. */
export { progressInTier }
