-- ================================================================
-- 0015 - events editor support
--
-- Backs /admin/events, where the bar adds and edits shows from a
-- phone.
--
-- THE FEATURED SWAP
-- events_one_featured_idx (from 0004) is a unique index over
-- ((true)) where featured = true, so at most ONE row may be featured.
-- Marking a second one is a 23505, not a UI quirk.
--
-- Doing the swap as two separate statements from the app would work --
-- unfeature the old, then feature the new -- but between those two
-- round trips the table has NO featured row, and any page rendering in
-- that window loses its auto-expanded show. Doing it as a single
-- UPDATE across both rows is worse: a non-deferrable unique index is
-- checked per row as the statement walks them, so a swap can fail
-- spuriously depending on visit order.
--
-- A function fixes both. It runs in one transaction, so no reader ever
-- observes an intermediate state at all -- they see the old featured
-- row or the new one, never two and never none.
--
-- Passing NULL clears the featured flag entirely. Zero featured events
-- is a perfectly good state; only two is impossible.
--
-- Idempotent; safe to re-run.
-- ================================================================

create or replace function set_featured_event(target uuid)
returns void
language plpgsql
as $$
begin
  -- Order matters inside the transaction too: clear first, then set,
  -- so the index is never asked to hold two true rows at once.
  update events set featured = false
   where featured = true
     and (target is null or id <> target);

  if target is not null then
    update events set featured = true where id = target;

    if not found then
      raise exception E'event % not found', target using errcode = E'no_data_found';
    end if;
  end if;
end;
$$;

comment on function set_featured_event(uuid) is
  E'Atomically move the featured flag to one event, or clear it when passed NULL. See migration 0015.';
