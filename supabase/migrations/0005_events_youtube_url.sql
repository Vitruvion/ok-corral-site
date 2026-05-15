-- ================================================================
-- 0005 - events.youtube_url
-- Optional YouTube link (watch URL or any other YouTube form).
-- When set, the Events UI renders an embedded player below the
-- event poster in the expanded panel.
-- Idempotent; safe to re-run.
-- ================================================================

alter table events
  add column if not exists youtube_url text;
