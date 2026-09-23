-- 018: which sheets a student keeps, and what they call them.
--
-- Not everyone is at a university, so two sheets called On-Campus and
-- Off-Campus is the wrong shape for plenty of people. They choose now, and
-- they can rename what they keep.
--
-- Deliberately no change to applications.type or its check constraint. The
-- stored values stay 'On-Campus' and 'Off-Campus' forever and these two
-- columns are presentation: which of the two to show, and what to call them.
-- That means nobody's existing rows can be orphaned by a rename, a sheet can
-- be turned back on without recovering anything, and the trigger, the charts
-- and the connector keep working off values they already understand.
--
-- sheets_enabled is nullable on purpose: null means never asked, which is
-- what the app keys the one-time question off. Existing students are backfilled
-- to both, because that is what they already have.

alter table public.profiles
  add column if not exists sheets_enabled text[],
  add column if not exists sheet_names jsonb not null default '{}'::jsonb;

update public.profiles
   set sheets_enabled = array['On-Campus', 'Off-Campus']
 where sheets_enabled is null;

comment on column public.profiles.sheets_enabled is
  'Which of the two built-in sheets to show, as applications.type values. Null means the student has not been asked yet.';
comment on column public.profiles.sheet_names is
  'Optional display names, keyed by the applications.type value: {"On-Campus": "Campus jobs"}. The stored type never changes.';
