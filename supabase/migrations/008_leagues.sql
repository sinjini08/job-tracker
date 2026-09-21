-- 008: leagues, points and goals.
--
-- A league is a group of friends with a join code. Its leaderboard is the one
-- place in this app where data crosses between two accounts, so it is built so
-- that it *can only* return totals:
--
--   * points live in their own ledger table, one row per application per
--     milestone, holding no company, role or link;
--   * the board is a security-definer function that aggregates that ledger and
--     returns one row per member. Nothing else grants cross-user access, so
--     even a mistake in the API can't hand over somebody's applications.
--
-- Each member chooses how much of their own row is shown: 'counts' (points
-- plus "4 applications, 1 interview") or 'points' (the total alone).

-- ---------------------------------------------------------------------------
-- profile: the name on the board, the privacy choice, and the two goals
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists leaderboard_detail text not null default 'counts';
alter table public.profiles add column if not exists weekly_goal int not null default 5;
alter table public.profiles add column if not exists monthly_goal int not null default 20;

alter table public.profiles drop constraint if exists profiles_detail_check;
alter table public.profiles add constraint profiles_detail_check
  check (leaderboard_detail in ('counts', 'points'));
alter table public.profiles drop constraint if exists profiles_goal_check;
alter table public.profiles add constraint profiles_goal_check
  check (weekly_goal between 0 and 200 and monthly_goal between 0 and 800);

-- ---------------------------------------------------------------------------
-- what each milestone is worth. A row here, not a constant in the code, so the
-- scale can be tuned with one UPDATE and the website, the board and the
-- "how points work" panel never disagree.
-- ---------------------------------------------------------------------------
create table if not exists public.point_values (
  milestone text primary key,
  points    int  not null,
  label     text not null,
  sort      int  not null
);

insert into public.point_values (milestone, points, label, sort) values
  ('applied',      1, 'Applied to a job',        1),
  ('outreach',     1, 'Reached out to a person', 2),
  ('screening',    2, 'Reached a screening',     3),
  ('assessment',   2, 'Reached an assessment',   4),
  ('interviewing', 3, 'Reached an interview',    5),
  ('final',        4, 'Reached a final round',   6),
  ('offer',        5, 'Got an offer',            7),
  ('accepted',     8, 'Accepted an offer',       8)
on conflict (milestone) do update
  set points = excluded.points, label = excluded.label, sort = excluded.sort;

-- ---------------------------------------------------------------------------
-- the ledger. Insert-only: moving a status backwards never takes a milestone
-- away, but deleting the application does (otherwise points could be farmed by
-- adding and removing rows).
-- ---------------------------------------------------------------------------
create table if not exists public.points (
  application_id uuid not null references public.applications(id) on delete cascade,
  milestone      text not null references public.point_values(milestone),
  user_id        text not null references public.profiles(id) on delete cascade,
  earned_on      date not null default current_date,
  created_at     timestamptz not null default now(),
  primary key (application_id, milestone)
);

create index if not exists points_user_idx on public.points (user_id, earned_on);

-- Award every milestone the row has reached. Runs on insert and on update, and
-- relies on the primary key to make each one a once-per-application event.
create or replace function public.award_points() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  reached  int;
  applied_on date := least(coalesce(new.date_applied, current_date), current_date);
begin
  -- Anything off the wishlist has been applied to.
  if new.status is distinct from 'Wishlist' then
    insert into public.points (application_id, milestone, user_id, earned_on)
    values (new.id, 'applied', new.user_id, applied_on)
    on conflict do nothing;
  end if;

  if new.reached_out_on is not null or new.outreach_method is not null then
    insert into public.points (application_id, milestone, user_id, earned_on)
    values (new.id, 'outreach', new.user_id,
            least(coalesce(new.reached_out_on, current_date), current_date))
    on conflict do nothing;
  end if;

  -- A status a student invented isn't on the ladder, so it earns nothing past
  -- 'applied' — the same rule the funnel chart uses.
  reached := case new.status
    when 'Screening'       then 1
    when 'OA / Assessment' then 2
    when 'Interviewing'    then 3
    when 'Final round'     then 4
    when 'Offer'           then 5
    when 'Accepted'        then 6
    else 0 end;

  -- Skipping a stage still earns it: the ladder counts how far you got, not
  -- which boxes the employer happened to use.
  insert into public.points (application_id, milestone, user_id, earned_on)
  select new.id, m.key, new.user_id,
         -- A row that arrives already advanced belongs to that application's
         -- own timeline; a row advanced today happened today.
         case when tg_op = 'INSERT' then applied_on else current_date end
    from (values ('screening', 1), ('assessment', 2), ('interviewing', 3),
                 ('final', 4), ('offer', 5), ('accepted', 6)) as m(key, rank)
   where m.rank <= reached
  on conflict do nothing;

  return new;
end $$;

drop trigger if exists applications_award_points on public.applications;
create trigger applications_award_points after insert or update on public.applications
  for each row execute function public.award_points();

-- Backfill what everyone has already logged.
insert into public.points (application_id, milestone, user_id, earned_on)
select a.id, m.key, a.user_id, least(coalesce(a.date_applied, a.created_at::date), current_date)
  from public.applications a
  cross join lateral (values
    ('applied',      case when a.status is distinct from 'Wishlist' then 1 else 0 end),
    ('outreach',     case when a.reached_out_on is not null or a.outreach_method is not null then 1 else 0 end),
    ('screening',    case when a.status in ('Screening', 'OA / Assessment', 'Interviewing', 'Final round', 'Offer', 'Accepted') then 1 else 0 end),
    ('assessment',   case when a.status in ('OA / Assessment', 'Interviewing', 'Final round', 'Offer', 'Accepted') then 1 else 0 end),
    ('interviewing', case when a.status in ('Interviewing', 'Final round', 'Offer', 'Accepted') then 1 else 0 end),
    ('final',        case when a.status in ('Final round', 'Offer', 'Accepted') then 1 else 0 end),
    ('offer',        case when a.status in ('Offer', 'Accepted') then 1 else 0 end),
    ('accepted',     case when a.status = 'Accepted' then 1 else 0 end)
  ) as m(key, hit)
 where m.hit = 1
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- leagues
-- ---------------------------------------------------------------------------
create table if not exists public.leagues (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  join_code  text not null unique,
  owner_id   text not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.league_members (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id   text not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index if not exists league_members_user_idx on public.league_members (user_id);

-- Security definer, so a policy on league_members can ask "are we in the same
-- league?" without reading league_members through its own policy (which
-- Postgres would reject as infinite recursion).
--
-- It lives in `private` rather than `public`: PostgREST only exposes `public`,
-- and a policy helper has no business being an API endpoint. The policies that
-- call it run as the signed-in user, so `authenticated` needs EXECUTE.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_league_member(p_league_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.league_members
     where league_id = p_league_id and user_id = (select auth.jwt()->>'sub')
  );
$$;
revoke all on function private.is_league_member(uuid) from public, anon;
grant execute on function private.is_league_member(uuid) to authenticated;

alter table public.leagues        enable row level security;
alter table public.league_members enable row level security;
alter table public.points         enable row level security;
alter table public.point_values   enable row level security;

-- The owner is named explicitly as well as through membership: without it the
-- league can't be read back at the moment it is created (the membership row
-- doesn't exist yet, and `insert … returning` is checked against this policy).
drop policy if exists "leagues: members read" on public.leagues;
create policy "leagues: members read" on public.leagues
  for select to authenticated using (
    (select auth.jwt()->>'sub') = owner_id or private.is_league_member(id));
drop policy if exists "leagues: owner creates" on public.leagues;
create policy "leagues: owner creates" on public.leagues
  for insert to authenticated with check ((select auth.jwt()->>'sub') = owner_id);
drop policy if exists "leagues: owner writes" on public.leagues;
create policy "leagues: owner writes" on public.leagues
  for update to authenticated using ((select auth.jwt()->>'sub') = owner_id)
  with check ((select auth.jwt()->>'sub') = owner_id);
drop policy if exists "leagues: owner deletes" on public.leagues;
create policy "leagues: owner deletes" on public.leagues
  for delete to authenticated using ((select auth.jwt()->>'sub') = owner_id);

-- Members can see who else is in their leagues, but that is all: the row holds
-- a user id and a date, and names and scores only come from league_board().
drop policy if exists "members: same league reads" on public.league_members;
create policy "members: same league reads" on public.league_members
  for select to authenticated using (private.is_league_member(league_id));
-- Only the owner's own first membership is written directly (by create); every
-- other join goes through join_league(), which demands the invite code. So
-- knowing a league's id is not by itself a way in.
drop policy if exists "members: join self" on public.league_members;
create policy "members: join self" on public.league_members
  for insert to authenticated with check (
    (select auth.jwt()->>'sub') = user_id
    and exists (select 1 from public.leagues l
                 where l.id = league_id and l.owner_id = (select auth.jwt()->>'sub')));
drop policy if exists "members: leave self" on public.league_members;
create policy "members: leave self" on public.league_members
  for delete to authenticated using (
    (select auth.jwt()->>'sub') = user_id
    or exists (select 1 from public.leagues l
                where l.id = league_id and l.owner_id = (select auth.jwt()->>'sub')));

-- Your own ledger is readable (the site shows your points outside a league);
-- everyone else's is reachable only through league_board(). Nothing writes to
-- it but the trigger, which is security definer.
drop policy if exists "points: own read" on public.points;
create policy "points: own read" on public.points
  for select to authenticated using ((select auth.jwt()->>'sub') = user_id);

drop policy if exists "point values: read" on public.point_values;
create policy "point values: read" on public.point_values
  for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- joining, and the board itself
-- ---------------------------------------------------------------------------
create or replace function public.join_league(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid text := (select auth.jwt()->>'sub');
  v_id  uuid;
begin
  if v_uid is null then raise exception 'Sign in first'; end if;
  select id into v_id from public.leagues
   where join_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if v_id is null then raise exception 'No league has that code'; end if;
  insert into public.league_members (league_id, user_id) values (v_id, v_uid)
  on conflict do nothing;
  return v_id;
end $$;

-- One row per member: their name, their points for the week, the month and all
-- time, and — only if they chose to show them — the counts behind those points.
drop function if exists public.league_board(uuid);
create function public.league_board(p_league_id uuid)
returns table (
  user_id       text,
  display_name  text,
  detail        text,
  joined_at     timestamptz,
  points_week   int,
  points_month  int,
  points_total  int,
  applied_week  int,
  applied_month int,
  applied_total int,
  interviews    int,
  offers        int,
  weekly_goal   int,
  monthly_goal  int
)
language plpgsql security definer set search_path = public stable as $$
declare
  v_uid   text := (select auth.jwt()->>'sub');
  v_week  date := date_trunc('week',  current_date)::date;   -- Monday, as in the charts
  v_month date := date_trunc('month', current_date)::date;
begin
  -- Aliased: the OUT parameters above are plpgsql variables, so a bare
  -- `user_id` here would be ambiguous.
  if not exists (select 1 from public.league_members lm
                  where lm.league_id = p_league_id and lm.user_id = v_uid) then
    raise exception 'Not a member of this league';
  end if;

  return query
  with scored as (
    select p.user_id as uid,
           sum(v.points)                                                as total,
           sum(v.points) filter (where p.earned_on >= v_week)           as week,
           sum(v.points) filter (where p.earned_on >= v_month)          as month,
           count(*) filter (where p.milestone = 'applied'
                              and p.earned_on >= v_week)                as app_week,
           count(*) filter (where p.milestone = 'applied'
                              and p.earned_on >= v_month)               as app_month,
           count(*) filter (where p.milestone = 'applied')              as app_total,
           count(*) filter (where p.milestone = 'interviewing')         as n_interviews,
           count(*) filter (where p.milestone = 'offer')                as n_offers
      from public.points p
      join public.point_values v on v.milestone = p.milestone
     group by p.user_id
  )
  select m.user_id,
         coalesce(nullif(trim(pr.display_name), ''), split_part(pr.email, '@', 1), 'Student'),
         pr.leaderboard_detail,
         m.joined_at,
         coalesce(s.week, 0)::int,
         coalesce(s.month, 0)::int,
         coalesce(s.total, 0)::int,
         -- Counts are withheld for a member who asked for points only. Their
         -- own row still shows everything to themselves.
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.app_week, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.app_month, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.app_total, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.n_interviews, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.n_offers, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then pr.weekly_goal end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then pr.monthly_goal end
    from public.league_members m
    join public.profiles pr on pr.id = m.user_id
    left join scored s on s.uid = m.user_id
   where m.league_id = p_league_id;
end $$;

-- Only the two functions the website calls are reachable over the API, and
-- only when signed in. award_points is a trigger function: the trigger runs it
-- regardless, so nothing needs EXECUTE on it.
revoke all on function public.award_points()     from public, anon, authenticated;
revoke all on function public.league_board(uuid) from public, anon;
revoke all on function public.join_league(text)  from public, anon;
grant execute on function public.league_board(uuid) to authenticated;
grant execute on function public.join_league(text)  to authenticated;
