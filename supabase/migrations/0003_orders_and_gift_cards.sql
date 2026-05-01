-- ════════════════════════════════════════════════════════════════
-- 0003 — merch_orders + gift_card_orders
-- Both tables track Stripe Checkout sessions. RLS allows public
-- inserts (the API route runs server-side with the anon key) but
-- no public reads — only the project owner via the Supabase
-- dashboard or service-role key can read these.
--
-- A future improvement: Stripe webhook hits a small route that
-- updates `status` from 'pending' to 'paid'. Until that's wired,
-- the row gets created at session-creation time and stays
-- 'pending' until manually updated.
-- ════════════════════════════════════════════════════════════════

create table if not exists merch_orders (
  id                  uuid default gen_random_uuid() primary key,
  stripe_session_id   text unique not null,
  items               jsonb not null,
  subtotal            numeric not null,
  total               numeric not null,
  customer_email      text,
  status              text default 'pending',
  created_at          timestamptz default now()
);

create index if not exists merch_orders_session_idx on merch_orders (stripe_session_id);
create index if not exists merch_orders_status_idx  on merch_orders (status);

create table if not exists gift_card_orders (
  id                  uuid default gen_random_uuid() primary key,
  stripe_session_id   text unique not null,
  amount              numeric not null,
  to_name             text not null,
  to_email            text not null,
  from_name           text,
  note                text,
  status              text default 'pending',
  created_at          timestamptz default now()
);

create index if not exists gift_card_orders_session_idx on gift_card_orders (stripe_session_id);
create index if not exists gift_card_orders_status_idx  on gift_card_orders (status);

-- ── RLS ──────────────────────────────────────────────────────────
alter table merch_orders     enable row level security;
alter table gift_card_orders enable row level security;

-- Public insert; reads restricted to authenticated/service-role.
drop policy if exists "merch orders public insert" on merch_orders;
create policy "merch orders public insert" on merch_orders
  for insert to anon, authenticated
  with check (true);

drop policy if exists "gift card orders public insert" on gift_card_orders;
create policy "gift card orders public insert" on gift_card_orders
  for insert to anon, authenticated
  with check (true);
