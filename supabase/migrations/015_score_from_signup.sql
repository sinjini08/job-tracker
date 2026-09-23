-- 015: you score from the day you joined, not from the day you applied.
--
-- date_applied and reached_out_on are typed by the student, and the trigger
-- only ever capped the top end (nothing scores in the future). There was no
-- floor, so logging a job applied for last March put a point in March. That
-- could not win a settled week, because league_results freezes a period when
-- it ends, but it did inflate the running month and the all-time total, and
-- it let someone arrive and immediately outrank people who had been playing.
--
-- Backfilling is a legitimate thing to do, so the application is still
-- recorded in full and still shows in the charts, which is where an honest
-- history belongs. It just earns nothing. The rule states in one line:
-- applications dated before you joined are recorded, but do not score.
--
-- Stage milestones need no floor. They are already stamped with the day they
-- were recorded, which is never before the student existed.
--
-- Points already awarded are left alone, for the same reason as 014: moving a
-- member's board under them for a rule that did not exist is worse than a
-- little inconsistency in the first week.

create or replace function public.award_points() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  reached    int;
  applied_on date := least(coalesce(new.date_applied, current_date), current_date);
  joined     date;
begin
  -- A half-typed row earns nothing. Nothing is lost by waiting: the trigger
  -- runs again on the edit that fills the missing half, and pays out then.
  if coalesce(trim(new.role), '') = '' or coalesce(trim(new.company), '') = '' then
    return new;
  end if;

  -- The day this student joined. Falls back to the beginning of time rather
  -- than to today, so a missing profile row can never silently stop somebody
  -- scoring; the foreign key means it should not happen either way.
  select pr.created_at::date into joined from public.profiles pr where pr.id = new.user_id;
  joined := coalesce(joined, date '0001-01-01');

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

  -- Anything off the wishlist has been applied to, as long as it was applied
  -- to while they were here.
  if new.status is distinct from 'Wishlist' and applied_on >= joined then
    insert into public.points (application_id, milestone, user_id, earned_on)
    values (new.id, 'applied', new.user_id, applied_on)
    on conflict do nothing;
  end if;

  if (new.reached_out_on is not null or new.outreach_method is not null)
     and least(coalesce(new.reached_out_on, current_date), current_date) >= joined then
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
  -- Advancing a backfilled application therefore does score: the advance
  -- happened while they were a member, even if the application predates them.
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
