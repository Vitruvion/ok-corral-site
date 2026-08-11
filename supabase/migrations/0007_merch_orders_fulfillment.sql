-- ════════════════════════════════════════════════════════════════
-- 0007 — merch_orders: fulfillment + payment completion columns
--
-- Backs the Stripe webhook at /api/stripe/webhook, which flips an
-- order from 'pending' to 'paid' once Stripe confirms payment.
--
-- Existing columns already cover: stripe_session_id (unique),
-- items, subtotal, total, customer_email, status, created_at.
-- This migration adds what the completion pipeline needs:
--
--   stripe_payment_intent_id — for reconciliation against Stripe
--   fulfillment_type         — 'ship' or 'pickup', chosen by the
--                              customer via Stripe Checkout's
--                              shipping options
--   shipping_address         — jsonb snapshot of what Stripe
--                              collected (null on pickup orders,
--                              or if Stripe collected nothing)
--   paid_at                  — when the webhook marked it paid
--
-- NOTE: `total` is rewritten by the webhook with Stripe's real
-- amount_total, which INCLUDES shipping. At session-creation time
-- it's only the item subtotal, since shipping isn't chosen yet.
--
-- Idempotent; safe to re-run.
-- ════════════════════════════════════════════════════════════════

alter table merch_orders
  add column if not exists stripe_payment_intent_id text;

alter table merch_orders
  add column if not exists fulfillment_type text;

alter table merch_orders
  add column if not exists shipping_address jsonb;

alter table merch_orders
  add column if not exists paid_at timestamptz;

-- Only 'ship' or 'pickup' (or null, before the webhook resolves it).
-- Dropped first so re-running picks up any future edits to the rule.
alter table merch_orders
  drop constraint if exists merch_orders_fulfillment_type_check;

alter table merch_orders
  add constraint merch_orders_fulfillment_type_check
  check (fulfillment_type is null or fulfillment_type in ('ship', 'pickup'));

-- Fulfillment queue lookups: "what pickups are waiting?" / "what ships?"
create index if not exists merch_orders_fulfillment_idx
  on merch_orders (fulfillment_type, status);

create index if not exists merch_orders_paid_at_idx
  on merch_orders (paid_at desc);

-- ── RLS note ─────────────────────────────────────────────────────
-- No UPDATE policy is added on purpose. The webhook writes with the
-- service-role key (getServiceSupabase), which bypasses RLS. Leaving
-- update closed to anon/authenticated means a leaked anon key can't
-- mark unpaid orders as paid.
