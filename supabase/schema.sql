-- Job Application Tracker schema.
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to re-run: every statement is idempotent.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- applications: one row per job applied to (or on the wishlist)
-- ---------------------------------------------------------------------------
create table if not exists public.applications (
  id               uuid primary key default gen_random_uuid(),
  type             text not null default 'Off-Campus'
                     check (type in ('On-Campus', 'Off-Campus')),
  role             text not null default '',
  company          text,                       -- company, or PSU office/department for on-campus
  category         text check (category in ('Internship', 'Part-time', 'Full-time', 'Co-op',
                                            'Research / TA / LA', 'Work-Study')),
  status           text not null default 'Applied'
                     check (status in ('Wishlist', 'Applied', 'OA / Assessment', 'Interviewing',
                                       'Offer', 'Accepted', 'Rejected', 'Withdrawn', 'Ghosted')),
  priority         text check (priority in ('High', 'Medium', 'Low')),
  deadline         date,
  date_applied     date,
  next_follow_up   date,
  location         text,
  work_mode        text check (work_mode in ('On-site', 'Hybrid', 'Remote')),
  pay              text,                       -- free text: "$15/hr", "$95k", "Stipend"
  hours_per_week   numeric,
  job_link         text,
  source           text check (source in ('Handshake', 'Workday (PSU)', 'LinkedIn', 'Company Site',
                                            'Referral', 'Career Fair', 'Other')),
  contact          text,
  contact_email    text,
  referral         boolean not null default false,
  cover_letter     boolean not null default false,
  resume_version   text,
  requirements     text,                       -- short summary of key qualifications
  job_description  text,                       -- full posting text, kept in case the listing disappears
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- application_events: the history of each application
-- ---------------------------------------------------------------------------
create table if not exists public.application_events (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references public.applications(id) on delete cascade,
  event_date      date not null default current_date,
  kind            text not null default 'note'
                    check (kind in ('status', 'note', 'interview', 'follow_up', 'offer')),
  detail          text not null,
  created_at      timestamptz not null default now()
);

create index if not exists application_events_app_idx
  on public.application_events (application_id, event_date desc, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers: keep updated_at fresh, and log every status change automatically,
-- whether it came from Claude or from a manual edit on the website.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function public.log_status_change() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_events (application_id, event_date, kind, detail)
    values (new.id, coalesce(new.date_applied, current_date), 'status', new.status);
  elsif new.status is distinct from old.status then
    insert into public.application_events (application_id, kind, detail)
    values (new.id, 'status', old.status || ' → ' || new.status);
  end if;
  return new;
end $$;

drop trigger if exists applications_touch on public.applications;
create trigger applications_touch before update on public.applications
  for each row execute function public.touch_updated_at();

drop trigger if exists applications_status_log on public.applications;
create trigger applications_status_log after insert or update of status on public.applications
  for each row execute function public.log_status_change();

-- ---------------------------------------------------------------------------
-- Lock it down. RLS on with no policies = the public "anon" key can read
-- nothing. Only the website's server (service-role key) and the Supabase
-- connector in Claude can touch these tables.
-- ---------------------------------------------------------------------------
alter table public.applications       enable row level security;
alter table public.application_events enable row level security;
