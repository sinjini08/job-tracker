-- 002: multi-user. Every row belongs to a signed-in user (Supabase Auth), and
-- row-level security lets each person see and change only their own rows.
-- Written for a project where 001 (schema.sql v1) already ran and the tables
-- are empty; the NOT NULL user_id columns would fail on existing rows.

-- ---------------------------------------------------------------------------
-- profiles: one per auth user. Holds the share-link token and the hash of the
-- personal Claude connector token (the token itself is never stored).
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  share_token     text unique,
  mcp_token_hash  text unique,
  created_at      timestamptz not null default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Ownership columns
-- ---------------------------------------------------------------------------
alter table public.applications
  add column if not exists user_id uuid not null default auth.uid()
  references auth.users(id) on delete cascade;
create index if not exists applications_user_idx on public.applications (user_id, created_at);

alter table public.application_events
  add column if not exists user_id uuid not null
  references auth.users(id) on delete cascade;
create index if not exists application_events_user_idx on public.application_events (user_id);

-- An event always belongs to its application's owner. Set it server-side so a
-- caller can never attach an event to someone else's application.
create or replace function public.event_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select a.user_id into new.user_id from public.applications a where a.id = new.application_id;
  if new.user_id is null then
    raise exception 'application % not found', new.application_id;
  end if;
  return new;
end $$;

drop trigger if exists application_events_owner on public.application_events;
create trigger application_events_owner before insert on public.application_events
  for each row execute function public.event_owner();

-- Pin search_path on the v1 trigger functions too (Supabase advisor recommendation).
alter function public.touch_updated_at() set search_path = '';
create or replace function public.log_status_change() returns trigger
language plpgsql set search_path = '' as $$
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

-- ---------------------------------------------------------------------------
-- Row-level security: owners only. (The anon role gets no policies at all.)
-- ---------------------------------------------------------------------------
drop policy if exists "applications: owner" on public.applications;
create policy "applications: owner" on public.applications
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "events: owner read" on public.application_events;
create policy "events: owner read" on public.application_events
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "events: owner insert" on public.application_events;
create policy "events: owner insert" on public.application_events
  for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "events: owner delete" on public.application_events;
create policy "events: owner delete" on public.application_events
  for delete to authenticated using (user_id = (select auth.uid()));

-- Trigger-only functions: nobody should call these through the API.
-- (Triggers still fire; EXECUTE isn't checked when a trigger runs.)
revoke execute on function public.event_owner() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
