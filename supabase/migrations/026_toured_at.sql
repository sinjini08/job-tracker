-- 026: when somebody finished, or skipped, the guided tour of the sheet.
--
-- Null means never shown, which is the same idiom sheets_enabled already uses
-- for "never asked". A timestamp rather than a boolean so it is possible to
-- tell later whether somebody saw the tour before or after a given change to
-- it, without adding a second column.
--
-- Nullable, so existing rows need no backfill: both current users get the tour
-- once on their next visit, which is the intended behaviour anyway.
alter table public.profiles add column if not exists toured_at timestamptz;

comment on column public.profiles.toured_at is
  'When the sheet tour was finished or skipped. Null means it has never been shown.';
