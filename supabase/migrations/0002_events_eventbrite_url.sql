-- ════════════════════════════════════════════════════════════════
-- 0002 — add events.eventbrite_url
-- For existing databases that ran 0001 before this column existed.
-- Idempotent: safe to re-run. Fresh installs already have the column
-- via the updated 0001_init.sql.
-- ════════════════════════════════════════════════════════════════

alter table events
  add column if not exists eventbrite_url text;
