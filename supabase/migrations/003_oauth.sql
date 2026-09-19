-- 003: the site becomes an OAuth 2.1 authorization server, so MCP clients
-- (Claude) connect by sending the student through a sign-in + consent screen
-- instead of pasting a secret link.
--
-- Nothing here is reachable with the anon or authenticated keys: RLS is on with
-- no policies, and only the server (service role) touches these tables.

-- Registered clients. Claude registers itself dynamically (RFC 7591), or
-- identifies itself with a metadata URL (CIMD), which we cache here.
create table if not exists public.oauth_clients (
  client_id      text primary key,
  client_name    text,
  redirect_uris  text[] not null,
  is_cimd        boolean not null default false,   -- client_id is an https metadata URL
  created_at     timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);

-- Short-lived authorization codes (PKCE). Stored hashed; single use.
create table if not exists public.oauth_codes (
  code_hash      text primary key,
  client_id      text not null references public.oauth_clients(client_id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  redirect_uri   text not null,
  code_challenge text not null,
  scope          text,
  resource       text,
  expires_at     timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists oauth_codes_expiry on public.oauth_codes (expires_at);

-- Access + refresh tokens, hashed. One row per connection.
create table if not exists public.oauth_tokens (
  id                uuid primary key default gen_random_uuid(),
  access_hash       text unique not null,
  refresh_hash      text unique,
  client_id         text not null references public.oauth_clients(client_id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  scope             text,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  revoked_at        timestamptz,
  created_at        timestamptz not null default now(),
  last_used_at      timestamptz
);
create index if not exists oauth_tokens_user on public.oauth_tokens (user_id, revoked_at);

alter table public.oauth_clients enable row level security;
alter table public.oauth_codes   enable row level security;
alter table public.oauth_tokens  enable row level security;

-- Housekeeping: drop expired codes and long-dead tokens. Called by the server
-- occasionally; there's no cron on the free plan.
create or replace function public.oauth_cleanup() returns void
language sql security definer set search_path = '' as $$
  delete from public.oauth_codes where expires_at < now() - interval '1 day';
  delete from public.oauth_tokens
    where (revoked_at is not null and revoked_at < now() - interval '30 days')
       or (coalesce(refresh_expires_at, access_expires_at) < now() - interval '30 days');
$$;
revoke execute on function public.oauth_cleanup() from public, anon, authenticated;
