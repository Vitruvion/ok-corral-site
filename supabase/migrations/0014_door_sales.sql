-- ================================================================
-- 0014 - door sales
--
-- Phase 3. A door sale is a TALLY, not a ticket: it records that
-- someone paid at the door and how, and issues no ticket row, no QR
-- and no email.
--
-- THE MONEY DOES NOT MOVE THROUGH THIS CODE. Card payments are rung
-- on the bar's existing Square POS and cash goes in the register.
-- Nothing here processes a payment, and nothing here should ever be
-- extended to.
--
-- Almost everything a door sale needs already exists from 0012, which
-- was built with this phase in mind:
--
--   channel            'door'
--   payment_method     'square' | 'cash'
--   purchaser_*        all nullable - a cash sale has no name
--   stripe_session_id  nullable, with a PARTIAL unique index, so any
--                      number of door rows share a NULL
--
-- This migration adds the one missing column and the index the new
-- occupancy count needs.
--
-- Idempotent; safe to re-run. Must run after 0012.
-- ================================================================

-- Which phone rang the sale. Nullable: rows written before this
-- column existed have no answer, and inventing one would be worse
-- than admitting it. Only matters if a second device is ever added.
alter table ticket_orders
  add column if not exists door_device text;

-- ---------------------------------------------------------------
-- Occupancy
--
-- A door admission consumes a seat exactly as an online ticket does,
-- so "how full is this show" is now:
--
--   (non-void rows in tickets)
--   + (sum of quantity over PAID DOOR orders)
--
-- Only the door half comes from ticket_orders. Online orders are
-- deliberately NOT summed: they issue rows in `tickets`, and counting
-- both would double every online seat.
--
-- This index is what that sum reads.
-- ---------------------------------------------------------------
create index if not exists ticket_orders_occupancy_idx
  on ticket_orders (event_id, channel, status);

-- ---------------------------------------------------------------
-- A note on what is NOT constrained here
--
-- Nothing stops a door sale pushing an event past ticket_capacity,
-- and that is deliberate. ticket_capacity is a business decision per
-- show, not a legal occupancy limit - the venue has no recorded
-- maximum. Going over is a call the person on the door makes with the
-- room in front of them, and a database constraint cannot make that
-- call. The UI shows the figure and gets out of the way.
-- ---------------------------------------------------------------
