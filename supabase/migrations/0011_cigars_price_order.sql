-- ================================================================
-- 0011 - Cigars: reorder by price descending, ties alphabetical
--
-- Updates sort_order on existing Cigars rows only. No inserts, no
-- deletes, and nothing outside category = 'Cigars' is touched: every
-- row is matched on BOTH name and category, so a same-named drink in
-- another category cannot be caught by this.
--
-- The order is written out literally rather than computed from price,
-- because price is TEXT with a leading dollar sign ('$23', '$5'), and
-- sorting that as text puts '$5' above '$23'. Casting around that in
-- SQL would be more fragile than just stating the intended order.
--
-- Idempotent: the `is distinct from` guard means a second run matches
-- no rows and changes nothing.
--
-- Deliberately does NOT reference updated_at, so this can be applied
-- regardless of whether 0009 has run.
-- ================================================================

update drinks d
   set sort_order = v.sort_order
  from (values
    ('Java',                         1),
    ('La Aroma de Cuba Mi Amor',     2),
    ('Romeo Y Julieta Reserva Real', 3),
    ('Cao Fasa Noche',               4),
    ('Payback',                      5),
    ('Project 40 Toro',              6),
    ('Chillin'' Moose Toro',         7),
    ('Rocky Patel Seed to Smoke',    8),
    ('Dominicana',                   9),
    ('Sweet Jane',                  10),
    ('Factory 49 Sweet',            11)
  ) as v(name, sort_order)
 where d.category = 'Cigars'
   and d.name = v.name
   and d.sort_order is distinct from v.sort_order;
