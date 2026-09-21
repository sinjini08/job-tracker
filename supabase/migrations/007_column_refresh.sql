-- Column refresh after the field review.
--
-- Two new columns (term, outreach_method), one rename (messaged_on ->
-- reached_out_on), and the dropdown CHECK constraints are dropped: the option
-- lists in lib/fields.js are now suggestions, and a student may type a value
-- of their own. Status keeps a default and NOT NULL, because the sheet and the
-- charts both assume every row has one.

alter table public.applications add column if not exists term text;
alter table public.applications add column if not exists outreach_method text;

alter table public.applications rename column messaged_on to reached_out_on;

alter table public.applications drop constraint if exists applications_category_check;
alter table public.applications drop constraint if exists applications_status_check;
alter table public.applications drop constraint if exists applications_work_mode_check;
alter table public.applications drop constraint if exists applications_source_check;

-- "Ghosted" reads as something the employer did to you; "No reply" is the fact.
update public.applications set status = 'No reply' where status = 'Ghosted';

alter table public.applications alter column status set not null;
alter table public.applications alter column status set default 'Applied';
