import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage from '@/components/LegalPage'
import { BRAND, HARVEST_HOSTS } from '@/lib/data'
import { TERMS_EFFECTIVE } from '@/lib/legal'

/*
 * The policies here (refunds, returns, entry) were set by the owners --
 * do not add or soften one without them. Gift-card terms are not written
 * yet: SHOW_GIFT_CARDS is false, so the site sells none. Write that
 * section, with the owners, before flipping the flag.
 */

export const metadata: Metadata = {
  title: 'Terms of Service — The OK Corral',
  description:
    'Terms for tickets, merchandise and visits to The OK Corral in Cottonwood, California: 21 and over, refunds, entry, and RV stays through Harvest Hosts.',
}

export default function TermsPage() {
  const mail = <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
  return (
    <LegalPage kicker="The fine print" title="Terms of Service" effective={TERMS_EFFECTIVE}>
      <p>
        These terms apply when you use this website or buy anything from it. {BRAND.name} is
        operated by {BRAND.legalName}, {BRAND.address.line1}, {BRAND.address.line2}. By using the
        site or making a purchase, you agree to these terms.
      </p>

      <h2>21 and over</h2>
      <p>
        {BRAND.name} is a bar. You must be 21 or over to enter the property, at any time and
        anywhere on it, and to buy anything from this website, tickets included. Bring valid ID;
        we check it.
      </p>

      <h2>Tickets</h2>
      <h3>Refunds</h3>
      <p>
        <strong>Tickets are non-refundable</strong>, with two exceptions. You&apos;ll get a full
        refund if:
      </p>
      <ul>
        <li>the show is cancelled; or</li>
        <li>the show is rescheduled and you can&apos;t make the new date.</li>
      </ul>
      <p>
        To get a refund, email {mail} within 14 days of the cancellation or rescheduling being
        announced.
      </p>

      <h3>Changes to the show</h3>
      <p>
        Lineups, set times and other details can change. A change to the lineup or times
        isn&apos;t a cancellation and doesn&apos;t make a ticket refundable.
      </p>

      <h3>Entry</h3>
      <p>
        We may refuse entry to, or remove, anyone because of their conduct, because they&apos;re
        intoxicated, or because they can&apos;t show valid ID. If that happens, the ticket
        isn&apos;t refunded.
      </p>

      <h3>Your QR code is your ticket</h3>
      <p>
        Each ticket is the QR code emailed to you when you bought it. Each code admits one person,
        once: when it&apos;s scanned at the door it&apos;s used, and it won&apos;t admit anyone
        again. Duplicated or altered codes are void.
      </p>

      <h2>Merchandise</h2>
      <p>When merchandise is sold on this site, these terms apply to it:</p>
      <ul>
        <li>
          <strong>Returns</strong> are accepted within 30 days of delivery, for items that are
          unworn with their tags still on. You pay the return shipping.
        </li>
        <li>
          <strong>Refunds</strong> for returns go back to your original payment method.
        </li>
        <li>
          <strong>Pickup orders</strong> are held at the bar for 30 days.
        </li>
      </ul>
      <p>To start a return, email {mail}.</p>

      <h2>RV stays</h2>
      <p>
        Overnight RV stays in our lot are booked only through{' '}
        <a href={HARVEST_HOSTS.listingUrl} target="_blank" rel="noopener noreferrer">
          Harvest Hosts
        </a>{' '}
        and are governed by Harvest Hosts&apos; own terms and membership rules. The bar
        doesn&apos;t take RV reservations directly, by phone or otherwise.
      </p>

      <h2>This website</h2>
      <p>
        We try to keep the site accurate, but show details, drink prices and hours can change
        without notice. How we handle your information is covered in our{' '}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the fullest extent the law allows, {BRAND.legalName} isn&apos;t liable for indirect,
        incidental or consequential losses arising from your use of this website or anything you
        buy from it, and our total liability for any claim about a purchase is limited to the
        amount you paid for it. Nothing in these terms limits any rights you have that can&apos;t be
        limited by law.
      </p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the State of California.</p>

      <h2>Changes to these terms</h2>
      <p>
        We may update these terms. When we do, we&apos;ll change the effective date at the top.
      </p>

      <h2>Contact</h2>
      <p>
        {BRAND.legalName} · {BRAND.name}
        <br />
        {BRAND.address.line1}, {BRAND.address.line2}
        <br />
        {mail} · <a href={BRAND.phoneHref}>{BRAND.phone}</a>
      </p>
    </LegalPage>
  )
}
