-- ════════════════════════════════════════════════════════════════
-- The OK Corral — Initial schema + RLS
-- Run this in Supabase SQL Editor (Project: oqfjlsmsthcuamkncpfb)
-- ════════════════════════════════════════════════════════════════

-- ── Tables ──────────────────────────────────────────────────────

create table if not exists events (
  id           uuid default gen_random_uuid() primary key,
  slug         text unique not null,
  date         date not null,
  weekday      text not null,
  name         text not null,
  support      text,
  time         text not null,
  doors        text,
  genre        text,
  tickets      text,
  tags         text[] default '{}',
  description  text,
  poster_url   text,
  active       boolean default true,
  sort_order   int default 0,
  created_at   timestamptz default now()
);

create index if not exists events_date_idx on events (date);
create index if not exists events_active_idx on events (active);

create table if not exists drinks (
  id           uuid default gen_random_uuid() primary key,
  category     text not null,
  name         text not null,
  tagline      text,
  price        text not null,
  description  text,
  active       boolean default true,
  sort_order   int default 0
);

create index if not exists drinks_category_idx on drinks (category);

create table if not exists merch (
  id           uuid default gen_random_uuid() primary key,
  slug         text unique not null,
  name         text not null,
  category     text not null,
  price        numeric not null,
  badge        text,
  color        text,
  sizes        text[] default '{}',
  image_url    text,
  image_bg     text,
  description  text,
  active       boolean default true,
  sort_order   int default 0
);

create index if not exists merch_category_idx on merch (category);
create index if not exists merch_active_idx on merch (active);

create table if not exists recurring_events (
  id           uuid default gen_random_uuid() primary key,
  day_abbr     text not null,
  name         text not null,
  support      text,
  time         text,
  tickets      text,
  active       boolean default true,
  sort_order   int default 0
);

create table if not exists booking_inquiries (
  id              uuid default gen_random_uuid() primary key,
  name            text not null,
  email           text not null,
  phone           text,
  event_type      text,
  party_size      text,
  preferred_date  date,
  notes           text,
  created_at      timestamptz default now()
);

create table if not exists newsletter (
  id           uuid default gen_random_uuid() primary key,
  email        text unique not null,
  created_at   timestamptz default now()
);

create table if not exists site_settings (
  key    text primary key,
  value  jsonb not null
);

-- ── Row Level Security ──────────────────────────────────────────

alter table events             enable row level security;
alter table drinks             enable row level security;
alter table merch              enable row level security;
alter table recurring_events   enable row level security;
alter table booking_inquiries  enable row level security;
alter table newsletter         enable row level security;
alter table site_settings      enable row level security;

-- Public read for catalog tables (active rows only)
drop policy if exists "events public read" on events;
create policy "events public read" on events
  for select to anon, authenticated
  using (active = true);

drop policy if exists "drinks public read" on drinks;
create policy "drinks public read" on drinks
  for select to anon, authenticated
  using (active = true);

drop policy if exists "merch public read" on merch;
create policy "merch public read" on merch
  for select to anon, authenticated
  using (active = true);

drop policy if exists "recurring public read" on recurring_events;
create policy "recurring public read" on recurring_events
  for select to anon, authenticated
  using (active = true);

drop policy if exists "settings public read" on site_settings;
create policy "settings public read" on site_settings
  for select to anon, authenticated
  using (true);

-- Public insert for forms; nobody (anon) can read these back
drop policy if exists "bookings public insert" on booking_inquiries;
create policy "bookings public insert" on booking_inquiries
  for insert to anon, authenticated
  with check (true);

drop policy if exists "newsletter public insert" on newsletter;
create policy "newsletter public insert" on newsletter
  for insert to anon, authenticated
  with check (true);
