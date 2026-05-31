-- ================================================================
-- 0006 - events.signup_url
-- Optional opt-in action URL, SEPARATE from eventbrite_url.
-- When set, the Events UI shows a prominent "Sign Up for the
-- Contest" button ALONGSIDE (not instead of) the Free Admission
-- badge. Used when general entry is free but there is a separate
-- optional signup (e.g. a hot dog eating contest signup).
-- Idempotent; safe to re-run.
-- ================================================================

alter table events
  add column if not exists signup_url text;
