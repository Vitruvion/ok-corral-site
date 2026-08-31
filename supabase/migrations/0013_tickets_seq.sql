-- ================================================================
-- 0013 - tickets.seq: make issuance safe under CONCURRENT delivery
--
-- THE BUG THIS CLOSES
-- The webhook issued tickets by counting what an order already had and
-- inserting the shortfall. That is a check-then-insert, and it is only
-- safe if deliveries are serialised. They are not: Stripe can deliver
-- the same checkout.session.completed twice at once, and retries can
-- overlap a slow first delivery. Two deliveries could both read zero
-- existing tickets and both insert `quantity` rows, issuing double
-- tickets against a single payment. No amount of application logic
-- fixes that - by the time JS has counted, the count is already stale.
--
-- THE FIX
-- Give every ticket an ordinal within its order and make (order_id,
-- seq) unique. The webhook then inserts seq 1..quantity in ONE
-- statement with ON CONFLICT DO NOTHING. Whichever delivery gets there
-- first wins each ordinal; the loser's rows are dropped by the
-- database, not by a JS check. The invariant "an order can never hold
-- two tickets with the same ordinal" is now enforced by the schema, so
-- it holds no matter how the callers behave or how many run at once.
--
-- Also useful to a human: seq is the "2 of 5" on a ticket.
--
-- Idempotent; safe to re-run. MUST run after 0012.
-- ================================================================

alter table tickets
  add column if not exists seq integer;

-- Backfill any rows that predate the column. Ordered by created_at so
-- the numbering matches the order the tickets were issued in, with id
-- as a tiebreaker so the result is deterministic if two share a
-- timestamp. Expected to be a no-op on a fresh install.
with numbered as (
  select
    id,
    row_number() over (partition by order_id order by created_at, id) as rn
  from tickets
  where seq is null
)
update tickets t
   set seq = n.rn
  from numbered n
 where t.id = n.id;

alter table tickets
  alter column seq set not null;

alter table tickets
  drop constraint if exists tickets_seq_check;

alter table tickets
  add constraint tickets_seq_check
  check (seq > 0);

-- The constraint that actually does the work. Without this, concurrent
-- webhook deliveries double-issue; with it, the second one's insert is
-- discarded by Postgres before it can.
create unique index if not exists tickets_order_seq_uniq
  on tickets (order_id, seq);
