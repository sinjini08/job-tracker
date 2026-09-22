-- 012: daily winners, bonus points, and a month you can look back at.
--
--   * Days get settled too. Whoever scored highest tops the day, and topping
--     a day is worth one bonus point on the month. Winning a week is worth
--     two. Bonuses land on the month only, never on the day or the week, so
--     they can't feed back into deciding who topped that day.
--   * A finished month stores a row for EVERY member, not just the winner, so
--     Stats can show the months after the live board has reset to zero.
--   * league_results.won marks the winning rows, since the table now holds
--     also-rans.
--
-- Applied to the database as two statements; kept here as one file.

alter table public.league_results drop constraint if exists league_results_period_check;
alter table public.league_results add column if not exists won boolean not null default true;
alter table public.league_results add constraint league_results_period_check
  check (period in ('day', 'week', 'month'));

create index if not exists league_results_bonus_idx
  on public.league_results (league_id, user_id, period, period_start);

create or replace function private.league_bonus(p_league_id uuid, p_uid text, p_from date, p_to date)
returns int language sql security definer stable set search_path = public as $$
  select coalesce(sum(case r.period when 'day' then 1 when 'week' then 2 else 0 end), 0)::int
    from public.league_results r
   where r.league_id = p_league_id and r.user_id = p_uid and r.won
     and r.period in ('day', 'week')
     and r.period_start between p_from and p_to;
$$;
revoke all on function private.league_bonus(uuid, text, date, date) from public, anon;
grant execute on function private.league_bonus(uuid, text, date, date) to authenticated;
-- The three functions below are the versions applied in the same migration.
-- league_settle: settles days, then weeks, then months (order matters, because
-- a month's total includes the bonuses banked by the days and weeks inside it).

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

  -- Finished days. Whoever scored highest topped that day, as long as they
  -- scored at all; a tie tops it together.
  for v_start in
    select g.ts::date
      from generate_series(greatest(v_born, current_date - 62), current_date - 1, interval '1 day') g(ts)
  loop
    continue when exists (select 1 from public.league_results r
                           where r.league_id = p_league_id and r.period = 'day'
                             and r.period_start = v_start);
    continue when not exists (
      select 1 from public.points p
       join public.league_members lm on lm.user_id = p.user_id
      where lm.league_id = p_league_id and p.earned_on = v_start);

    insert into public.league_results (league_id, period, period_start, user_id, points, days_hit, won)
    with tallied as (
      select lm.user_id as uid,
             coalesce((select sum(dp.pts)::int from private.day_points(lm.user_id, v_start, v_start) dp), 0) as pts
        from public.league_members lm
       where lm.league_id = p_league_id
    )
    select p_league_id, 'day', v_start, t.uid, t.pts,
           case when t.pts >= v_target then 1 else 0 end, true
      from tallied t
     where t.pts > 0 and t.pts = (select max(t2.pts) from tallied t2)
    on conflict do nothing;
    v_written := v_written + 1;
  end loop;

  -- Finished weeks: winners only.
  for v_start in
    select g.ts::date
      from generate_series(
        greatest(date_trunc('week', v_born)::date,
                 date_trunc('week', current_date)::date - 182),
        date_trunc('week', current_date)::date - 7,
        interval '7 day') g(ts)
  loop
    v_end := v_start + 6;
    continue when not exists (
      select 1 from public.points p
       join public.league_members lm on lm.user_id = p.user_id
      where lm.league_id = p_league_id and p.earned_on between v_start and v_end);

    if not exists (select 1 from public.league_results r
                    where r.league_id = p_league_id and r.period = 'week'
                      and r.period_start = v_start) then
      insert into public.league_results (league_id, period, period_start, user_id, points, days_hit, won)
      with tallied as (
        select lm.user_id as uid,
               coalesce((select sum(dp.pts)::int from private.day_points(lm.user_id, v_start, v_end) dp), 0) as pts,
               (select count(*)::int from private.day_points(lm.user_id, v_start, v_end) dp
                 where dp.pts >= v_target) as hits
          from public.league_members lm
         where lm.league_id = p_league_id
      )
      select p_league_id, 'week', v_start, t.uid, t.pts, t.hits, true
        from tallied t
       where t.pts > 0 and t.pts = (select max(t2.pts) from tallied t2)
      on conflict do nothing;
      v_written := v_written + 1;
    end if;
  end loop;

  -- Finished months: every member, so Stats can show the month after the
  -- board has reset. Points include the bonuses banked that month, which is
  -- why days and weeks are settled first.
  for v_start in
    select g.ts::date
      from generate_series(
        greatest(date_trunc('month', v_born)::date,
                 (date_trunc('month', current_date) - interval '12 month')::date),
        (date_trunc('month', current_date) - interval '1 month')::date,
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
      insert into public.league_results (league_id, period, period_start, user_id, points, days_hit, won)
      with tallied as (
        select lm.user_id as uid,
               coalesce((select sum(dp.pts)::int from private.day_points(lm.user_id, v_start, v_end) dp), 0)
                 + private.league_bonus(p_league_id, lm.user_id, v_start, v_end) as pts,
               (select count(*)::int from private.day_points(lm.user_id, v_start, v_end) dp
                 where dp.pts >= v_target) as hits
          from public.league_members lm
         where lm.league_id = p_league_id
      )
      select p_league_id, 'month', v_start, t.uid, t.pts, t.hits,
             t.pts > 0 and t.pts = (select max(t2.pts) from tallied t2)
        from tallied t
      on conflict do nothing;
      v_written := v_written + 1;
    end if;
  end loop;

  return v_written;
end $$;
revoke all on function public.league_settle(uuid) from public, anon;
grant execute on function public.league_settle(uuid) to authenticated;

-- league_board gains bonus_month, day_wins_month and week_wins_month, and
-- points_month is the base plus the bonus. The week and the day never carry it.
-- (Full body applied to the database; see 011 for the shape, the only changes
-- are the three new columns and the `b` lateral below.)

-- Winners for the week and month panels. Days are settled too, but there are
-- thirty of them a month, so they surface as a bonus count rather than a list.
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
   where r.league_id = p_league_id and r.won and r.period in ('week', 'month')
   order by r.period_start desc, r.period, r.points desc
   limit 24;
end $$;
revoke all on function public.league_history(uuid) from public, anon;
grant execute on function public.league_history(uuid) to authenticated;

-- Every member's settled month, for the across-months view in Stats. This is
-- what makes the monthly reset safe: the live board starts from zero, and the
-- months that came before are still here.
create or replace function public.league_months(p_league_id uuid)
returns table (period_start date, user_id text, member text, avatar text,
               points int, days_hit int, won boolean)
language plpgsql security definer stable set search_path = public as $$
declare v_uid text := (select auth.jwt()->>'sub');
begin
  if not exists (select 1 from public.league_members lm
                  where lm.league_id = p_league_id and lm.user_id = v_uid) then
    raise exception 'Not a member of this league';
  end if;
  return query
  select r.period_start, r.user_id,
         coalesce(nullif(trim(pr.display_name), ''), split_part(pr.email, '@', 1), 'Student'),
         pr.avatar, r.points, r.days_hit, r.won
    from public.league_results r
    join public.profiles pr on pr.id = r.user_id
   where r.league_id = p_league_id and r.period = 'month'
   order by r.period_start desc, r.points desc
   limit 200;
end $$;
revoke all on function public.league_months(uuid) from public, anon;
grant execute on function public.league_months(uuid) to authenticated;
