-- ================================================================
-- 0010 - Cigars category
--
-- Name and price only: no taglines, no descriptions. The menu board
-- and the homepage both render those fields conditionally, so a null
-- produces no empty element.
--
-- Price format matches every existing row in the drinks table:
-- text, leading dollar sign, no decimals (verified against live data
-- - '$13', '$10', '$3' ...). Do not change to bare numbers without
-- migrating the other 15 rows too.
--
-- sort_order is per-category and 1-based, matching the other
-- categories after migration 0009's backfill.
--
-- Deliberately does NOT reference updated_at, so this can be applied
-- before or after 0009 without caring which ran first.
--
-- Idempotent: the whole insert is skipped if any Cigars row already
-- exists, so re-running can't duplicate the list.
-- ================================================================

insert into drinks (category, name, tagline, price, description, active, sort_order)
select *
  from (values
    ('Cigars', 'Cao Fasa Noche',               null::text, '$11', null::text, true, 1),
    ('Cigars', 'Factory 49 Sweet',             null::text, '$4',  null::text, true, 2),
    ('Cigars', 'La Aroma de Cuba Mi Amor',     null::text, '$16', null::text, true, 3),
    ('Cigars', 'Payback',                      null::text, '$11', null::text, true, 4),
    ('Cigars', 'Project 40 Toro',              null::text, '$11', null::text, true, 5),
    ('Cigars', 'Rocky Patel Seed to Smoke',    null::text, '$6',  null::text, true, 6),
    ('Cigars', 'Romeo Y Julieta Reserva Real', null::text, '$15', null::text, true, 7),
    ('Cigars', 'Sweet Jane',                   null::text, '$5',  null::text, true, 8),
    ('Cigars', 'Dominicana',                   null::text, '$5',  null::text, true, 9),
    ('Cigars', 'Java',                         null::text, '$23', null::text, true, 10),
    ('Cigars', 'Chillin'' Moose Toro',         null::text, '$8',  null::text, true, 11)
  ) as v(category, name, tagline, price, description, active, sort_order)
 where not exists (select 1 from drinks where category = 'Cigars');
