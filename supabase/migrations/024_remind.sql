-- 024: whether a job wants chasing at all.
--
-- The Insights rail nags about two things: a follow-up date that has passed,
-- and a deadline inside a week. Both dates are set for you, next_follow_up
-- automatically a week after you apply, so every application signs itself up
-- for a reminder whether you wanted one or not. A list that reminds you about
-- things you have already decided to let go is a list you stop reading.
--
-- One flag per application covers both, because the decision is about the job
-- rather than about the kind of date: "I am not chasing this one." The dates
-- stay exactly where they are, so nothing is lost and turning it back on
-- brings the reminder back.

alter table public.applications
  add column if not exists remind boolean not null default true;

comment on column public.applications.remind is
  'Whether this application should appear in the Insights reminders (overdue follow-up, deadline soon). The dates are untouched when this is false, so switching it back on restores the reminder.';
