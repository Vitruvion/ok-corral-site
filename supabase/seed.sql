-- ================================================================
-- The OK Corral - Initial seed data
-- Run this AFTER 0001_init.sql in Supabase SQL Editor.
-- Safe to re-run: uses ON CONFLICT to upsert by slug/key.
--
-- -- ENCODING NOTICE ---------------------------------------------
-- This file contains UTF-8 characters: . (interpunct), - (en dash),
-- - (em dash), ' (curly apostrophe), ? ? ? ? ? (accented letters).
-- When pasting into the Supabase SQL editor, copy from a UTF-8
-- source (VSCode, GitHub raw view) - NOT from a Word/Notes app that
-- might re-encode the text. The SET below forces the server to
-- interpret incoming bytes as UTF-8 regardless of session default,
-- and the file itself has no BOM (Supabase rejects BOM).
--
-- If you previously seeded with mojibake (?. instead of ., etc.),
-- just re-paste this file - the ON CONFLICT DO UPDATE rewrites
-- every affected column with clean bytes.
-- ================================================================
set client_encoding to E'UTF8';

-- -- Events ------------------------------------------------------
-- eventbrite_url: paste the Eventbrite URL for ticketed shows.
-- Leave it null for free shows - the UI auto-renders a "Free
-- Admission . No Cover" badge when there's no URL.
--
-- Old placeholder events (dust-devils, line-dance, midnight-rodeo)
-- are deactivated below so they stop showing without losing history.
update events set active = false where slug in (
  E'dust-devils-2026-05-02',
  E'line-dance-2026-05-09',
  E'midnight-rodeo-2026-05-16'
);

-- Headline show: Dustin Dale Gaspard with Tanner Bingaman.
-- featured = true triggers auto-expand on page load.
-- related_links is a jsonb array; the UI linkifies any matching name in
-- the support/description text and renders an optional sidebar thumbnail.
insert into events (
  slug, date, weekday, name, support, time, doors, genre, tickets, tags,
  description, eventbrite_url, poster_url, featured, related_links, sort_order
)
values
  (
    E'dustin-gaspard-2026-06-25',
    E'2026-06-25',
    E'Thursday',
    E'Dustin Dale Gaspard',
    E'w/ Tanner Bingaman \u00B7 8:30 PM',
    E'9 PM',
    E'',
    E'Alternative Folk \u00B7 Cajun',
    E'$13',
    array[E'live music', E'special event', E'ticketed', E'the voice'],
    E'Singer-songwriter Dustin Dale Gaspard of Cow Island, Louisiana brings his alternative folk sound to The OK Corral for one unforgettable night. A Season 28 contestant on NBC''s The Voice, Dustin is born and raised in deep Southern Louisiana \u2014 his music is steeped in Cajun soul, raw storytelling, and a voice that fills every corner of the room. Opening the night at 8:30 is Tanner Bingaman \u2014 a songwriter, banjoist, and poet from the hills of Appalachia. Featured on NPR, awarded Emerging Artist of the Year by the Susquehanna Folk Music Society, and currently touring with Dustin on a 10,000-mile run down the West Coast. Two artists, one stage, one hell of a Thursday night.',
    E'https://www.eventbrite.com/e/dustin-dale-gaspard-tickets-1989628449251?aff=oddtdtcreator',
    E'/assets/gallery/dustin-gaspard.jpg',
    true,
    E'[{"name":"Tanner Bingaman","url":"https://tannerbingaman.com/","image":"/assets/gallery/tanner-bingaman.jpg","role":"Support \u00B7 8:30 PM"}]'::jsonb,
    1
  )
on conflict (slug) do update set
  date = excluded.date, weekday = excluded.weekday, name = excluded.name,
  support = excluded.support, time = excluded.time, doors = excluded.doors,
  genre = excluded.genre, tickets = excluded.tickets, tags = excluded.tags,
  description = excluded.description, eventbrite_url = excluded.eventbrite_url,
  poster_url = excluded.poster_url, featured = excluded.featured,
  related_links = excluded.related_links, active = true,
  sort_order = excluded.sort_order;

-- Ensure no other event is marked featured (the partial unique index in
-- migration 0004 enforces this, but this is belt-and-suspenders).
update events set featured = false where slug <> E'dustin-gaspard-2026-06-25';

-- -- Recurring Events --------------------------------------------
delete from recurring_events;
insert into recurring_events (day_abbr, name, support, time, tickets, sort_order)
values
  (E'TUE', E'Taco Tuesday',         E'$4 tacos every Tuesday night', E'All Day', E'No Cover', 1),
  (E'WED', E'Free Pool Wednesday',  E'Tables on the house, all night long',     E'All Day', E'No Cover', 2),
  (E'SUN', E'Karaoke Night',        E'Grab the mic \u00B7 6 PM til late',            E'6 PM',    E'No Cover', 3);

-- -- Drinks ------------------------------------------------------
delete from drinks;
insert into drinks (category, name, tagline, price, description, sort_order) values
  -- Saloon Cocktails
  (E'Saloon Cocktails', E'Damn Good Old Fashioned', E'Buffalo Trace \u00B7 bitters \u00B7 large rock',     E'$13', E'Buffalo Trace Bourbon, bitters, demerara sugar, large rock. Simple, done right, and probably the best damn Old Fashioned you''ve had. Ask for it smoked.', 1),
  (E'Saloon Cocktails', E'In Cold Blood',           E'Rye \u00B7 Cynar 70 \u00B7 sweet vermouth',          E'$13', E'Rittenhouse 100 Rye, Cynar 70, sweet vermouth, large rock, expressed orange. Bitter, bold, with just a touch of sweetness.', 2),
  (E'Saloon Cocktails', E'Outlaw Vesper Martini',   E'Amass Gin \u00B7 vodka \u00B7 Lillet Blanc',         E'$14', E'Our take on the Bond classic. Amass Gin, vodka, Lillet Blanc, expressed lemon, served up.', 3),
  (E'Saloon Cocktails', E'Giddy Up',                E'Vodka \u00B7 Kahl\u00FAa \u00B7 cold brew',               E'$7',  E'Happy Cow Vodka, Kahl\u00FAa, cold brew, served over ice. Easy drinkin'' pick-me-up.', 4),
  (E'Saloon Cocktails', E'Dive Bar Spritz',         E'High Life \u00B7 Aperol \u00B7 lemon',               E'$6',  E'Miller High Life bottle, Aperol, fresh lemon.', 5),
  -- Shots & Bombs
  (E'Shots & Bombs', E'Smoked Steak Shot', E'Jameson \u00B7 Worcestershire \u00B7 black pepper', E'$8', E'Jameson, chased with smoked Worcestershire and cracked black pepper.', 1),
  (E'Shots & Bombs', E'Scorpion Shooter',  E'+$3 add-on to any shot',                  E'$3', E'Add an edible scorpion to any shot.', 2),
  (E'Shots & Bombs', E'Bull Dozer',        E'J\u00E4ger \u00B7 Red Bull',                        E'$8', E'J\u00E4germeister & Red Bull in a double shot glass.', 3),
  (E'Shots & Bombs', E'Iceberg',           E'Vodka \u00B7 triple sec \u00B7 Red Bull',           E'$9', E'Vodka, triple sec, lime, topped with Coconut Berry Red Bull.', 4),
  -- Featured Beer
  (E'Featured Beer', E'I''m Your Hucklebeer', E'Woody''s Brewing collab \u00B7 huckleberry wheat', E'$7', E'Exclusive collab with Woody''s Brewing Company. Huckleberry Wheat Ale \u2022 5.2% ABV \u2022 20 IBU. Only available at The OK Corral.', 1);

-- -- Merch -------------------------------------------------------
insert into merch (slug, name, category, price, badge, color, sizes, image_url, image_bg, description, sort_order)
values
  (E'house-tee-black',         E'House Tee \u2014 Black',           E'Tees',       32, E'New',         E'Vintage Black',   array[E'S',E'M',E'L',E'XL',E'XXL'],   E'/assets/merch/tee-black-back.png',     null,   E'Standard fit, ring-spun cotton. Screenprinted front and back. Washed for softness.', 1),
  (E'house-tee-white',         E'House Tee \u2014 White',           E'Tees',       32, E'New',         E'Bone White',      array[E'S',E'M',E'L',E'XL',E'XXL'],   E'/assets/merch/tee-white-back.png',     null,   E'Same cut as the black. Cream white, soft hand print.', 2),
  (E'saloon-cap',              E'Saloon Cap',                  E'Caps',       38, null,          E'Sand / Ember',    array[E'One Size'],               null,                                   null,   E'Unstructured 5-panel. Embroidered wordmark. Adjustable leather strap.', 3),
  (E'crossed-boots-hoodie',    E'Crossed Boots Hoodie',        E'Hoodies',    68, E'Small Batch', E'Washed Ink',      array[E'S',E'M',E'L',E'XL'],         null,                                   null,   E'Heavyweight French terry. Crossed-boots graphic back print. Kangaroo pocket.', 4),
  (E'ember-bandana',           E'Ember Bandana',               E'Bandanas',   18, null,          E'Bone / Ember',    array[E'One Size'],               null,                                   null,   E'All-over western print. 22\u00D722 cotton. Trail-ready.', 5),
  (E'ok-pint-glass',           E'OK Pint Glass',               E'Drinkware',  14, null,          E'Clear',           array[E'Single',E'4-Pack'],        null,                                   null,   E'Heavy-base 16oz pint. Etched wordmark. Dishwasher safe.', 6),
  (E'koozie-set-4',            E'Koozie Set (4)',              E'Drinkware',  22, null,          E'Assorted',        array[E'Set of 4'],               null,                                   null,   E'Neoprene can koozies. Four designs. Keeps em cold.', 7),
  (E'hucklebeer-sticker',      E'I''m Your Hucklebeer Sticker',E'Stickers',    5, null,          E'Full Color',      array[E'4-inch'],                 E'/assets/merch/sticker-hucklebeer.png', E'bone', E'Vinyl die-cut. Weather resistant. Laptop, bumper, cooler.', 8),
  (E'saloon-sign-sticker',     E'Saloon Sign Sticker',         E'Stickers',    5, null,          E'Full Color',      array[E'4.5-inch'],               E'/assets/merch/sticker-sign.png',       E'bone', E'Classic saloon sign design. Die-cut vinyl.', 9),
  (E'ok-coaster-set-8',        E'OK Coaster Set (8)',          E'Drinkware',  12, null,          E'Black / White',   array[E'Set of 8'],               E'/assets/merch/sticker-coaster.png',    E'bone', E'Heavy cardboard coasters. Two designs, 4 each.', 10),
  (E'1881-poster',             E'1881 Poster',                 E'Posters',    28, E'Limited',     E'Cream / Ink',     array[E'18\u00D724'],                  null,                                   null,   E'Letterpress-inspired print. Heavy cream stock. Limited run of 100.', 11)
on conflict (slug) do update set
  name = excluded.name, category = excluded.category, price = excluded.price,
  badge = excluded.badge, color = excluded.color, sizes = excluded.sizes,
  image_url = excluded.image_url, image_bg = excluded.image_bg,
  description = excluded.description, sort_order = excluded.sort_order;

-- -- Site settings -----------------------------------------------
insert into site_settings (key, value) values
  (E'hours',   E'{"mon":"8 AM \u2013 2 AM","tue":"8 AM \u2013 2 AM","wed":"8 AM \u2013 2 AM","thu":"8 AM \u2013 2 AM","fri":"8 AM \u2013 2 AM","sat":"8 AM \u2013 2 AM","sun":"8 AM \u2013 2 AM"}'::jsonb),
  (E'contact', E'{"phone":"(530) 348-2062","email":"howdy@okcorralsaloon.com","instagram":"okcorralsaloon"}'::jsonb)
on conflict (key) do update set value = excluded.value;
