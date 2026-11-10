import { BRAND } from './data'

/**
 * Effective dates for /privacy and /terms. Change a date only when that
 * page's substance changes, and say so on the page -- the date is a
 * promise about which version someone agreed to.
 */
export const PRIVACY_EFFECTIVE = 'November 9, 2026'
export const TERMS_EFFECTIVE = 'November 9, 2026'

/**
 * Shown by Stripe beside the pay button on ticket and merch checkout
 * (`custom_text.submit`). Plain text with a bare URL, which reads fine
 * whether or not Stripe makes it a link. Stripe's own "agree to the
 * Terms" checkbox (consent_collection) is not used: it errors unless a
 * Terms URL is set in the Stripe Dashboard's public details, and a
 * checkout that throws is a show that sells nothing.
 */
export const CHECKOUT_TERMS_TEXT = `By purchasing you agree to our Terms of Service: ${BRAND.siteUrl}/terms`
