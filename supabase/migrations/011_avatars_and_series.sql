-- 011: avatars, and a long enough daily series to draw a month.
--
--   * profiles.avatar holds one emoji from the allow-list in lib/avatars.js.
--     It's identity, not data, so it shows even for a member who keeps their
--     counts private, and the API validates it against the same list.
--   * league_board's `daily` grows from 14 to 35 days: the month chart needs a
--     whole month, and the fortnight trace just takes the tail.
--   * my_points_daily() is the same series for the signed-in student alone, so
--     the Charts tab can draw it without them being in a league. It takes no
--     user id — it reads the caller's own — so there is nothing to point at
--     somebody else.

alter table public.profiles add column if not exists avatar text;

create or replace function public.my_points_daily(p_days int default 35)
returns table (day date, pts int)
language sql security definer stable set search_path = public as $$
  select d.day, d.pts
    from private.day_points(
      (select auth.jwt()->>'sub'),
      current_date - (least(greatest(coalesce(p_days, 35), 1), 400) - 1),
      current_date) d;
$$;
revoke all on function public.my_points_daily(int) from public, anon;
grant execute on function public.my_points_daily(int) to authenticated;

drop function if exists public.league_board(uuid);
create function public.league_board(p_league_id uuid)
returns table (
  user_id        text,
  display_name   text,
  avatar         text,
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
  v_span   int := 35;
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
         pr.avatar,
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
         -- The day-by-day series is the most granular thing here, so it
         -- follows the counts rather than the totals.
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
           from private.day_points(m.user_id, current_date - (v_span - 1), current_date) x) as daily,
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

revoke all on function public.league_board(uuid) from public, anon;
grant execute on function public.league_board(uuid) to authenticated;

drop function if exists public.league_history(uuid);
create function public.league_history(p_league_id uuid)
returns table (period text, period_start date, user_id text, winner text, avatar text,
               points int, days_hit int)
language plpgsql security definer stable set search_path = public as $$
declare v_uid text := (select auth.jwt()->>'sub');
begin
  if not exists (select 1 from public.league_members lm
                  where lm.league_id = p_league_id and lm.user_id = v_uid) then
    raise exception 'Not a member of this league';
  end if;
  return query
  select r.period, r.period_start, r.user_id,
         coalesce(nullif(trim(pr.display_name), ''), split_part(pr.email, '@', 1), 'Student'),
         pr.avatar, r.points, r.days_hit
    from public.league_results r
    join public.profiles pr on pr.id = r.user_id
   where r.league_id = p_league_id
   order by r.period_start desc, r.period, r.points desc
   limit 24;
end $$;
revoke all on function public.league_history(uuid) from public, anon;
grant execute on function public.league_history(uuid) to authenticated;
