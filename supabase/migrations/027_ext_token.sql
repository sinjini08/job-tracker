-- 027: the browser extension's own token, separate from the connector's.
--
-- Same shape as mcp_token_hash: only a SHA-256 hash is kept, so a database
-- leak does not leak working tokens.
--
-- A separate column rather than reusing the connector's, because the two are
-- trusted differently. The connector token can read the whole tracker; this
-- one sits in browser storage on whatever machine somebody installed the
-- extension on, and the endpoint behind it only creates and updates
-- applications. Revoking one must not revoke the other.
alter table public.profiles add column if not exists ext_token_hash text;

comment on column public.profiles.ext_token_hash is
  'SHA-256 of the browser extension token. Null means no extension is paired.';

create unique index if not exists profiles_ext_token_hash_key
  on public.profiles (ext_token_hash) where ext_token_hash is not null;
