-- 021: the cache and the meter behind the written read of a search.
--
-- The Insights tab is arithmetic and always will be. This table backs the one
-- part that isn't: a short written read, produced on demand by a model, over
-- the figures the rules already worked out.
--
-- Two jobs, and both of them are about not spending money twice:
--
--   brief_hash is a digest of exactly what was sent. Asking again with nothing
--   changed returns the stored read instead of paying for the same answer, so
--   a student can reopen the tab as often as they like for free.
--
--   calls_day and calls_today are a per-student daily cap. They are written by
--   the server with the service role and there is no update policy for anyone
--   else, so the meter cannot be reset by the person it meters.
--
-- Nothing is sent anywhere until the student asks for it. The row only exists
-- once they have pressed the button.

create table if not exists public.ai_reads (
  user_id    text primary key references public.profiles(id) on delete cascade,
  brief_hash text not null,
  body       jsonb not null,
  model      text,
  created_at timestamptz not null default now(),
  calls_day  date not null default current_date,
  calls_today int not null default 0
);

comment on table public.ai_reads is
  'Cached written read of one student''s job search, plus their daily call meter. Written only by the server.';

alter table public.ai_reads enable row level security;

-- Read your own, and nothing else. No insert, update or delete policy exists
-- on purpose: every write goes through the server with the service role, which
-- is what keeps the daily cap honest.
drop policy if exists ai_reads_select_own on public.ai_reads;
create policy ai_reads_select_own on public.ai_reads
  for select to authenticated
  using ((select auth.jwt()->>'sub') = user_id);
