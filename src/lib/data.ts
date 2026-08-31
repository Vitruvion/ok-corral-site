/* ═══════════════════════════════════════════════════
   OK CORRAL — Site Data
   All editable content lives here. Later this moves
   to Supabase tables, but for now it's a single file
   you can update and redeploy.
   ═══════════════════════════════════════════════════ */

/**
 * Feature flag: when false, the Merch section, the "Merch" nav links,
 * the Topbar cart button, the Hero "Shop Merch" CTA, the Footer Explore
 * merch link, the Footer Shop column (shipping/size/wholesale links), the
 * ProgressRail merch dot, and the CartDrawer itself all disappear. Flip to
 * true when the store is ready to launch.
 *
 * Deliberately NOT gated, so orders placed before the flag flipped still
 * complete: /api/stripe/webhook, the /api/checkout merch branch, and
 * StripeReturnHandler (which only renders when Stripe sends the customer
 * back with ?stripe=... params — it exposes no merch surface on its own).
 * CartProvider also stays mounted because Topbar calls useCart().
 */
export const SHOW_MERCH = false

/**
 * Feature flag: when false, the GiftCards section and the Footer Shop
 * "Gift Cards" link disappear. Flip to true when gift card checkout is
 * ready to launch (Stripe wiring already in place).
 */
export const SHOW_GIFT_CARDS = false

export const BRAND = {
  name: 'The OK Corral',
  location: 'Cottonwood, California',
  since: 'Est. 1954',
  tagline: "NorCal's favorite western bar.",
  address: {
    line1: '3633 Main Street',
    line2: 'Cottonwood, CA 96022',
  },
  phone: '(530) 348-2062',
  phoneHref: 'tel:5303482062',
  email: 'howdy@okcorralsaloon.com',
  instagram: 'okcorralsaloon',
  instagramUrl: 'https://instagram.com/okcorralsaloon',
  facebook: 'The OK Corral',
  facebookUrl: 'https://www.facebook.com/profile.php?id=61575694323377',
  tiktok: 'okcorralsaloon',
  tiktokUrl: 'https://www.tiktok.com/@okcorralsaloon',
  mapsUrl: 'https://www.google.com/maps/dir/?api=1&destination=3633+Main+Street,+Cottonwood,+CA+96022',
  // Basic embed URL — Google's public embed doesn't accept style params,
  // so we apply a CSS filter on the iframe instead (see Location.module.css).
  mapsEmbed: 'https://www.google.com/maps?q=3633+Main+Street,+Cottonwood,+CA+96022&output=embed',
  coords: { lat: 40.384, lon: -122.281 },
}

export const HOURS = [
  { day: 'Sunday',    abbr: 'Sun', open: '8 AM', close: '2 AM' },
  { day: 'Monday',    abbr: 'Mon', open: '8 AM', close: '2 AM' },
  { day: 'Tuesday',   abbr: 'Tue', open: '8 AM', close: '2 AM' },
  { day: 'Wednesday', abbr: 'Wed', open: '8 AM', close: '2 AM' },
  { day: 'Thursday',  abbr: 'Thu', open: '8 AM', close: '2 AM' },
  { day: 'Friday',    abbr: 'Fri', open: '8 AM', close: '2 AM' },
  { day: 'Saturday',  abbr: 'Sat', open: '8 AM', close: '2 AM' },
]

export const NAV_LINKS = [
  { label: 'Events',   href: '#events' },
  { label: 'Bar',      href: '#drinks' },
  ...(SHOW_MERCH ? [{ label: 'Merch', href: '#merch' }] : []),
  { label: 'Gallery',  href: '#gallery' },
  { label: 'Bookings', href: '#bookings' },
  { label: 'Visit',    href: '#visit' },
]

export type RelatedLink = {
  /** Exact name as it appears in the description/support text. */
  name: string
  /** External URL — opens in a new tab. */
  url: string
  /** Optional thumbnail image path for sidebar display. */
  image?: string
  /** Optional one-line role shown under the thumbnail. */
  role?: string
  /**
   * If true, the FIRST occurrence of `name` in the description body is left
   * as plain text instead of being linkified. Use when the first mention is
   * wordplay or a pun on the brand name rather than a literal reference to
   * the business. Has no effect on the support tagline. Defaults to false.
   */
  skipFirstInDescription?: boolean
}

export type EventData = {
  id: string
  date: string
  weekday: string
  name: string
  support: string
  time: string
  doors: string
  genre: string
  tickets: string
  tags: string[]
  description: string
  /**
   * Optional. When set, the Events UI shows a
   * prominent "Sign Up for the Contest" button alongside (not instead of) the
   * Free Admission badge. Used for optional opt-in actions like a contest
   * signup where general entry is still free. Opens in a new tab.
   */
  signup_url?: string | null
  /** Path to the event poster image (3:4-ish aspect). */
  poster_url?: string | null
  /**
   * Direct ticket sales, replacing Eventbrite one show at a time.
   *
   * When `tickets_on_sale` is false -- the default for every existing row --
   * the event shows the "Free Admission - No Cover" badge. Eventbrite was
   * retired once every show had been cut over; the events.eventbrite_url
   * COLUMN still exists and still holds its old values as a record of past
   * shows, but nothing reads it.
   *
   * Availability (how many are left, whether it is sold out) is NOT here.
   * It changes with every purchase and this data is served through ISR, so a
   * cached page would happily sell a sold-out show. The buy widget reads it
   * live from /api/tickets/availability instead.
   */
  tickets_on_sale?: boolean
  /** Dollars. Null whenever tickets_on_sale is false. */
  ticket_price?: number | null
  /** Short line shown next to the buy button - refund policy, age limits. */
  ticket_blurb?: string | null
  /** Auto-expand on page load. Used for the upcoming/headline show. */
  featured?: boolean
  /** Names that appear in `support` or `description` get auto-linkified. */
  related_links?: RelatedLink[]
  /**
   * YouTube watch URL (or any YouTube link — youtu.be/, /embed/, /shorts/).
   * If set, an embedded player renders below the poster in the expanded panel.
   * The component normalizes the URL to /embed/<id> at render time.
   */
  youtube_url?: string | null
}

export const EVENTS: EventData[] = [
  {
    id: 'ev-bad-dog-2026-06-13',
    date: 'June 13 2026',
    weekday: 'Saturday',
    name: 'Bad Dog x The OK Corral',
    support: 'Bad Dog · hot dog eating contest · $4 dogs all afternoon',
    time: '6–11 PM',
    doors: '',
    genre: 'Collab Event',
    tickets: 'Free',
    tags: ['collab', 'food'],
    description: "Sometimes it's just an OK day to have a Bad Dog. Joining forces with Bad Dog for a hot dog eating contest, $4 dogs all afternoon. The challenge: eat 3 hot dogs and drink 3 beers — fastest wins a cash prize and more. Contest kicks off at 7:30 PM, so sign up early.",
    signup_url: 'https://partiful.com/e/IgNB4661lOfxsTgIF9Sh',
    poster_url: '/assets/events/bad-dog-collab-v2.png',
    related_links: [
      {
        name: 'Bad Dog',
        url: 'https://www.instagram.com/bad_dog_redding/',
        role: '@bad_dog_redding',
        // First mention in description ("OK day to have a Bad Dog") is wordplay,
        // not a literal brand reference — keep it plain. Second mention links.
        skipFirstInDescription: true,
      },
    ],
  },
  {
    id: 'ev-bar-jay-bar-2026-06-17',
    date: 'June 17 2026',
    weekday: 'Wednesday',
    name: 'Bar Jay Bar',
    support: 'Honky tonk · theatrical chaos · 21+',
    time: '9:30 PM – late',
    doors: '',
    genre: 'Live Music',
    tickets: 'Free · 21+',
    tags: ['live music', '21+'],
    description: "Bar Jay Bar live — high-energy honky tonk, theatrical chaos, and yes, the band climbs on each other mid-song. Free, 21+. Walk in.",
    poster_url: '/assets/events/barjaybar.png',
    related_links: [
      {
        name: 'Bar Jay Bar',
        url: 'https://www.instagram.com/barjaybar/',
        role: '@barjaybar',
      },
    ],
  },
  {
    id: 'ev1',
    date: 'June 25 2026',
    weekday: 'Thursday',
    name: 'Dustin Dale Gaspard',
    support: 'w/ Tanner Bingaman · 8:30 PM',
    time: '9 PM',
    doors: '',
    genre: 'Alternative Folk · Cajun',
    tickets: '$15',
    tags: ['live music', 'special event'],
    description: "Singer-songwriter Dustin Dale Gaspard of Cow Island, Louisiana brings his alternative folk sound to The OK Corral for one unforgettable night. A Season 28 contestant on NBC's The Voice, Dustin is born and raised in deep Southern Louisiana — his music is steeped in Cajun soul, raw storytelling, and a voice that fills every corner of the room. Opening the night at 8:30 is Tanner Bingaman — a songwriter, banjoist, and poet from the hills of Appalachia. Featured on NPR, awarded Emerging Artist of the Year by the Susquehanna Folk Music Society, and currently touring with Dustin on a 10,000-mile run down the West Coast. Two artists, one stage, one hell of a Thursday night.",
    poster_url: '/assets/posters/dustin-gaspard.jpg',
    youtube_url: 'https://www.youtube.com/watch?v=_6SMeYNM8gM',
    featured: true,
    related_links: [
      {
        name: 'Tanner Bingaman',
        url: 'https://tannerbingaman.com/',
        image: '/assets/gallery/tanner-bingaman.jpg',
        role: 'Support · 8:30 PM',
      },
      {
        name: 'Dustin Dale Gaspard',
        url: 'https://www.instagram.com/dustindalegaspard/',
        image: '/assets/gallery/dustin-ig.jpg',
        role: '@dustindalegaspard',
      },
    ],
  },
]

export type RecurringEvent = {
  /** Three-letter day badge, e.g. 'MON'. */
  day: string
  name: string
  support: string
  time: string
  tickets: string
  /**
   * Optional flyer. A weekly card with a poster renders full-width with the
   * art alongside — the 3-up grid is too narrow to fit one otherwise.
   */
  poster_url?: string | null
}

export const RECURRING: RecurringEvent[] = [
  {
    day: 'MON',
    name: "Madi's Madness Pool Tournament",
    support: "Rack 'em up · anyone can play",
    time: '7:30 PM',
    tickets: '$5 Buy-In',
    poster_url: '/assets/events/madis-madness-pool.jpg',
  },
  // Taco Tuesday removed 2026-06-30 — restore this entry (and the matching
  // recurring_events row in supabase/seed.sql + the MARQUEE_ITEMS entry below)
  // to bring it back:
  // { day: 'TUE', name: 'Taco Tuesday', support: '$4 tacos every Tuesday night', time: 'All Day', tickets: 'No Cover' },
  {
    day: 'WED',
    name: 'Free Pool Wednesday',
    support: 'Tables on the house, all night long',
    time: 'All Day',
    tickets: 'No Cover',
  },
  {
    day: 'SUN',
    name: 'Karaoke Night',
    support: 'Grab the mic · 6 PM til late',
    time: '6 PM',
    tickets: 'No Cover',
  },
]

export const MARQUEE_ITEMS = [
  // Taco Tuesday removed 2026-06-30 — restore to bring it back:
  // { text: 'Tuesday', accent: '$4 Tacos' },
  { text: 'Wednesday', accent: 'Free Pool All Night' },
  { text: 'Sunday', accent: 'Karaoke Til Close' },
  { text: 'Daily', accent: '8 AM · Til 2 AM' },
]

export type DrinkData = {
  name: string
  tagline: string
  price: string
  description: string
}

/*
 * DRINKS moved to Supabase (2026-08).
 *
 * Drinks are edited at /admin/menu, so the database is the only source of
 * truth for them. The hardcoded array that used to live here was a live
 * fallback — which meant a Supabase blip could quietly serve months-old
 * prices to customers as if they were current. For a menu, stale-and-
 * confident is worse than absent, so getDrinks() now THROWS on a query
 * failure. fetchAll() catches that and lets the homepage render without a
 * drinks section; /menu-board lets it propagate so ISR keeps serving the
 * last good board instead of caching a blank one.
 *
 * Kept deliberately:
 *   - DrinkData  : the display shape, imported by queries.ts, ClientShell
 *                  and Drinks.tsx
 *   - DRINK_TABS : category display ORDER, not drink data. Drives the
 *                  homepage tabs and the menu board's column order.
 *
 * The original rows live on in supabase/seed.sql, which now only inserts
 * them into a completely empty table (first-run bootstrap).
 */

export const DRINK_TABS = ['Saloon Cocktails', 'Shots & Bombs', 'Featured Beer', 'Cigars']

export type MerchItem = {
  id: string
  name: string
  category: string
  price: number
  badge?: string
  color: string
  sizes: string[]
  imageBg?: 'bone'
  image?: string
  description: string
}

export const MERCH: MerchItem[] = [
  { id: 'm1', name: 'House Tee — Black', category: 'Tees', price: 32, badge: 'New', color: 'Vintage Black', sizes: ['S','M','L','XL','XXL'], image: '/assets/merch/tee-black-back.png', description: 'Standard fit, ring-spun cotton. Screenprinted front and back. Washed for softness.' },
  { id: 'm2', name: 'House Tee — White', category: 'Tees', price: 32, badge: 'New', color: 'Bone White', sizes: ['S','M','L','XL','XXL'], image: '/assets/merch/tee-white-back.png', description: 'Same cut as the black. Cream white, soft hand print.' },
  { id: 'm3', name: 'Saloon Cap', category: 'Caps', price: 38, color: 'Sand / Ember', sizes: ['One Size'], description: 'Unstructured 5-panel. Embroidered wordmark. Adjustable leather strap.' },
  { id: 'm3b', name: 'Crossed Boots Hoodie', category: 'Hoodies', price: 68, badge: 'Small Batch', color: 'Washed Ink', sizes: ['S','M','L','XL'], description: 'Heavyweight French terry. Crossed-boots graphic back print. Kangaroo pocket.' },
  { id: 'm4', name: 'Ember Bandana', category: 'Bandanas', price: 18, color: 'Bone / Ember', sizes: ['One Size'], description: 'All-over western print. 22×22 cotton. Trail-ready.' },
  { id: 'm5', name: 'OK Pint Glass', category: 'Drinkware', price: 14, color: 'Clear', sizes: ['Single', '4-Pack'], description: 'Heavy-base 16oz pint. Etched wordmark. Dishwasher safe.' },
  { id: 'm6', name: 'Koozie Set (4)', category: 'Drinkware', price: 22, color: 'Assorted', sizes: ['Set of 4'], description: 'Neoprene can koozies. Four designs. Keeps em cold.' },
  { id: 'm7', name: "I'm Your Hucklebeer Sticker", category: 'Stickers', price: 5, color: 'Full Color', sizes: ['4-inch'], imageBg: 'bone', image: '/assets/merch/sticker-hucklebeer.png', description: 'Vinyl die-cut. Weather resistant. Laptop, bumper, cooler.' },
  { id: 'm7b', name: 'Saloon Sign Sticker', category: 'Stickers', price: 5, color: 'Full Color', sizes: ['4.5-inch'], imageBg: 'bone', image: '/assets/merch/sticker-sign.png', description: 'Classic saloon sign design. Die-cut vinyl.' },
  { id: 'm7c', name: 'OK Coaster Set (8)', category: 'Drinkware', price: 12, color: 'Black / White', sizes: ['Set of 8'], imageBg: 'bone', image: '/assets/merch/sticker-coaster.png', description: 'Heavy cardboard coasters. Two designs, 4 each.' },
  { id: 'm8', name: '1881 Poster', category: 'Posters', price: 28, badge: 'Limited', color: 'Cream / Ink', sizes: ['18×24'], description: 'Letterpress-inspired print. Heavy cream stock. Limited run of 100.' },
]

export const MERCH_CATEGORIES = ['All', 'Tees', 'Caps', 'Hoodies', 'Bandanas', 'Drinkware', 'Stickers', 'Posters']

export type GalleryItem = {
  id: string
  image: string
  cols: number
  rows: number
}

export const GALLERY: GalleryItem[] = [
  { id: 'g1',  image: '/assets/gallery/cowboy-bar.jpg',     cols: 5, rows: 4 },
  { id: 'g2',  image: '/assets/gallery/performer.jpg',      cols: 4, rows: 4 },
  { id: 'g3',  image: '/assets/gallery/pool-nails.jpg',     cols: 3, rows: 4 },
  { id: 'g4',  image: '/assets/gallery/back-bar-girls.jpg', cols: 5, rows: 3 },
  { id: 'g5',  image: '/assets/gallery/camel-sign.jpg',     cols: 4, rows: 3 },
  { id: 'g6',  image: '/assets/gallery/customer-805.jpg',   cols: 3, rows: 3 },
  { id: 'g7',  image: '/assets/gallery/pool-shot.jpg',      cols: 4, rows: 3 },
  { id: 'g8',  image: '/assets/gallery/cowgirls.jpg',       cols: 4, rows: 3 },
  { id: 'g9',  image: '/assets/gallery/patio-night.jpg',    cols: 4, rows: 3 },
  { id: 'g10', image: '/assets/gallery/dollar-ceiling.jpg', cols: 4, rows: 3 },
  { id: 'g11', image: '/assets/gallery/crowd-stage.jpg',    cols: 4, rows: 3 },
  { id: 'g12', image: '/assets/gallery/pool-table.jpg',     cols: 4, rows: 3 },
  { id: 'g13', image: '/assets/gallery/patio-cigars.jpg',   cols: 4,  rows: 3 },
  { id: 'g14', image: '/assets/gallery/cowboy-pool-2.jpg',  cols: 4,  rows: 3 },
  { id: 'g15', image: '/assets/gallery/boys-at-bar.jpg',    cols: 4,  rows: 3 },
  { id: 'g16', image: '/assets/gallery/car-show.jpg',       cols: 12, rows: 3 },
]

export type InstagramPost = {
  id: string
  image: string
  caption: string
  permalink: string
  /** Days since posted, computed at fetch time. */
  days?: number
  /** Optional — Graph API only exposes this for Business/Creator accounts. */
  likes?: number
}

/**
 * No static IG posts — they used to reuse gallery photos which is misleading.
 * Real posts come from the Instagram Graph API (see src/lib/instagram.ts).
 * If the API isn't configured or fails, the InstagramStrip renders a CTA
 * pointing to the live profile rather than fake content.
 */
export const IG_POSTS: InstagramPost[] = []

export const BOOKING_TYPES = ['Birthday', 'Wedding', 'Rehearsal', 'Corporate', 'Wrap', 'Full Buyout', 'Fundraiser', 'Other']
export const PARTY_SIZES = ['10-20', '20-40', '40-80', '80-150', 'Full Buyout (200)']
