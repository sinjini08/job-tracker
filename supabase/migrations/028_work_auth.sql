-- 028: whether a posting will take you, before anything else about it matters.
--
-- Every posting that says this says it somewhere different and in its own
-- words. IBM buries "IBM will not be providing visa sponsorship for this
-- position now or in the future" in a paragraph of legal boilerplate near the
-- bottom. Jobright files "No H1B" and "U.S. Citizen Only" under tags of its
-- own, away from the requirements. Handshake writes "Work authorisation
-- required, open to candidates with OPT/CPT" in its summary panel.
--
-- For an international student that line decides whether the rest of the
-- posting is worth reading at all, so it gets a column rather than a sentence
-- buried in the description, and can be filtered and counted like anything
-- else.
--
-- Text rather than an enum, and nullable, for the same reasons as every other
-- dropdown here: migration 007 took the constraints off so somebody can type
-- what their posting actually said, and existing rows need no backfill.
alter table public.applications add column if not exists work_auth text;

comment on column public.applications.work_auth is
  'Who the posting will consider: sponsorship, citizenship, clearance, OPT/CPT. Null when the posting does not say.';
