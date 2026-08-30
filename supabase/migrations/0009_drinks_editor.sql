-- ================================================================
-- 0009 - drinks: columns required by the /admin/menu editor
--
-- Drinks are now edited through /admin/menu, which needs a stable
-- ordering key, a soft-delete flag and a modified timestamp.
--
-- NOTE ON THE ACTIVE FLAG: this table already had `active`, and so do
-- events, merch and recurring_events. Rather than introduce a second
-- boolean with the same meaning under a different name, the editor
-- uses the existing `active` column - only tightened here to NOT NULL
-- so a null can never be mistaken for "hidden".
--
-- Idempotent; safe to re-run.
-- ================================================================

-- --- sort_order: NOT NULL so ordering is always deterministic -----
update drinks set sort_order = 0 where sort_order is null;

alter table drinks
  alter column sort_order set default 0;

alter table drinks
  alter column sort_order set not null;

-- --- active: NOT NULL, defaults to visible -----------------------
update drinks set active = true where active is null;

alter table drinks
  alter column active set default true;

alter table drinks
  alter column active set not null;

-- --- updated_at: stamped by the editor on every write ------------
alter table drinks
  add column if not exists updated_at timestamptz default now();

update drinks set updated_at = now() where updated_at is null;

-- --- Backfill sort_order from the CURRENT display order ----------
-- The site orders by (category, sort_order). Rows that already carry a
-- distinct sort_order keep their exact position; only ties are broken,
-- and they're broken by name so the result is stable and repeatable
-- rather than dependent on physical row order. Nothing reshuffles.
with ordered as (
  select
    id,
    row_number() over (
      partition by category
      order by sort_order asc, name asc
    ) as rn
  from drinks
)
update drinks d
   set sort_order = o.rn
  from ordered o
 where d.id = o.id
   and d.sort_order is distinct from o.rn;

-- --- Index for the editor's per-category ordered reads ------------
create index if not exists drinks_category_sort_idx
  on drinks (category, sort_order);
