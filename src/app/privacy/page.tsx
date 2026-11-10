import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPage from '@/components/LegalPage'
import { BRAND } from '@/lib/data'
import { PRIVACY_EFFECTIVE } from '@/lib/legal'

/*
 * EVERY STATEMENT HERE DESCRIBES SOMETHING THE CODE ACTUALLY DOES. If you
 * add a form, an embed, a cookie, an email or a vendor, update this page
 * in the same change -- and if you remove one, take it out of here too.
 * The inventory it was written from: Bookings.tsx (booking_inquiries +
 * /api/booking-notify), Footer.tsx (newsletter), TicketPurchase.tsx ->
 * /api/tickets/checkout -> lib/tickets/complete.ts (ticket_orders,
 * Resend), /api/checkout + /api/stripe/webhook (merch_orders,
 * gift_card_orders -- behind SHOW_MERCH / SHOW_GIFT_CARDS), /api/card/pass
 * (nothing stored), lib/door/* (staff devices), globals.css (Google
 * Fonts), Location.tsx (Maps), Events.tsx (YouTube), InstagramStrip.tsx.
 */

export const metadata: Metadata = {
  title: 'Privacy Policy — The OK Corral',
  description:
    'What The OK Corral collects through its website, ticket sales and booking form, where it goes, and how to ask us to see or delete it.',
}

export default function PrivacyPage() {
  const mail = <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
  return (
    <LegalPage kicker="The fine print" title="Privacy Policy" effective={PRIVACY_EFFECTIVE}>
      <p>
        This policy explains what we collect when you use this website, buy tickets, or get in
        touch, what we do with it, and who else handles it on our behalf. We&apos;ve kept it short
        and plain. If anything here is unclear, ask us.
      </p>

      <h2>Who we are</h2>
      <p>
        {BRAND.name} is operated by {BRAND.legalName}, {BRAND.address.line1},{' '}
        {BRAND.address.line2}. You can reach us at {mail} or{' '}
        <a href={BRAND.phoneHref}>{BRAND.phone}</a>. When this policy says &ldquo;we&rdquo; or
        &ldquo;us,&rdquo; that&apos;s who it means.
      </p>

      <h2>What we collect, and why</h2>

      <h3>When you send us a message</h3>
      <p>
        The &ldquo;Groups &amp; Get-Togethers&rdquo; form asks for your name, email address and the
        reason you&apos;re writing, and optionally your phone number, a preferred date and a note.
        We store what you send in our database and email a copy to our inbox so someone can reply.
        We use it only to answer you.
      </p>

      <h3>When you buy tickets</h3>
      <p>
        Checkout happens on Stripe&apos;s secure payment page. Stripe collects your card details,
        email address, name, billing details and phone number. From that, we keep your name, email
        address and phone number, along with what you bought and what you paid, so we can email
        your tickets, find you on the list at the door, and contact you if a show changes. Your
        tickets arrive by email, one QR code per ticket. At the door, our staff scan those codes and
        we record when each ticket was used. Our door staff can see the names on the night&apos;s
        list, including on a phone that keeps a copy so the door still works without signal.
      </p>
      <p>
        Checkout also asks, optionally, whether you&apos;d like emails about future shows. We save
        your answer. The choice is off unless you pick &ldquo;Yes.&rdquo;
      </p>

      <h3>When you sign up for the Bulletin</h3>
      <p>
        If you enter your email in the &ldquo;Bulletin&rdquo; sign-up at the bottom of the site, we
        save that email address so we can send you news about shows and specials.
      </p>

      <h3>When you get a Corral Rewards card</h3>
      <p>
        The rewards card page asks for your name and phone number so we can put them on the Apple
        Wallet pass it creates for you. That pass is generated on the spot and downloaded to your
        phone. We don&apos;t keep a copy of your name or number from this page.
      </p>

      <h3>Merchandise and gift cards</h3>
      <p>
        We don&apos;t sell merchandise or gift cards on this website right now. If we start, those
        checkouts will also run on Stripe. For merchandise we&apos;d keep your name, email address,
        shipping address and order so we can ship it or have it ready for pickup. For a gift card
        we&apos;d keep the recipient&apos;s name and email address, your name and any note, so we can
        deliver it. We&apos;ll update this policy before either goes live if anything changes.
      </p>

      <h2>Payment cards</h2>
      <p>
        Card payments are handled by Stripe. We never see or store your full card number. Stripe
        processes it under its own{' '}
        <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer">
          privacy policy
        </a>
        .
      </p>

      <h2>Marketing emails</h2>
      <p>
        We only send marketing emails to people who asked for them: by signing up for the
        Bulletin, or by choosing &ldquo;Yes, keep me posted&rdquo; at ticket checkout. Ticket
        confirmations and replies to your messages aren&apos;t marketing; you&apos;ll get those
        either way. To stop marketing emails or be taken off the list, email {mail} and we&apos;ll
        remove you.
      </p>

      <h2>We don&apos;t sell your information</h2>
      <p>
        We don&apos;t sell personal information, and we don&apos;t share it for advertising. We
        don&apos;t run ads on this site.
      </p>

      <h2>Who else handles it</h2>
      <p>These companies process information for us, only so the site and our business can run:</p>
      <ul>
        <li>
          <strong>Vercel</strong> hosts the website. Like any web host, it receives your IP address
          and basic request details when you visit.
        </li>
        <li>
          <strong>Supabase</strong> is our database. It stores the information described above, and
          serves some of the images (like event posters) you see on the site.
        </li>
        <li>
          <strong>Stripe</strong> runs checkout and processes payments.
        </li>
        <li>
          <strong>Resend</strong> delivers our emails: your tickets, order confirmations, and
          copies of messages sent through our form.
        </li>
        <li>
          <strong>Google Workspace</strong> hosts our email inbox, {BRAND.email}.
        </li>
        <li>
          <strong>Apple</strong> handles the Wallet pass on your phone if you add a Corral Rewards
          card.
        </li>
      </ul>

      <h2>Content from other sites</h2>
      <p>
        Some parts of the page load directly from other companies, which means your browser
        connects to them and they receive your IP address, under their own privacy policies:
      </p>
      <ul>
        <li>
          <strong>Google Fonts</strong>: the site&apos;s typefaces, on every page.
        </li>
        <li>
          <strong>Google Maps</strong>: the map in the &ldquo;Come Find Us&rdquo; section.
        </li>
        <li>
          <strong>YouTube</strong>: when an event with a video is open on the page (the featured
          show opens automatically).
        </li>
        <li>
          <strong>Instagram</strong>: the photos in our Instagram section load from
          Instagram&apos;s servers.
        </li>
      </ul>
      <p>
        Google Maps and YouTube may set their own cookies. Links to other sites, such as Facebook
        or TikTok, take you to sites with their own policies; nothing from them loads
        on our pages until you click.
      </p>

      <h2>Cookies and tracking</h2>
      <p>
        We don&apos;t use analytics, advertising cookies, tracking pixels or any other tracking on
        this site. We don&apos;t set cookies for visitors at all. Your browser does store two small
        things for us: a note that you&apos;ve confirmed you&apos;re 21 or over, so we don&apos;t ask
        on every visit, and, when online merchandise is available, the contents of your cart.
        Both stay on your device, and you can clear them in your browser settings.
      </p>
      <p>
        Our staff pages use a login cookie, and our door-scanning phones keep the night&apos;s
        ticket list stored on the device. Neither applies to visitors.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your information for as long as we need it for the reasons above, such as running
        a show, answering your message, or keeping records of sales. You can ask us to delete it at
        any time (see below).
      </p>

      <h2>Your California privacy rights</h2>
      <p>If you&apos;re a California resident, you have the right to:</p>
      <ul>
        <li>
          <strong>Know</strong> what personal information we have about you, where it came from,
          why we have it, and who we&apos;ve shared it with;
        </li>
        <li>
          <strong>Delete</strong> personal information we have about you;
        </li>
        <li>
          <strong>Correct</strong> personal information that&apos;s wrong;
        </li>
        <li>
          <strong>Opt out of the sale or sharing</strong> of your personal information. We
          don&apos;t sell or share it, so there&apos;s nothing to opt out of, but you&apos;re welcome
          to tell us anyway;
        </li>
        <li>
          <strong>Not be treated differently</strong> for using any of these rights.
        </li>
      </ul>
      <p>
        To make a request, email {mail} with your name and the email address or phone number you
        used with us, so we can find your records and confirm the request is yours. You can also
        have an authorized agent make a request for you. We&apos;ll respond within 45 days.
      </p>

      <h2>Adults only</h2>
      <p>
        {BRAND.name} is a bar, and this site and everything we sell are for adults 21 and over. We
        don&apos;t knowingly collect information from anyone under 21. If you believe someone under
        21 has given us their information, email us and we&apos;ll delete it.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we change how we handle your information, we&apos;ll update this page and its effective
        date.
      </p>

      <h2>Contact</h2>
      <p>
        {BRAND.legalName} · {BRAND.name}
        <br />
        {BRAND.address.line1}, {BRAND.address.line2}
        <br />
        {mail} · <a href={BRAND.phoneHref}>{BRAND.phone}</a>
      </p>
      <p>
        See also our <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  )
}
