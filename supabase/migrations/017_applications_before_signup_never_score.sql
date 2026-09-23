-- 017: an application dated before you joined never scores, at all.
--
-- The rule, in one line: applications dated before you first signed in are
-- recorded, but never score in a league.
--
-- 015 tried a softer version, flooring the applied and outreach points while
-- still letting stage progress score, so a backfilled application could
-- nudge the board anyway. 016 reverted it. This gates the whole application
-- instead, which is both stricter and far easier to explain, and it means
-- advancing an old application later cannot sneak points in through the
-- ladder either.
--
-- Recorded in full, so the sheet and the charts keep an honest history of the
-- entire search. Worth nothing in the league, so nobody arrives with six
-- months of backlog and outranks people who have been playing.
--
-- Applied with the matching one-off: points already awarded for applications
-- that predate their owner's signup were deleted, scoped by that same rule
-- rather than by row id.

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

  -- The whole gate, in one place. An application you sent before you were
  -- here is history, not activity, so none of it scores.
  if applied_on < joined then
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

  reached := case new.status
    when 'Screening'       then 1
    when 'OA / Assessment' then 2
    when 'Interviewing'    then 3
    when 'Final round'     then 4
    when 'Offer'           then 5
    when 'Accepted'        then 6
    else 0 end;

  -- Dated to the day it was recorded, so nothing claims you interviewed on
  -- the day you applied.
  insert into public.points (application_id, milestone, user_id, earned_on)
  select new.id, m.key, new.user_id, current_date
    from (values ('screening', 1), ('assessment', 2), ('interviewing', 3),
                 ('final', 4), ('offer', 5), ('accepted', 6)) as m(key, rank)
   where m.rank <= reached
  on conflict do nothing;

  return new;
end $$;

revoke all on function public.award_points() from public, anon, authenticated;

-- One-off, run with the migration: points already granted for applications
-- that predate their owner's signup.
delete from public.points p
 using public.applications a, public.profiles pr
 where a.id = p.application_id
   and pr.id = p.user_id
   and a.date_applied < pr.created_at::date;
