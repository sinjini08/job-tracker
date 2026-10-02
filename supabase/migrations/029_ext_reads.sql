-- 029: a daily cap on the extension's requirements read.
--
-- Saving a posting from the extension asks a model one question: which lines
-- of this posting are the requirements. Everything else on the row is read
-- off the page for free. That one question runs on this app's own Anthropic
-- key, so it is the one part of the product whose cost grows with use.
-- (Connecting ChatGPT or Claude costs nothing here: the student's own
-- assistant does the reading, on their own subscription.)
--
-- It costs about a fifth of a cent a save, so the cap is not about ordinary
-- use. It is about a script, or a stolen extension token, saving thousands of
-- postings in an afternoon. Past the cap the save still happens; only the
-- requirements field falls back to the extension's own matcher.
--
-- One row per student, holding today's date and today's count, so the table
-- never grows past one row per person. Written only by the server with the
-- service role: RLS is on with no policies, and the function below can only
-- be executed by the service role, so nobody can reset their own meter or
-- spend somebody else's.

create table if not exists public.ext_reads (
  user_id text primary key references public.profiles(id) on delete cascade,
  day     date not null,
  reads   int  not null
);

comment on table public.ext_reads is
  'Per-student daily count of extension requirements reads (paid model calls). Written only by the server.';

alter table public.ext_reads enable row level security;

-- Counts one read and says whether it was allowed, in a single statement, so
-- two saves arriving at the same moment cannot both squeeze under the cap.
--
-- A new day resets the count to 1. On the same day the count goes up only
-- while it is under the cap; at the cap the update's WHERE fails, no row comes
-- back, and the function returns null, which the server reads as "over".
-- The day is UTC, so the cap resets at midnight UTC.
create or replace function public.claim_ext_read(p_user_id text, p_cap int)
returns int
language sql
set search_path = ''
as $$
  insert into public.ext_reads as r (user_id, day, reads)
  values (p_user_id, (now() at time zone 'utc')::date, 1)
  on conflict (user_id) do update
    set reads = case when r.day = excluded.day then r.reads + 1 else 1 end,
        day   = excluded.day
    where r.day <> excluded.day or r.reads < p_cap
  returning reads;
$$;

revoke execute on function public.claim_ext_read(text, int) from public, anon, authenticated;
grant execute on function public.claim_ext_read(text, int) to service_role;
