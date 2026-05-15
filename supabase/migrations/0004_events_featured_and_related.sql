-- ================================================================
-- 0004 - events: featured flag + related_links jsonb
-- Idempotent; safe to re-run.
--
-- featured:      bool that drives the auto-expand-on-load behavior
--                in the Events UI. The "first event of the season"
--                or current headline show should have this on.
-- related_links: jsonb array of { name, url, image?, role? } that
--                the UI auto-linkifies anywhere the name appears
--                in support/description text. Also renders an
--                optional thumbnail sidebar.
-- poster_url:    already exists from 0001; not changed here. The
--                Dustin Gaspard event below populates it.
-- ================================================================

alter table events
  add column if not exists featured boolean default false;

alter table events
  add column if not exists related_links jsonb;

-- Only one event should be featured at a time (multiple is fine for the
-- UI — it auto-expands the first one — but keeping a single-featured
-- convention via a partial unique index discourages drift).
create unique index if not exists events_one_featured_idx
  on events ((true)) where featured = true;
