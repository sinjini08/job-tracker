-- 019: a student can make sheets of their own.
--
-- 018 let them choose between the two built-in sheets and rename them. That
-- still assumed the two, which is the wrong shape for anyone who wants, say,
-- Internships and Full-time as separate boards.
--
-- A sheet is just the string in applications.type. The built-ins keep the
-- values they have always had ('On-Campus', 'Off-Campus') so no existing row
-- moves, and a sheet a student makes gets a generated key ('s_' + 12 chars)
-- that is theirs alone. Which sheets they keep and what they are called stays
-- in profiles.sheets_enabled and profiles.sheet_names, exactly as 018 set it
-- up, so there is no new table and no foreign key to keep in step.
--
-- The CHECK constraint naming the two built-ins has to go, since a generated
-- key would fail it. What replaces it is a sanity bound, not a whitelist:
-- the set of legal values is now per student and lives in their profile, and
-- RLS already means the only rows anyone can write are their own.

alter table public.applications drop constraint if exists applications_type_check;

alter table public.applications
  add constraint applications_type_check
  check (type is not null and char_length(type) between 1 and 64);

comment on column public.applications.type is
  'Which sheet the row is on. Either a built-in (''On-Campus'', ''Off-Campus'') or a key the student generated for a sheet of their own. Names live in profiles.sheet_names; this value never changes when a sheet is renamed.';
