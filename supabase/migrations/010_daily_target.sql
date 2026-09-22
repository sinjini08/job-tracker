-- 010: a daily target, and winners that are actually decided.
--
-- Three tiers now. Every day you either clear the league's daily target or you
-- don't; that builds a streak and a count of days hit. When a week or a month
-- ends it is settled once and kept, so "last week's winner" stops changing the
-- moment the week is over.
--
-- The personal weekly/monthly application goals are replaced by the daily
-- target: one bar, the same for everyone in the league, so days hit are
-- comparable between friends.

-- 10 points is about ten applications, or seven plus an interview: a focused
-- evening clears it, an ordinary class day doesn't. The owner can change it
-- per league, so this is only where a new league starts.
alter table public.leagues add column if not exists daily_target int not null default 10;
alter table public.leagues alter column daily_target set default 10;
alter table public.leagues drop constraint if exists leagues_target_check;
alter table public.leagues add constraint leagues_target_check
  check (daily_target between 1 and 500);

alter table public.profiles drop constraint if exists profiles_goal_check;
alter table public.profiles drop column if exists weekly_goal;
alter table public.profiles drop column if exists monthly_goal;

-- ---------------------------------------------------------------------------
-- settled results: one row per winner per period. Ties store a row each, so a
-- shared week reads as a shared week.
-- ---------------------------------------------------------------------------
create table if not exists public.league_results (
  league_id    uuid not null references public.leagues(id) on delete cascade,
  period       text not null check (period in ('week', 'month')),
  period_start date not null,
  user_id      text not null references public.profiles(id) on delete cascade,
  points       int  not null,
  days_hit     int  not null,
  decided_at   timestamptz not null default now(),
  primary key (league_id, period, period_start, user_id)
);

alter table public.league_results enable row level security;
drop policy if exists "results: members read" on public.league_results;
create policy "results: members read" on public.league_results
  for select to authenticated using (private.is_league_member(league_id));

-- ---------------------------------------------------------------------------
-- points earned per day, the unit everything here is counted in
-- ---------------------------------------------------------------------------
create or replace function private.day_points(p_uid text, p_from date, p_to date)
returns table (day date, pts int)
language sql security definer stable set search_path = public as $$
  select g.ts::date,
         coalesce((select sum(v.points)::int
                     from public.points p
                     join public.point_values v using (milestone)
                    where p.user_id = p_uid and p.earned_on = g.ts::date), 0)
    from generate_series(p_from, p_to, interval '1 day') g(ts);
$$;
revoke all on function private.day_points(text, date, date) from public, anon;
grant execute on function private.day_points(text, date, date) to authenticated;

-- ---------------------------------------------------------------------------
-- settle every period that has finished and isn't recorded yet. Idempotent,
-- and cheap after the first run because the results row already exists. Called
-- by the API just before it reads the board, so no scheduler is needed.
-- ---------------------------------------------------------------------------
create or replace function public.league_settle(p_league_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_uid     text := (select auth.jwt()->>'sub');
  v_target  int;
  v_born    date;
  v_start   date;
  v_end     date;
  v_written int := 0;
begin
  if not exists (select 1 from public.league_members lm
                  where lm.league_id = p_league_id and lm.user_id = v_uid) then
    raise exception 'Not a member of this league';
  end if;
  select daily_target, created_at::date into v_target, v_born
    from public.leagues where id = p_league_id;
  if v_target is null then return 0; end if;

  -- Completed weeks, back to the league's first week (capped at half a year so
  -- a long-dormant league can't turn one page load into a hundred inserts).
  for v_start in
    select g.ts::date
      from generate_series(
        greatest(date_trunc('week', v_born)::date,
                 date_trunc('week', current_date)::date - 182),
        date_trunc('week', current_date)::date - 7,
        interval '7 day') g(ts)
  loop
    v_end := v_start + 6;
    -- Nobody in this league earned anything that week: no winner to record,
    -- and this cheap indexed check keeps dead weeks from being re-tallied on
    -- every page load.
    continue when not exists (
      select 1 from public.points p
       join public.league_members lm on lm.user_id = p.user_id
      where lm.league_id = p_league_id and p.earned_on between v_start and v_end);

    if not exists (select 1 from public.league_results r
                    where r.league_id = p_league_id and r.period = 'week'
                      and r.period_start = v_start) then
      insert into public.league_results (league_id, period, period_start, user_id, points, days_hit)
      with tallied as (
        select lm.user_id as uid,
               coalesce((select sum(dp.pts)::int from private.day_points(lm.user_id, v_start, v_end) dp), 0) as pts,
               (select count(*)::int from private.day_points(lm.user_id, v_start, v_end) dp
                 where dp.pts >= v_target) as hits
          from public.league_members lm
         where lm.league_id = p_league_id
      )
      select p_league_id, 'week', v_start, t.uid, t.pts, t.hits
        from tallied t
       where t.pts > 0 and t.pts = (select max(t2.pts) from tallied t2)
      on conflict do nothing;
      v_written := v_written + 1;
    end if;
  end loop;

  -- Completed months, same rules.
  for v_start in
    select g.ts::date
      from generate_series(
        greatest(date_trunc('month', v_born)::date,
                 date_trunc('month', current_date)::date - interval '12 month'),
        date_trunc('month', current_date)::date - interval '1 month',
        interval '1 month') g(ts)
  loop
    v_end := (v_start + interval '1 month')::date - 1;
    continue when not exists (
      select 1 from public.points p
       join public.league_members lm on lm.user_id = p.user_id
      where lm.league_id = p_league_id and p.earned_on between v_start and v_end);

    if not exists (select 1 from public.league_results r
                    where r.league_id = p_league_id and r.period = 'month'
                      and r.period_start = v_start) then
      insert into public.league_results (league_id, period, period_start, user_id, points, days_hit)
      with tallied as (
        select lm.user_id as uid,
               coalesce((select sum(dp.pts)::int from private.day_points(lm.user_id, v_start, v_end) dp), 0) as pts,
               (select count(*)::int from private.day_points(lm.user_id, v_start, v_end) dp
                 where dp.pts >= v_target) as hits
          from public.league_members lm
         where lm.league_id = p_league_id
      )
      select p_league_id, 'month', v_start, t.uid, t.pts, t.hits
        from tallied t
       where t.pts > 0 and t.pts = (select max(t2.pts) from tallied t2)
      on conflict do nothing;
      v_written := v_written + 1;
    end if;
  end loop;

  return v_written;
end $$;

-- ---------------------------------------------------------------------------
-- the board, now carrying today, the streak, and days hit
-- ---------------------------------------------------------------------------
drop function if exists public.league_board(uuid);
create function public.league_board(p_league_id uuid)
returns table (
  user_id        text,
  display_name   text,
  detail         text,
  joined_at      timestamptz,
  points_today   int,
  points_week    int,
  points_month   int,
  points_total   int,
  applied_week   int,
  applied_month  int,
  applied_total  int,
  interviews     int,
  offers         int,
  days_hit_week  int,
  days_hit_month int,
  streak_days    int,
  daily          int[]
)
language plpgsql security definer set search_path = public stable as $$
declare
  v_uid    text := (select auth.jwt()->>'sub');
  v_week   date := date_trunc('week',  current_date)::date;   -- Monday, as in the charts
  v_month  date := date_trunc('month', current_date)::date;
  v_target int;
begin
  if not exists (select 1 from public.league_members lm
                  where lm.league_id = p_league_id and lm.user_id = v_uid) then
    raise exception 'Not a member of this league';
  end if;
  select daily_target into v_target from public.leagues where id = p_league_id;

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
         t.today,
         coalesce(s.week, 0)::int,
         coalesce(s.month, 0)::int,
         coalesce(s.total, 0)::int,
         -- Application counts are what "points only" hides. Everything counted
         -- in points stays, or that member has no place in the daily race.
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.app_week, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.app_month, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.app_total, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.n_interviews, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.n_offers, 0)::int end,
         d.hit_week,
         d.hit_month,
         d.streak,
         -- The day-by-day trace is the most granular thing here, so it follows
         -- the counts rather than the totals.
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then d.daily end
    from public.league_members m
    join public.profiles pr on pr.id = m.user_id
    left join scored s on s.uid = m.user_id
    left join lateral (
      select dp.pts as today from private.day_points(m.user_id, current_date, current_date) dp
    ) t on true
    left join lateral (
      select
        (select array_agg(x.pts order by x.day)
           from private.day_points(m.user_id, current_date - 13, current_date) x) as daily,
        (select count(*)::int from private.day_points(m.user_id, v_week, current_date) x
          where x.pts >= v_target) as hit_week,
        (select count(*)::int from private.day_points(m.user_id, v_month, current_date) x
          where x.pts >= v_target) as hit_month,
        -- Days in a row ending today — or ending yesterday, while today is
        -- still in play, so an unfinished day doesn't break a run.
        (select count(*)::int from (
           select sum(case when x.pts >= v_target then 0 else 1 end)
                    over (order by x.day desc) as miss
             from private.day_points(
                    m.user_id,
                    current_date - 90,
                    case when t.today >= v_target then current_date else current_date - 1 end) x
         ) run where run.miss = 0) as streak
    ) d on true
   where m.league_id = p_league_id;
end $$;

revoke all on function public.league_board(uuid)  from public, anon;
revoke all on function public.league_settle(uuid) from public, anon;
grant execute on function public.league_board(uuid)  to authenticated;
grant execute on function public.league_settle(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- past winners. Like league_board, names cross between accounts only here.
-- ---------------------------------------------------------------------------
create or replace function public.league_history(p_league_id uuid)
returns table (period text, period_start date, winner text, points int, days_hit int)
language plpgsql security definer stable set search_path = public as $$
declare v_uid text := (select auth.jwt()->>'sub');
begin
  if not exists (select 1 from public.league_members lm
                  where lm.league_id = p_league_id and lm.user_id = v_uid) then
    raise exception 'Not a member of this league';
  end if;
  return query
  select r.period, r.period_start,
         coalesce(nullif(trim(pr.display_name), ''), split_part(pr.email, '@', 1), 'Student'),
         r.points, r.days_hit
    from public.league_results r
    join public.profiles pr on pr.id = r.user_id
   where r.league_id = p_league_id
   order by r.period_start desc, r.period, r.points desc
   limit 24;
end $$;

revoke all on function public.league_history(uuid) from public, anon;
grant execute on function public.league_history(uuid) to authenticated;
