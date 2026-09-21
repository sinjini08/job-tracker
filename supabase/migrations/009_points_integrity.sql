-- 009: make points harder to pad, and make padding visible.
--
-- A self-reported tracker can always be lied to. These rules don't try to
-- prove an application happened; they make faking one cost about as much
-- effort as making a real one, and they put the shape of someone's week on
-- the board so their friends can see it.
--
--   1. A row scores only once it names a real job (a role AND a company), and
--      the same job logged twice scores once.
--   2. league_board() returns a 14-day trace of applications per day, so
--      "four a day for a fortnight" and "thirty on a Tuesday night" don't
--      look the same.

-- ---------------------------------------------------------------------------
-- 1. qualifying rows
-- ---------------------------------------------------------------------------
create or replace function public.award_points() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  reached  int;
  applied_on date := least(coalesce(new.date_applied, current_date), current_date);
begin
  -- A half-typed row earns nothing. Nothing is lost by waiting: the trigger
  -- runs again on the edit that fills the missing half, and pays out then.
  if coalesce(trim(new.role), '') = '' or coalesce(trim(new.company), '') = '' then
    return new;
  end if;

  -- The same job logged twice scores once. Term is part of a job's identity,
  -- so applying to the same role again next summer is a new application.
  if exists (
    select 1
      from public.applications a
      join public.points p on p.application_id = a.id
     where a.user_id = new.user_id
       and a.id <> new.id
       and lower(trim(a.role)) = lower(trim(new.role))
       and lower(trim(coalesce(a.company, ''))) = lower(trim(coalesce(new.company, '')))
       and lower(trim(coalesce(a.term, ''))) = lower(trim(coalesce(new.term, '')))
  ) then
    return new;
  end if;

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

-- One-off: points already granted to rows that don't name a job.
delete from public.points p
 using public.applications a
 where a.id = p.application_id
   and (coalesce(trim(a.role), '') = '' or coalesce(trim(a.company), '') = '');

-- ---------------------------------------------------------------------------
-- 2. the board carries a 14-day trace
-- ---------------------------------------------------------------------------
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
  monthly_goal  int,
  daily         int[]
)
language plpgsql security definer set search_path = public stable as $$
declare
  v_uid   text := (select auth.jwt()->>'sub');
  v_week  date := date_trunc('week',  current_date)::date;
  v_month date := date_trunc('month', current_date)::date;
begin
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
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.app_week, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.app_month, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.app_total, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.n_interviews, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then coalesce(s.n_offers, 0)::int end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then pr.weekly_goal end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then pr.monthly_goal end,
         case when pr.leaderboard_detail = 'counts' or m.user_id = v_uid then sp.daily end
    from public.league_members m
    join public.profiles pr on pr.id = m.user_id
    left join scored s on s.uid = m.user_id
    -- Applications per day for the last fortnight, oldest first.
    left join lateral (
      select array_agg(x.n order by x.day) as daily
        from (
          select g.ts::date as day,
                 (select count(*) from public.points p
                   where p.user_id = m.user_id
                     and p.milestone = 'applied'
                     and p.earned_on = g.ts::date)::int as n
            from generate_series(current_date - 13, current_date, interval '1 day') g(ts)
        ) x
    ) sp on true
   where m.league_id = p_league_id;
end $$;

revoke all on function public.award_points()     from public, anon, authenticated;
revoke all on function public.league_board(uuid) from public, anon;
grant execute on function public.league_board(uuid) to authenticated;
