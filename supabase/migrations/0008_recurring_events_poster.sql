-- ================================================================
-- 0008 - recurring_events.poster_url
-- Optional flyer for a weekly event (e.g. the Monday pool tournament).
-- When set, the "Every Week" card renders full-width with the poster
-- alongside and a click opens it full size.
-- Idempotent; safe to re-run.
-- ================================================================

alter table recurring_events
  add column if not exists poster_url text;
