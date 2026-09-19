-- 004: Clerk replaces Supabase Auth as the sign-in provider.
--
-- Ownership columns hold Clerk user ids (text like "user_2ab…") instead of
-- Supabase uuids, and RLS compares them against the "sub" claim of the Clerk
-- session token (Supabase third-party auth). Supabase's auth.users table is no
-- longer used, so the FKs and the signup trigger go away, and the app deletes a
-- student's rows itself when they delete their account.
--
-- Written for the cutover while the tables were still empty.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

delete from public.oauth_tokens;
delete from public.oauth_codes;
delete from public.oauth_clients;
delete from public.application_events;
delete from public.applications;
delete from public.profiles;

-- Policies reference these columns, so they have to go before the type change.
drop policy if exists "profiles: read own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
drop policy if exists "profiles: insert own" on public.profiles;
drop policy if exists "applications: owner" on public.applications;
drop policy if exists "events: owner read" on public.application_events;
drop policy if exists "events: owner insert" on public.application_events;
drop policy if exists "events: owner delete" on public.application_events;

-- profiles: id becomes the Clerk user id
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles alter column id type text using id::text;
alter table public.profiles add column if not exists email text;

-- applications / events
alter table public.applications drop constraint if exists applications_user_id_fkey;
alter table public.applications alter column user_id drop default;
alter table public.applications alter column user_id type text using user_id::text;

alter table public.application_events drop constraint if exists application_events_user_id_fkey;
alter table public.application_events alter column user_id type text using user_id::text;

-- oauth tables
alter table public.oauth_codes drop constraint if exists oauth_codes_user_id_fkey;
alter table public.oauth_codes alter column user_id type text using user_id::text;
alter table public.oauth_tokens drop constraint if exists oauth_tokens_user_id_fkey;
alter table public.oauth_tokens alter column user_id type text using user_id::text;

-- RLS against the Clerk session token's subject
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.jwt()->>'sub') = id);
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update to authenticated using ((select auth.jwt()->>'sub') = id)
  with check ((select auth.jwt()->>'sub') = id);
drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check ((select auth.jwt()->>'sub') = id);

drop policy if exists "applications: owner" on public.applications;
create policy "applications: owner" on public.applications
  for all to authenticated
  using ((select auth.jwt()->>'sub') = user_id)
  with check ((select auth.jwt()->>'sub') = user_id);

drop policy if exists "events: owner read" on public.application_events;
create policy "events: owner read" on public.application_events
  for select to authenticated using ((select auth.jwt()->>'sub') = user_id);
drop policy if exists "events: owner insert" on public.application_events;
create policy "events: owner insert" on public.application_events
  for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id);
drop policy if exists "events: owner delete" on public.application_events;
create policy "events: owner delete" on public.application_events
  for delete to authenticated using ((select auth.jwt()->>'sub') = user_id);

-- Deleting an account now cascades from profiles (the app deletes that row).
alter table public.applications drop constraint if exists applications_profile_fk;
alter table public.applications add constraint applications_profile_fk
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.application_events drop constraint if exists application_events_profile_fk;
alter table public.application_events add constraint application_events_profile_fk
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.oauth_tokens drop constraint if exists oauth_tokens_profile_fk;
alter table public.oauth_tokens add constraint oauth_tokens_profile_fk
  foreign key (user_id) references public.profiles(id) on delete cascade;
alter table public.oauth_codes drop constraint if exists oauth_codes_profile_fk;
alter table public.oauth_codes add constraint oauth_codes_profile_fk
  foreign key (user_id) references public.profiles(id) on delete cascade;
