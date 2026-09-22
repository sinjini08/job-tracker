-- 013: columns a student adds themselves, and the ones they have hidden.
--
-- Definitions live in their own table so they can be renamed, reordered and
-- deleted. The values live in a jsonb blob on the application, keyed by the
-- column's id: a handful of short values per row, so a real column for each
-- one would mean a migration every time somebody adds a column.
create table if not exists public.custom_columns (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references public.profiles(id) on delete cascade,
  label      text not null,
  kind       text not null default 'text'
               check (kind in ('text', 'number', 'date', 'bool', 'select')),
  options    text[] not null default '{}',
  applies    text not null default 'both'
               check (applies in ('both', 'On-Campus', 'Off-Campus')),
  position   int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists custom_columns_user_idx on public.custom_columns (user_id, position);

alter table public.custom_columns enable row level security;
drop policy if exists "custom columns: owner" on public.custom_columns;
create policy "custom columns: owner" on public.custom_columns
  for all to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

alter table public.applications add column if not exists custom jsonb not null default '{}'::jsonb;

-- Which columns this student has hidden, per sheet: {"On-Campus": ["pay"], ...}
alter table public.profiles add column if not exists hidden_columns jsonb not null default '{}'::jsonb;
