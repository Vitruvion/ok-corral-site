-- ════════════════════════════════════════════════════════════════
-- The OK Corral — Initial seed data
-- Run this AFTER 0001_init.sql in Supabase SQL Editor.
-- Safe to re-run: uses ON CONFLICT to upsert by slug/key.
-- ════════════════════════════════════════════════════════════════

-- ── Events ──────────────────────────────────────────────────────
-- eventbrite_url: paste the Eventbrite URL for ticketed shows.
-- Leave it null for free shows — the UI auto-renders a "Free
-- Admission · No Cover" badge when there's no URL.
insert into events (slug, date, weekday, name, support, time, doors, genre, tickets, tags, description, eventbrite_url, sort_order)
values
  ('dust-devils-2026-05-02', '2026-05-02', 'Saturday', 'Dust Devils',
   'w/ The Low Lonesome & Jenny Rae', '9 PM', '8 PM', 'Country · Outlaw', '$15 · Advance',
   array['live music','special event'],
   'Reno''s dirtiest honky-tonk four-piece roll into the Corral for one night of outlaw country, whiskey-soaked waltzes, and amp hum that rattles the pool balls. The Low Lonesome opens with acoustic originals and Jenny Rae kicks the night off at 8.',
   'https://www.eventbrite.com/e/dust-devils-at-the-ok-corral-tickets-PLACEHOLDER',
   1),
  ('line-dance-2026-05-09', '2026-05-09', 'Saturday', 'Line Dance Night',
   'Hosted by Miss Dee · Lessons 7–8 PM', '8 PM', '7 PM', 'Dance · Weekly', 'Free · No Cover',
   array['lessons','no cover'],
   'Beginners welcome. Miss Dee runs lessons from 7 to 8, then the floor opens up. Boots encouraged but not required. Two-steppers, line dancers, and wallflowers all welcome.',
   null,
   2),
  ('midnight-rodeo-2026-05-16', '2026-05-16', 'Saturday', 'Midnight Rodeo',
   'DJ Sundown · Vinyl Only', '10 PM', '9 PM', 'DJ · Late', 'Free · No Cover',
   array['late night','special event'],
   'One turntable, one man, three hours of rare country, cosmic Americana, and Bakersfield bangers you forgot existed. DJ Sundown spins vinyl only — no laptops, no requests, no apologies.',
   null,
   3)
on conflict (slug) do update set
  date = excluded.date, weekday = excluded.weekday, name = excluded.name,
  support = excluded.support, time = excluded.time, doors = excluded.doors,
  genre = excluded.genre, tickets = excluded.tickets, tags = excluded.tags,
  description = excluded.description, eventbrite_url = excluded.eventbrite_url,
  sort_order = excluded.sort_order;

-- ── Recurring Events ────────────────────────────────────────────
delete from recurring_events;
insert into recurring_events (day_abbr, name, support, time, tickets, sort_order)
values
  ('TUE', 'Taco Tuesday',         '$2 tacos, $5 margs, every Tuesday night', 'All Day', 'No Cover', 1),
  ('WED', 'Free Pool Wednesday',  'Tables on the house, all night long',     'All Day', 'No Cover', 2),
  ('SUN', 'Karaoke Night',        'Grab the mic · 6 PM til late',            '6 PM',    'No Cover', 3);

-- ── Drinks ──────────────────────────────────────────────────────
delete from drinks;
insert into drinks (category, name, tagline, price, description, sort_order) values
  -- Saloon Cocktails
  ('Saloon Cocktails', 'Damn Good Old Fashioned', 'Buffalo Trace · bitters · large rock',     '$13', 'Buffalo Trace Bourbon, bitters, demerara sugar, large rock. Simple, done right, and probably the best damn Old Fashioned you''ve had. Ask for it smoked.', 1),
  ('Saloon Cocktails', 'In Cold Blood',           'Rye · Cynar 70 · sweet vermouth',          '$13', 'Rittenhouse 100 Rye, Cynar 70, sweet vermouth, large rock, expressed orange. Bitter, bold, with just a touch of sweetness.', 2),
  ('Saloon Cocktails', 'Outlaw Vesper Martini',   'Amass Gin · vodka · Lillet Blanc',         '$14', 'Our take on the Bond classic. Amass Gin, vodka, Lillet Blanc, expressed lemon, served up.', 3),
  ('Saloon Cocktails', 'Giddy Up',                'Vodka · Kahlúa · cold brew',               '$7',  'Happy Cow Vodka, Kahlúa, cold brew, served over ice. Easy drinkin'' pick-me-up.', 4),
  ('Saloon Cocktails', 'Dive Bar Spritz',         'High Life · Aperol · lemon',               '$6',  'Miller High Life bottle, Aperol, fresh lemon.', 5),
  -- Shots & Bombs
  ('Shots & Bombs', 'Smoked Steak Shot', 'Jameson · Worcestershire · black pepper', '$8', 'Jameson, chased with smoked Worcestershire and cracked black pepper.', 1),
  ('Shots & Bombs', 'Scorpion Shooter',  '+$3 add-on to any shot',                  '$3', 'Add an edible scorpion to any shot.', 2),
  ('Shots & Bombs', 'Bull Dozer',        'Jäger · Red Bull',                        '$8', 'Jägermeister & Red Bull in a double shot glass.', 3),
  ('Shots & Bombs', 'Iceberg',           'Vodka · triple sec · Red Bull',           '$9', 'Vodka, triple sec, lime, topped with Coconut Berry Red Bull.', 4),
  -- Featured Beer
  ('Featured Beer', 'I''m Your Hucklebeer', 'Woody''s Brewing collab · huckleberry wheat', '$7', 'Exclusive collab with Woody''s Brewing Company. Huckleberry Wheat Ale • 5.2% ABV • 20 IBU. Only available at The OK Corral.', 1);

-- ── Merch ───────────────────────────────────────────────────────
insert into merch (slug, name, category, price, badge, color, sizes, image_url, image_bg, description, sort_order)
values
  ('house-tee-black',         'House Tee — Black',           'Tees',       32, 'New',         'Vintage Black',   array['S','M','L','XL','XXL'],   '/assets/merch/tee-black-back.png',     null,   'Standard fit, ring-spun cotton. Screenprinted front and back. Washed for softness.', 1),
  ('house-tee-white',         'House Tee — White',           'Tees',       32, 'New',         'Bone White',      array['S','M','L','XL','XXL'],   '/assets/merch/tee-white-back.png',     null,   'Same cut as the black. Cream white, soft hand print.', 2),
  ('saloon-cap',              'Saloon Cap',                  'Caps',       38, null,          'Sand / Ember',    array['One Size'],               null,                                   null,   'Unstructured 5-panel. Embroidered wordmark. Adjustable leather strap.', 3),
  ('crossed-boots-hoodie',    'Crossed Boots Hoodie',        'Hoodies',    68, 'Small Batch', 'Washed Ink',      array['S','M','L','XL'],         null,                                   null,   'Heavyweight French terry. Crossed-boots graphic back print. Kangaroo pocket.', 4),
  ('ember-bandana',           'Ember Bandana',               'Bandanas',   18, null,          'Bone / Ember',    array['One Size'],               null,                                   null,   'All-over western print. 22×22 cotton. Trail-ready.', 5),
  ('ok-pint-glass',           'OK Pint Glass',               'Drinkware',  14, null,          'Clear',           array['Single','4-Pack'],        null,                                   null,   'Heavy-base 16oz pint. Etched wordmark. Dishwasher safe.', 6),
  ('koozie-set-4',            'Koozie Set (4)',              'Drinkware',  22, null,          'Assorted',        array['Set of 4'],               null,                                   null,   'Neoprene can koozies. Four designs. Keeps em cold.', 7),
  ('hucklebeer-sticker',      'I''m Your Hucklebeer Sticker','Stickers',    5, null,          'Full Color',      array['4-inch'],                 '/assets/merch/sticker-hucklebeer.png', 'bone', 'Vinyl die-cut. Weather resistant. Laptop, bumper, cooler.', 8),
  ('saloon-sign-sticker',     'Saloon Sign Sticker',         'Stickers',    5, null,          'Full Color',      array['4.5-inch'],               '/assets/merch/sticker-sign.png',       'bone', 'Classic saloon sign design. Die-cut vinyl.', 9),
  ('ok-coaster-set-8',        'OK Coaster Set (8)',          'Drinkware',  12, null,          'Black / White',   array['Set of 8'],               '/assets/merch/sticker-coaster.png',    'bone', 'Heavy cardboard coasters. Two designs, 4 each.', 10),
  ('1881-poster',             '1881 Poster',                 'Posters',    28, 'Limited',     'Cream / Ink',     array['18×24'],                  null,                                   null,   'Letterpress-inspired print. Heavy cream stock. Limited run of 100.', 11)
on conflict (slug) do update set
  name = excluded.name, category = excluded.category, price = excluded.price,
  badge = excluded.badge, color = excluded.color, sizes = excluded.sizes,
  image_url = excluded.image_url, image_bg = excluded.image_bg,
  description = excluded.description, sort_order = excluded.sort_order;

-- ── Site settings ───────────────────────────────────────────────
insert into site_settings (key, value) values
  ('hours',   '{"mon":"8 AM – 2 AM","tue":"8 AM – 2 AM","wed":"8 AM – 2 AM","thu":"8 AM – 2 AM","fri":"8 AM – 2 AM","sat":"8 AM – 2 AM","sun":"8 AM – 2 AM"}'::jsonb),
  ('contact', '{"phone":"(530) 348-2062","email":"howdy@okcorralsaloon.com","instagram":"okcorralsaloon"}'::jsonb)
on conflict (key) do update set value = excluded.value;
