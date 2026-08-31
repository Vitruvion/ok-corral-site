-- ================================================================
-- 0012 - ticketing: sell tickets directly, replacing Eventbrite
--
-- Phase 1 of three. This migration covers online sales only, but the
-- shape is deliberately wide enough for the phases that follow so
-- neither needs a schema change:
--
--   Phase 2 - door scanner  : tickets.status / used_at / used_by
--   Phase 3 - door sales    : ticket_orders.channel / payment_method,
--                             and a NULLABLE stripe_session_id
--
-- DOOR PAYMENTS DO NOT FLOW THROUGH THIS SCHEMA. Card payments at the
-- door go through the bar's existing Square POS, rung as an item. The
-- door app will only RECORD that a ticket was sold and how it was
-- paid; the money moves through Square independently. There is no
-- Stripe Terminal anywhere in this design.
--
-- TENANT_ID: every new table carries tenant_id even though there is
-- exactly one tenant today, defaulting to the Corral's id. This code
-- is expected to be extracted into a multi-tenant product later, and
-- retrofitting a tenant key onto live order and ticket rows is far
-- worse than carrying an unused column now.
--
-- Idempotent; safe to re-run.
-- ================================================================

-- ---------------------------------------------------------------
-- events: ticket sale configuration
--
-- All nullable / defaulted so existing rows are untouched. An event
-- with tickets_on_sale = false behaves exactly as it does today,
-- including its eventbrite_url. The cutover is one show at a time.
-- ---------------------------------------------------------------

-- Null means this event does not sell tickets through the site.
alter table events
  add column if not exists ticket_price numeric;

-- Null means unlimited. A number is a hard cap on non-void tickets.
alter table events
  add column if not exists ticket_capacity integer;

-- The master switch. False (the default) = Eventbrite / free entry,
-- exactly as before.
alter table events
  add column if not exists tickets_on_sale boolean not null default false;

-- Short line shown at checkout - refund policy, age limits, whatever
-- the show needs said before someone pays.
alter table events
  add column if not exists ticket_blurb text;

-- A price of zero would let someone "buy" a free ticket and charge
-- nothing through Stripe, which fails at the Stripe end anyway. Keep
-- it out of the data instead.
alter table events
  drop constraint if exists events_ticket_price_check;

alter table events
  add constraint events_ticket_price_check
  check (ticket_price is null or ticket_price > 0);

alter table events
  drop constraint if exists events_ticket_capacity_check;

alter table events
  add constraint events_ticket_capacity_check
  check (ticket_capacity is null or ticket_capacity > 0);

-- ---------------------------------------------------------------
-- ticket_orders: one row per purchase, online or at the door
-- ---------------------------------------------------------------
create table if not exists ticket_orders (
  id                 uuid default gen_random_uuid() primary key,
  tenant_id          uuid not null default E'a8ad9286-f33d-4c89-8f2f-2ec1347a798c',
  event_id           uuid not null references events (id) on delete restrict,

  -- NULLABLE on purpose. A door sale in Phase 3 has no Stripe session
  -- at all. Uniqueness is enforced by a PARTIAL index below rather
  -- than a column constraint, because a plain UNIQUE would still be
  -- satisfied by many nulls in Postgres but would also block the
  -- clearer intent - see the index comment.
  stripe_session_id  text,

  channel            text not null default E'online',
  payment_method     text not null default E'stripe',

  -- All nullable: a cash sale at the door may have no name, no email
  -- and no phone. Online orders always have at least an email.
  purchaser_name     text,
  purchaser_email    text,
  purchaser_phone    text,

  quantity           integer not null,

  -- Snapshot of events.ticket_price at purchase time. Prices change;
  -- what someone actually paid must not.
  unit_price         numeric not null,
  subtotal           numeric not null,
  fees               numeric not null default 0,
  total              numeric not null,

  status             text not null default E'pending',
  marketing_opt_in   boolean not null default false,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Phase 1 only ever writes 'online' / 'stripe'. The other values are
-- accepted now so Phase 3 needs no migration.
alter table ticket_orders
  drop constraint if exists ticket_orders_channel_check;

alter table ticket_orders
  add constraint ticket_orders_channel_check
  check (channel in (E'online', E'door'));

alter table ticket_orders
  drop constraint if exists ticket_orders_payment_method_check;

alter table ticket_orders
  add constraint ticket_orders_payment_method_check
  check (payment_method in (E'stripe', E'square', E'cash', E'comp'));

alter table ticket_orders
  drop constraint if exists ticket_orders_status_check;

alter table ticket_orders
  add constraint ticket_orders_status_check
  check (status in (E'pending', E'paid', E'refunded'));

alter table ticket_orders
  drop constraint if exists ticket_orders_quantity_check;

alter table ticket_orders
  add constraint ticket_orders_quantity_check
  check (quantity > 0);

-- PARTIAL unique index: one order per Stripe session, but any number
-- of rows with no session at all. This is what lets Phase 3 write
-- door sales - many rows sharing a null stripe_session_id - without
-- colliding. A column-level UNIQUE would technically permit that too
-- (Postgres treats nulls as distinct), but it also invites someone to
-- "fix" the nullability later; the partial index states the rule.
create unique index if not exists ticket_orders_session_uniq
  on ticket_orders (stripe_session_id)
  where stripe_session_id is not null;

create index if not exists ticket_orders_event_idx   on ticket_orders (event_id, status);
create index if not exists ticket_orders_created_idx on ticket_orders (created_at desc);
-- Will-call lookup at the door: find an order by who bought it.
create index if not exists ticket_orders_email_idx   on ticket_orders (lower(purchaser_email));
create index if not exists ticket_orders_name_idx    on ticket_orders (lower(purchaser_name));

-- ---------------------------------------------------------------
-- tickets: one row per admission
-- ---------------------------------------------------------------
create table if not exists tickets (
  id         uuid default gen_random_uuid() primary key,
  tenant_id  uuid not null default E'a8ad9286-f33d-4c89-8f2f-2ec1347a798c',
  order_id   uuid not null references ticket_orders (id) on delete restrict,
  event_id   uuid not null references events (id) on delete restrict,

  -- Opaque and random, never sequential: a sequential code would let
  -- anyone holding one ticket derive every other ticket for the show.
  -- Generated in the app (Crockford-style base32, ambiguous characters
  -- removed) - see src/lib/tickets/codes.ts.
  code       text not null unique,

  status     text not null default E'valid',
  used_at    timestamptz,
  -- Which door device burned it. Phase 2 fills this in.
  used_by    text,
  source     text not null default E'online',

  created_at timestamptz not null default now()
);

alter table tickets
  drop constraint if exists tickets_status_check;

alter table tickets
  add constraint tickets_status_check
  check (status in (E'valid', E'used', E'void'));

alter table tickets
  drop constraint if exists tickets_source_check;

alter table tickets
  add constraint tickets_source_check
  check (source in (E'online', E'door', E'comp'));

-- Capacity counting and the Phase 2 door manifest both read
-- (event_id, status).
create index if not exists tickets_event_status_idx on tickets (event_id, status);
-- The scanner's lookup path. Redundant with the UNIQUE constraint's
-- implicit index, but stated so a future change to that constraint
-- cannot silently remove the index the door depends on.
create index if not exists tickets_code_idx on tickets (code);
create index if not exists tickets_order_idx on tickets (order_id);

-- ---------------------------------------------------------------
-- RLS
--
-- Enabled with NO policies at all. Every read and write goes through
-- the service-role key in server-side routes, which bypasses RLS.
--
-- This is deliberately STRICTER than merch_orders, which has a public
-- insert policy because its row is written by the anon client. A
-- public insert policy here would let anyone forge pending orders, and
-- a public read policy would expose ticket codes - the codes ARE the
-- admission, so they must never be selectable with the anon key.
-- ---------------------------------------------------------------
alter table ticket_orders enable row level security;
alter table tickets       enable row level security;
