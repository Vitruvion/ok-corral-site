-- ════════════════════════════════════════════════════════════════
-- The OK Corral — Initial seed data
-- Run this AFTER 0001_init.sql in Supabase SQL Editor.
-- Safe to re-run: uses ON CONFLICT to upsert by slug/key.
-- ════════════════════════════════════════════════════════════════

-- ── Events ──────────────────────────────────────────────────────
insert into events (slug, date, weekday, name, support, time, doors, genre, tickets, tags, description, sort_order)
values
  ('dust-devils-2026-05-02', '2026-05-02', 'Saturday', 'Dust Devils',
   'w/ The Low Lonesome & Jenny Rae', '9 PM', '8 PM', 'Country · Outlaw', '$15 · At the Door',
   array['live music','special event'],
   'Reno''s dirtiest honky-tonk four-piece roll into the Corral for one night of outlaw country, whiskey-soaked waltzes, and amp hum that rattles the pool balls. The Low Lonesome opens with acoustic originals and Jenny Rae kicks the night off at 8.',
   1),
  ('line-dance-2026-05-09', '2026-05-09', 'Saturday', 'Line Dance Night',
   'Hosted by Miss Dee · Lessons 7–8 PM', '8 PM', '7 PM', 'Dance · Weekly', 'Free · No Cover',
   array['lessons','no cover'],
   'Beginners welcome. Miss Dee runs lessons from 7 to 8, then the floor opens up. Boots encouraged but not required. Two-steppers, line dancers, and wallflowers all welcome.',
   2),
  ('midnight-rodeo-2026-05-16', '2026-05-16', 'Saturday', 'Midnight Rodeo',
   'DJ Sundown · Vinyl Only', '10 PM', '9 PM', 'DJ · Late', '$10 · Advance',
   array['late night','special event'],
   'One turntable, one man, three hours of rare country, cosmic Americana, and Bakersfield bangers you forgot existed. DJ Sundown spins vinyl only — no laptops, no requests, no apologies.',
   3)
on conflict (slug) do update set
  date = excluded.date, weekday = excluded.weekday, name = excluded.name,
  support = excluded.support, time = excluded.time, doors = excluded.doors,
  genre = excluded.genre, tickets = excluded.tickets, tags = excluded.tags,
  description = excluded.description, sort_order = excluded.sort_order;

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
  -- Signature
  ('Signature', 'Corral Mule',         'Copper mug · ginger · Old Grand-Dad', '$11', 'Old Grand-Dad 100, house ginger syrup, fresh lime, copper mug. The house twist on the mule — more bite than you expect.', 1),
  ('Signature', 'Palomita Picante',    'Mezcal · grapefruit · tajin',         '$11', 'Del Maguey mezcal, grapefruit, lime, tajin rim. Smoke, sour, heat. Drinks like a sunset.', 2),
  ('Signature', 'Dusty Old Fashioned', 'Rye · mesquite honey · bitters',      '$13', 'Rittenhouse rye, mesquite honey, house bitters, big rock. A proper old fashioned with a desert streak.', 3),
  -- Cocktails
  ('Cocktails', 'Margarita',     'Blanco · lime · salt',          '$10', 'The classic. Blanco tequila, fresh lime, agave, salted rim.', 1),
  ('Cocktails', 'Whiskey Sour',  'Bourbon · lemon · egg white',   '$10', 'Bulleit bourbon, lemon, demerara, egg white foam.', 2),
  ('Cocktails', 'Paloma',        'Tequila · grapefruit · soda',   '$10', 'Blanco tequila, grapefruit, lime, soda, salt rim.', 3),
  ('Cocktails', 'Negroni',       'Gin · Campari · sweet vermouth','$12', 'Equal parts. Stirred, not shaken. Orange peel.', 4),
  -- Beer
  ('Beer', 'Coors Banquet',           'The Original',           '$5', 'The yellow-belly. Ice cold.', 1),
  ('Beer', 'Modelo Especial',         '12 oz',                  '$6', 'Always on. Lime on request.', 2),
  ('Beer', 'Sierra Nevada Pale Ale',  'On Draft · Chico, CA',   '$7', 'Local to the neighborhood. Always fresh.', 3),
  ('Beer', 'Lagunitas IPA',           'On Draft',               '$7', 'Hoppy, balanced, dangerous at 6.2%.', 4),
  ('Beer', 'Tecate',                  '24 oz can',              '$5', 'Big can, small price. Lime and salt on request.', 5),
  ('Beer', 'Pacifico',                '12 oz',                  '$6', 'A light, clean Mexican lager.', 6),
  -- Shots
  ('Shots', 'Scorpion Shot',     'House secret',                  '$12', 'See above. Still not telling.', 1),
  ('Shots', 'Jameson',           'Irish whiskey',                 '$7',  'Neat, rocks, or pickle-backed.', 2),
  ('Shots', 'Fernet-Branca',     'The bartender''s handshake',    '$8',  'Bitter, menthol, essential.', 3),
  ('Shots', 'Don Julio Blanco',  'Tequila',                       '$10', 'Clean, citrus-forward, sipping quality.', 4),
  ('Shots', 'Rumple Minze',      'Peppermint schnapps',           '$7',  'Served ice cold. Clears the head.', 5),
  -- Non-Alc
  ('Non-Alc', 'Mexican Coke',     'Glass bottle · cane sugar', '$4', 'Imported. Just better.', 1),
  ('Non-Alc', 'Topo Chico',       'Sparkling mineral water',   '$4', 'With lime wedge.', 2),
  ('Non-Alc', 'Cold Brew',        'House made',                '$5', 'Iced, black, or splash of cream.', 3),
  ('Non-Alc', 'Virgin Mule',      'Ginger · lime · mint',      '$7', 'The Corral Mule, minus the Grand-Dad.', 4),
  ('Non-Alc', 'Fresh Lemonade',   'House squeezed',            '$5', 'Tart, not too sweet. Add a shot if you like.', 5);

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
