-- 006: reaching out (usually on LinkedIn) is part of applying: track when it happened.
alter table public.applications add column if not exists messaged_on date;
comment on column public.applications.messaged_on is 'Date the student messaged the contact (LinkedIn DM, email, etc). What was said goes in application_events.';
