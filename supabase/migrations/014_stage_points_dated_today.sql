-- 014: a stage is reached on the day you say so, not the day you applied.
--
-- award_points used to date stage milestones differently depending on how the
-- row arrived:
--
--   case when tg_op = 'INSERT' then applied_on else current_date end
--
-- The idea was that a row arriving already advanced belongs to that
-- application's own timeline, which kept a backlog dump from winning today.
-- But it produced a claim that is plainly untrue: an application logged with
-- status Interviewing and a date_applied of last Friday scored "reached a
-- screening", "reached an assessment" and "reached an interview" all on last
-- Friday. Nobody interviews the day they apply.
--
-- It also made the league look broken. Logging an advanced application through
-- the connector moved the month and left Today and This week on zero, with
-- nothing on screen explaining why.
--
-- Now: applying is dated to date_applied, because that is a date the student
-- actually knows. Reaching out is dated to reached_out_on for the same reason.
-- Every rung of the ladder is dated to the day it was recorded, whether the
-- row advanced today or arrived already advanced, because that is the only day
-- we have any evidence for.
--
-- What stops a backlog dump is unchanged and lives elsewhere: a row scores
-- only once it names both a role and a company, and the same role, company and
-- term scores once however many times it is logged.
--
-- Points already awarded are left where they are. Re-dating them would move a
-- member's board under them for a rule that did not exist when they earned it.

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

  -- Anything off the wishlist has been applied to. This one keeps the date the
  -- student applied, which they know and we do not have to guess.
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
  -- which boxes the employer happened to use. All of them are dated to today,
  -- because the day a stage was recorded is the only day we can stand behind.
  insert into public.points (application_id, milestone, user_id, earned_on)
  select new.id, m.key, new.user_id, current_date
    from (values ('screening', 1), ('assessment', 2), ('interviewing', 3),
                 ('final', 4), ('offer', 5), ('accepted', 6)) as m(key, rank)
   where m.rank <= reached
  on conflict do nothing;

  return new;
end $$;

-- A trigger function runs as its owner, so nobody needs EXECUTE on it and
-- handing it out would let a caller mint points directly.
revoke all on function public.award_points() from public, anon, authenticated;
