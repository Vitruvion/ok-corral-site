-- 0017_admin_delete_event
--
-- Permanently deleting a show, in ONE transaction, with the rules
-- decided inside it.
--
-- WHY A FUNCTION: tickets -> ticket_orders -> events are ON DELETE
-- RESTRICT, so nothing can be orphaned, but three separate deletes from
-- the app could still stop half way (tickets gone, the paid order and the
-- show still there -- a buyer the door can no longer scan). One function
-- call is one transaction: all of it happens, or none of it.
--
-- THE RULES (CLAUDE.md, admin editors section). "Real" means an order
-- that is paid or refunded and is NOT a Stripe test-mode purchase
-- (stripe_session_id starting cs_test_). Door sales and comps are real.
--   no real orders (none, abandoned checkouts, test orders only)
--       -> deleted: the show, all its orders and tickets.
--   real orders, show today or later (venue time, America/Los_Angeles)
--       -> refused ('blocked'). Those buyers still have to scan in.
--   real orders, show already past
--       -> deleted only when p_confirm_name matches the show's name
--          (trimmed, case-insensitive); otherwise 'needs_confirmation'.
-- The show's row and its orders are locked first, so a checkout that
-- completes mid-delete waits and then finds its order gone, rather than
-- slipping a paid order past the check.
--
-- p_dry_run = true answers the same question without deleting anything:
-- 'would_remove' with exact counts (or 'blocked' / 'needs_confirmation'),
-- so the editor can show real numbers before anyone confirms.
--
-- The poster in Storage cannot be part of a database transaction; the
-- function returns poster_url and the app removes the object after.
--
-- Callable by the server's service-role key only.
--
-- Additive and idempotent: one CREATE OR REPLACE FUNCTION plus grants.
-- Kept pure 7-bit ASCII for the Supabase SQL editor.

create or replace function public.admin_delete_event(
  p_event_id     uuid,
  p_confirm_name text default null,
  p_dry_run      boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  ev             record;
  real_orders    integer;
  test_orders    integer;
  total_orders   integer;
  real_tickets   integer;
  total_tickets  integer;
  is_past        boolean;
begin
  select id, name, date, poster_url
    into ev
    from events
   where id = p_event_id
     for update;

  if not found then
    return jsonb_build_object(E'mode', E'not_found');
  end if;

  perform 1 from ticket_orders where event_id = p_event_id for update;

  select
    count(*) filter (
      where status in (E'paid', E'refunded')
        and not starts_with(coalesce(stripe_session_id, E''), E'cs_test_')
    ),
    count(*) filter (where starts_with(coalesce(stripe_session_id, E''), E'cs_test_')),
    count(*)
    into real_orders, test_orders, total_orders
    from ticket_orders
   where event_id = p_event_id;

  select count(*)
    into real_tickets
    from tickets t
    join ticket_orders o on o.id = t.order_id
   where t.event_id = p_event_id
     and o.status in (E'paid', E'refunded')
     and not starts_with(coalesce(o.stripe_session_id, E''), E'cs_test_');

  select count(*)
    into total_tickets
    from tickets
   where event_id = p_event_id
      or order_id in (select id from ticket_orders where event_id = p_event_id);

  is_past := ev.date < (now() at time zone E'America/Los_Angeles')::date;

  if real_orders > 0 then
    if not is_past then
      return jsonb_build_object(
        E'mode', E'blocked',
        E'realOrders', real_orders,
        E'realTickets', real_tickets
      );
    end if;
    if p_dry_run
       or p_confirm_name is null
       or lower(btrim(p_confirm_name)) <> lower(btrim(ev.name)) then
      return jsonb_build_object(
        E'mode', E'needs_confirmation',
        E'name', ev.name,
        E'realOrders', real_orders,
        E'realTickets', real_tickets
      );
    end if;
  end if;

  if p_dry_run then
    return jsonb_build_object(
      E'mode', E'would_remove',
      E'name', ev.name,
      E'realOrders', real_orders,
      E'realTickets', real_tickets,
      E'testOrders', test_orders,
      E'ordersRemoved', total_orders,
      E'ticketsRemoved', total_tickets
    );
  end if;

  delete from tickets
   where event_id = p_event_id
      or order_id in (select id from ticket_orders where event_id = p_event_id);
  delete from ticket_orders where event_id = p_event_id;
  delete from events where id = p_event_id;

  return jsonb_build_object(
    E'mode', E'removed',
    E'posterUrl', ev.poster_url,
    E'realOrders', real_orders,
    E'realTickets', real_tickets,
    E'testOrders', test_orders,
    E'ordersRemoved', total_orders,
    E'ticketsRemoved', total_tickets
  );
end;
$$;

-- Server only. Supabase grants EXECUTE on new functions to the public
-- roles by default; the anon key must never be able to delete a show.
revoke all on function public.admin_delete_event(uuid, text, boolean) from public;
revoke all on function public.admin_delete_event(uuid, text, boolean) from anon, authenticated;
grant execute on function public.admin_delete_event(uuid, text, boolean) to service_role;
