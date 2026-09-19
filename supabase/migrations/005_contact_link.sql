-- 005: recruiters often only have a LinkedIn profile, not a findable email.
alter table public.applications add column if not exists contact_link text;
comment on column public.applications.contact_link is 'LinkedIn profile or other URL for the contact, when no email is available';
