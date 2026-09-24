-- 022: which columns sit on the row, and which wait in the details.
--
-- The list view asks a question the grid never had to: a row is one line, so
-- not every column a student keeps can be on it. The first version answered
-- that by taking the first six and dropping the rest, which quietly overruled
-- a sheet somebody had set up deliberately.
--
-- So it becomes a choice of its own. hidden_columns already says what a
-- student does not want to see at all; this says, of the ones they do, which
-- earn a place on the line. Everything else is still one click away in the
-- panel underneath, so nothing is ever hidden by this, only moved.
--
-- Keyed by sheet, like hidden_columns, because the sheets have different
-- columns. An empty object means never chosen, and the app falls back to a
-- sensible six.

alter table public.profiles
  add column if not exists row_columns jsonb not null default '{}'::jsonb;

comment on column public.profiles.row_columns is
  'Which columns appear on the row in list view, keyed by sheet: {"Off-Campus": ["status","pay"]}. Absent means not chosen, and the app picks a default. Columns left out are still shown in the expanded details.';
