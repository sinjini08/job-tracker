-- 023: the order of the columns, which is the student's to decide.
--
-- The grid has always drawn its columns in the order lib/fields lists them.
-- That order is a guess about what most people want first, and it is wrong for
-- anyone who cares about pay, or deadlines, or who they spoke to.
--
-- Stored per sheet, like hidden_columns and row_columns, because the sheets
-- have different columns. A column not in the list keeps its built-in place,
-- after the ones the student placed, so adding a column later never disturbs
-- an order somebody set.
--
-- Whichever column ends up first becomes the frozen one in the grid, which
-- falls out of the existing sticky-column rule rather than needing its own.

alter table public.profiles
  add column if not exists column_order jsonb not null default '{}'::jsonb;

comment on column public.profiles.column_order is
  'Column order per sheet: {"Off-Campus": ["role","pay","status"]}. Ids not listed keep their built-in position, after the listed ones. Empty means the built-in order.';
