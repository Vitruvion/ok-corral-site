/* ═══════════════════════════════════════════════════
   OK CORRAL — Site Data
   All editable content lives here. Later this moves
   to Supabase tables, but for now it's a single file
   you can update and redeploy.
   ═══════════════════════════════════════════════════ */

export const BRAND = {
  name: 'The OK Corral',
  location: 'Cottonwood, California',
  since: 'Est. 2025',
  tagline: 'Home of the Scorpion Shot',
  address: {
    line1: '3633 Main Street',
    line2: 'Cottonwood, CA 96022',
  },
  phone: '(530) 348-2062',
  phoneHref: 'tel:5303482062',
  email: 'howdy@okcorralsaloon.com',
  instagram: 'okcorralsaloon',
  instagramUrl: 'https://instagram.com/okcorralsaloon',
  mapsUrl: 'https://www.google.com/maps/dir/?api=1&destination=3633+Main+Street,+Cottonwood,+CA+96022',
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
  { label: 'Merch',    href: '#merch' },
  { label: 'Gallery',  href: '#gallery' },
  { label: 'Bookings', href: '#bookings' },
  { label: 'Visit',    href: '#visit' },
]

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
}

export const EVENTS: EventData[] = [
  {
    id: 'ev1',
    date: 'May 02 2026',
    weekday: 'Saturday',
    name: 'Dust Devils',
    support: 'w/ The Low Lonesome & Jenny Rae',
    time: '9 PM',
    doors: '8 PM',
    genre: 'Country · Outlaw',
    tickets: '$15 · At the Door',
    tags: ['live music', 'special event'],
    description: "Reno's dirtiest honky-tonk four-piece roll into the Corral for one night of outlaw country, whiskey-soaked waltzes, and amp hum that rattles the pool balls. The Low Lonesome opens with acoustic originals and Jenny Rae kicks the night off at 8.",
  },
  {
    id: 'ev2',
    date: 'May 09 2026',
    weekday: 'Saturday',
    name: 'Line Dance Night',
    support: 'Hosted by Miss Dee · Lessons 7–8 PM',
    time: '8 PM',
    doors: '7 PM',
    genre: 'Dance · Weekly',
    tickets: 'Free · No Cover',
    tags: ['lessons', 'no cover'],
    description: "Beginners welcome. Miss Dee runs lessons from 7 to 8, then the floor opens up. Boots encouraged but not required. Two-steppers, line dancers, and wallflowers all welcome.",
  },
  {
    id: 'ev3',
    date: 'May 16 2026',
    weekday: 'Saturday',
    name: 'Midnight Rodeo',
    support: 'DJ Sundown · Vinyl Only',
    time: '10 PM',
    doors: '9 PM',
    genre: 'DJ · Late',
    tickets: '$10 · Advance',
    tags: ['late night', 'special event'],
    description: "One turntable, one man, three hours of rare country, cosmic Americana, and Bakersfield bangers you forgot existed. DJ Sundown spins vinyl only — no laptops, no requests, no apologies.",
  },
]

export const RECURRING = [
  {
    day: 'TUE',
    name: 'Taco Tuesday',
    support: '$2 tacos, $5 margs, every Tuesday night',
    time: 'All Day',
    tickets: 'No Cover',
  },
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
  { text: 'Every Tuesday', accent: 'Taco Tuesday · $2 Tacos' },
  { text: 'Every Wednesday', accent: 'Free Pool All Night' },
  { text: 'Every Sunday', accent: 'Karaoke Til Close' },
  { text: 'Open Daily', accent: '8 AM · Til 2 AM' },
]

export type DrinkData = {
  name: string
  tagline: string
  price: string
  description: string
}

export const DRINKS: Record<string, DrinkData[]> = {
  Signature: [
    { name: 'Corral Mule', tagline: 'Copper mug · ginger · Old Grand-Dad', price: '$11', description: 'Old Grand-Dad 100, house ginger syrup, fresh lime, copper mug. The house twist on the mule — more bite than you expect.' },
    { name: 'Palomita Picante', tagline: 'Mezcal · grapefruit · tajin', price: '$11', description: 'Del Maguey mezcal, grapefruit, lime, tajin rim. Smoke, sour, heat. Drinks like a sunset.' },
    { name: 'Dusty Old Fashioned', tagline: 'Rye · mesquite honey · bitters', price: '$13', description: 'Rittenhouse rye, mesquite honey, house bitters, big rock. A proper old fashioned with a desert streak.' },
  ],
  Cocktails: [
    { name: 'Margarita', tagline: 'Blanco · lime · salt', price: '$10', description: 'The classic. Blanco tequila, fresh lime, agave, salted rim.' },
    { name: 'Whiskey Sour', tagline: 'Bourbon · lemon · egg white', price: '$10', description: 'Bulleit bourbon, lemon, demerara, egg white foam.' },
    { name: 'Paloma', tagline: 'Tequila · grapefruit · soda', price: '$10', description: 'Blanco tequila, grapefruit, lime, soda, salt rim.' },
    { name: 'Negroni', tagline: 'Gin · Campari · sweet vermouth', price: '$12', description: 'Equal parts. Stirred, not shaken. Orange peel.' },
  ],
  Beer: [
    { name: 'Coors Banquet', tagline: 'The Original', price: '$5', description: 'The yellow-belly. Ice cold.' },
    { name: 'Modelo Especial', tagline: '12 oz', price: '$6', description: 'Always on. Lime on request.' },
    { name: 'Sierra Nevada Pale Ale', tagline: 'On Draft · Chico, CA', price: '$7', description: 'Local to the neighborhood. Always fresh.' },
    { name: 'Lagunitas IPA', tagline: 'On Draft', price: '$7', description: 'Hoppy, balanced, dangerous at 6.2%.' },
    { name: 'Tecate', tagline: '24 oz can', price: '$5', description: 'Big can, small price. Lime and salt on request.' },
    { name: 'Pacifico', tagline: '12 oz', price: '$6', description: 'A light, clean Mexican lager.' },
  ],
  Shots: [
    { name: 'Scorpion Shot', tagline: 'House secret', price: '$12', description: 'See above. Still not telling.' },
    { name: 'Jameson', tagline: 'Irish whiskey', price: '$7', description: 'Neat, rocks, or pickle-backed.' },
    { name: 'Fernet-Branca', tagline: "The bartender's handshake", price: '$8', description: 'Bitter, menthol, essential.' },
    { name: 'Don Julio Blanco', tagline: 'Tequila', price: '$10', description: 'Clean, citrus-forward, sipping quality.' },
    { name: 'Rumple Minze', tagline: 'Peppermint schnapps', price: '$7', description: 'Served ice cold. Clears the head.' },
  ],
  'Non-Alc': [
    { name: 'Mexican Coke', tagline: 'Glass bottle · cane sugar', price: '$4', description: 'Imported. Just better.' },
    { name: 'Topo Chico', tagline: 'Sparkling mineral water', price: '$4', description: 'With lime wedge.' },
    { name: 'Cold Brew', tagline: 'House made', price: '$5', description: 'Iced, black, or splash of cream.' },
    { name: 'Virgin Mule', tagline: 'Ginger · lime · mint', price: '$7', description: 'The Corral Mule, minus the Grand-Dad.' },
    { name: 'Fresh Lemonade', tagline: 'House squeezed', price: '$5', description: 'Tart, not too sweet. Add a shot if you like.' },
  ],
}

export const DRINK_TABS = ['Signature', 'Cocktails', 'Beer', 'Shots', 'Non-Alc']

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
  label: string
  image: string
  cols: number
  rows: number
}

export const GALLERY: GalleryItem[] = [
  { id: 'g1',  label: 'Cowboy Up · At The Bar',   image: '/assets/gallery/cowboy-bar.jpg',     cols: 5, rows: 4 },
  { id: 'g2',  label: 'Live · Camo Cali',          image: '/assets/gallery/performer.jpg',      cols: 4, rows: 4 },
  { id: 'g3',  label: 'Pool Night',                 image: '/assets/gallery/pool-nails.jpg',     cols: 3, rows: 4 },
  { id: 'g4',  label: 'Back Bar',                   image: '/assets/gallery/back-bar-girls.jpg', cols: 5, rows: 3 },
  { id: 'g5',  label: 'Camel Day · Under The Sign', image: '/assets/gallery/camel-sign.jpg',     cols: 4, rows: 3 },
  { id: 'g6',  label: 'Regulars',                   image: '/assets/gallery/customer-805.jpg',   cols: 3, rows: 3 },
  { id: 'g7',  label: 'Break Shot',                 image: '/assets/gallery/pool-shot.jpg',      cols: 4, rows: 3 },
  { id: 'g8',  label: 'Saturday Night',             image: '/assets/gallery/cowgirls.jpg',       cols: 4, rows: 3 },
  { id: 'g9',  label: 'Cold One',                   image: '/assets/gallery/beer-man.jpg',       cols: 4, rows: 3 },
  { id: 'g10', label: 'Dollar Bill Ceiling',         image: '/assets/gallery/dollar-ceiling.jpg', cols: 4, rows: 3 },
  { id: 'g11', label: 'The Crowd · Show Night',     image: '/assets/gallery/crowd-stage.jpg',    cols: 4, rows: 3 },
  { id: 'g12', label: 'Pool Table · 805 Neon',      image: '/assets/gallery/pool-table.jpg',     cols: 4, rows: 3 },
  { id: 'g13', label: 'Car Show · Out Front',       image: '/assets/gallery/car-show.jpg',       cols: 12, rows: 3 },
  { id: 'g14', label: 'Patio · Cigars & Cold Ones',  image: '/assets/gallery/patio-cigars.jpg',   cols: 4,  rows: 3 },
  { id: 'g15', label: 'Rack Em Up · 805 Neon',       image: '/assets/gallery/cowboy-pool-2.jpg',  cols: 4,  rows: 3 },
  { id: 'g16', label: 'The Boys · Behind The Bar',   image: '/assets/gallery/boys-at-bar.jpg',    cols: 4,  rows: 3 },
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
