import CardClient from './CardClient'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Corral Rewards — The OK Corral',
  description:
    'Add the OK Corral rewards card to Apple Wallet. Earn ranks every time you visit.',
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
