-- 0016_booking_reason.sql
--
-- The contact form is the only way to reach the bar from the site, so it
-- carries far more than bookings: questions, complaints, bands asking for
-- a slot. It now asks why, and the answer is stored alongside the rest of
-- the submission instead of being visible only in the notification email.
--
-- Free text rather than an enum or a lookup table: the four options live
-- in src/lib/email/booking-inquiry.ts, and wording there should not need
-- a migration to change. The column reads as plain English in the table.
--
-- Nullable on purpose. Every row written before this column existed has
-- no reason to record, and the site keeps working if it is deployed
-- before this file is applied.

alter table booking_inquiries
  add column if not exists reason text;

comment on column booking_inquiries.reason is
  E'Why they wrote: the contact form''s reason select. Null for rows predating the field.';
