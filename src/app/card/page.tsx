import CardClient from './CardClient'
import type { Metadata } from 'next'

/*
 * PARKED until the Square Loyalty work lands (CLAUDE.md §3): nothing on
 * the site links here, and search engines are told to skip it. The route
 * still works, so passes already in people's Wallets and saved links keep
 * resolving. The copy says only what happens today -- no points, no
 * updates. Restore the links and indexing when loyalty is real.
 */
export const metadata: Metadata = {
  title: 'Corral Rewards — The OK Corral',
  description:
    'Add an OK Corral card to Apple Wallet. Points are not being tracked yet.',
  robots: { index: false, follow: false },
}

/**
 * Phase 1 landing page. Minimal saloon-style layout: form + tier preview
 * + "Add to Apple Wallet" button that calls /api/card/pass.
 *
 * Phase 4 will replace this with the polished mockup from the reference HTML.
 */
export default function CardPage() {
  return <CardClient />
}
