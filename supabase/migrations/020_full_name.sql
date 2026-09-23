-- 020: the name behind the name on the board.
--
-- display_name is a handle. It defaults to the part of an email before the @,
-- so a league full of friends can read "mrmalpani25" and not be sure who that
-- is. full_name is the answer to that, and only that: it is blank until the
-- student types it in, and the board shows it only when someone taps a name.
--
-- Who can see it: league_board already refuses anyone who is not a member of
-- the league being asked about, so adding the column to its result shares a
-- name with that student's own league mates and nobody else. It is not in
-- league_history, league_months or any public share.
--
-- The return type of a function cannot be changed in place, so league_board is
-- dropped and rebuilt. The body below is the one from 012 with a single column
-- added; EXECUTE is re-granted at the end, because a drop takes the grants
-- with it and the API role needs them back.

alter table public.profiles add column if not exists full_name text;

comment on column public.profiles.full_name is
  'Optional real name, shown to league mates when they tap this student''s name on a board. Blank unless they fill it in.';

drop function if exists public.league_board(uuid);

create function public.league_board(p_league_id uuid)
returns table (
  user_id text, display_name text, full_name text, avatar text, detail text,
  joined_at timestamptz, points_today int, points_week int, points_month int,
  points_total int, bonus_month int, day_wins_month int, week_wins_month int,
  applied_week int, applied_month int, applied_total int, interviews int,
  offers int, days_hit_week int, days_hit_month int, streak_days int,
  daily int[]
)
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid    text := (select auth.jwt()->>'sub');
  v_week   date := date_trunc('week',  current_date)::date;
  v_month  date := date_trunc('month', current_date)::date;
  v_mend   date := (date_trunc('month', current_date) + interval '1 month')::date - 1;
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
         -- Null rather than a fallback: the board has to be able to tell
         -- "they wrote their name" from "they didn't", and say so.
         nullif(trim(pr.full_name), ''),
         pr.avatar,
         pr.leaderboard_detail,
         m.joined_at,
         t.today,
         coalesce(s.week, 0)::int,
         -- the month carries the bonuses; the week and the day never do
         (coalesce(s.month, 0) + b.bonus)::int,
         coalesce(s.total, 0)::int,
         b.bonus,
         b.day_wins,
         b.week_wins,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.app_week, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.app_month, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.app_total, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.n_interviews, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.n_offers, 0)::int end,
         d.hit_week,
         d.hit_month,
         d.streak,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then d.daily end
    from public.league_members m
    join public.profiles pr on pr.id = m.user_id
    left join scored s on s.uid = m.user_id
    left join lateral (
      select dp.pts as today from private.day_points(m.user_id, current_date, current_date) dp
    ) t on true
    left join lateral (
      select
        coalesce(count(*) filter (where r.period = 'day'), 0)::int as day_wins,
        coalesce(count(*) filter (where r.period = 'week'), 0)::int as week_wins,
        coalesce(sum(case r.period when 'day' then 1 when 'week' then 2 else 0 end), 0)::int as bonus
        from public.league_results r
       where r.league_id = p_league_id and r.user_id = m.user_id and r.won
         and r.period in ('day', 'week')
         and r.period_start between v_month and v_mend
    ) b on true
    left join lateral (
      select
        (select array_agg(x.pts order by x.day)
           from private.day_points(m.user_id, current_date - (v_span - 1), current_date) x) as daily,
        (select count(*)::int from private.day_points(m.user_id, v_week, current_date) x
          where x.pts >= v_target) as hit_week,
        (select count(*)::int from private.day_points(m.user_id, v_month, current_date) x
          where x.pts >= v_target) as hit_month,
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

-- A drop takes the grants with it, so put back exactly what was there.
revoke all on function public.league_board(uuid) from public, anon;
grant execute on function public.league_board(uuid) to authenticated, service_role;
