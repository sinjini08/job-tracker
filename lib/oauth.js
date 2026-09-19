import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from './supabase/server';

// OAuth 2.1 authorization server for MCP clients (Claude). Codes and tokens are
// random, stored only as SHA-256 hashes, and always tied to one student.

const CODE_TTL_MS = 10 * 60 * 1000;        // authorization code
const ACCESS_TTL_MS = 60 * 60 * 1000;      // access token
const REFRESH_TTL_MS = 30 * 24 * 3600e3;   // refresh token
export const SCOPE = 'tracker';

const sha = (s) => createHash('sha256').update(s).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
const db = () => supabaseAdmin();

const sameString = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

// A redirect URI must be https, or localhost for people testing locally.
export function validRedirectUri(uri) {
  try {
    const u = new URL(uri);
    if (u.hash) return false;
    return u.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(u.hostname);
  } catch {
    return false;
  }
}

// --- clients ---------------------------------------------------------------

export async function registerClient({ client_name, redirect_uris }) {
  const uris = (redirect_uris || []).filter(validRedirectUri);
  if (!uris.length) throw new Error('redirect_uris must contain at least one https (or localhost) URL');
  const client_id = `c_${randomBytes(16).toString('hex')}`;
  const { error } = await db().from('oauth_clients').insert({
    client_id,
    client_name: String(client_name ?? 'MCP client').slice(0, 120),
    redirect_uris: uris.slice(0, 10),
  });
  if (error) throw new Error(error.message);
  return { client_id, client_name, redirect_uris: uris };
}

// Client ID Metadata Documents: newer MCP clients identify themselves with an
// https URL serving their own metadata, instead of registering first.
async function clientFromMetadataUrl(clientId) {
  if (!/^https:\/\//.test(clientId)) return null;
  let doc;
  try {
    const res = await fetch(clientId, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    doc = await res.json();
  } catch {
    return null;
  }
  if (doc?.client_id && doc.client_id !== clientId) return null;
  const uris = (doc?.redirect_uris || []).filter(validRedirectUri);
  if (!uris.length) return null;
  const client = {
    client_id: clientId,
    client_name: String(doc.client_name ?? new URL(clientId).hostname).slice(0, 120),
    redirect_uris: uris.slice(0, 10),
    is_cimd: true,
    last_seen_at: new Date().toISOString(),
  };
  await db().from('oauth_clients').upsert(client, { onConflict: 'client_id' });
  return client;
}

export async function getClient(clientId) {
  if (!clientId) return null;
  const { data } = await db().from('oauth_clients').select('*').eq('client_id', clientId).maybeSingle();
  return data ?? clientFromMetadataUrl(clientId);
}

// --- authorization codes ---------------------------------------------------

export async function issueCode({ client, userId, redirectUri, codeChallenge, scope, resource }) {
  const code = secret();
  const { error } = await db().from('oauth_codes').insert({
    code_hash: sha(code),
    client_id: client.client_id,
    user_id: userId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    scope: scope || SCOPE,
    resource: resource ?? null,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (error) throw new Error(error.message);
  return code;
}

// Exchange a code for tokens. Enforces single use, expiry, and PKCE (S256).
export async function redeemCode({ code, clientId, redirectUri, codeVerifier }) {
  if (!code || !codeVerifier) throw new OAuthError('invalid_request', 'code and code_verifier are required');
  const hash = sha(code);
  const { data: row } = await db().from('oauth_codes').select('*').eq('code_hash', hash).maybeSingle();
  if (!row) throw new OAuthError('invalid_grant', 'Unknown or already used code');

  // Single use: mark it immediately, and reject replays.
  const { data: claimed } = await db().from('oauth_codes').update({ used_at: new Date().toISOString() })
    .eq('code_hash', hash).is('used_at', null).select('code_hash').maybeSingle();
  if (!claimed) {
    await revokeTokensForCodeReuse(row);
    throw new OAuthError('invalid_grant', 'Code already used');
  }
  if (new Date(row.expires_at) < new Date()) throw new OAuthError('invalid_grant', 'Code expired');
  if (!sameString(row.client_id, clientId)) throw new OAuthError('invalid_grant', 'Code was issued to another client');
  if (!sameString(row.redirect_uri, redirectUri)) throw new OAuthError('invalid_grant', 'redirect_uri does not match');

  const challenge = createHash('sha256').update(codeVerifier).digest('base64url');
  if (!sameString(challenge, row.code_challenge)) throw new OAuthError('invalid_grant', 'PKCE check failed');

  return issueTokens({ clientId: row.client_id, userId: row.user_id, scope: row.scope });
}

// A reused code means the code may have leaked: drop that connection's tokens.
async function revokeTokensForCodeReuse(row) {
  await db().from('oauth_tokens').update({ revoked_at: new Date().toISOString() })
    .eq('client_id', row.client_id).eq('user_id', row.user_id).is('revoked_at', null);
}

// --- tokens ----------------------------------------------------------------

async function issueTokens({ clientId, userId, scope }) {
  const access = secret();
  const refresh = secret();
  const now = Date.now();
  const { error } = await db().from('oauth_tokens').insert({
    access_hash: sha(access),
    refresh_hash: sha(refresh),
    client_id: clientId,
    user_id: userId,
    scope: scope || SCOPE,
    access_expires_at: new Date(now + ACCESS_TTL_MS).toISOString(),
    refresh_expires_at: new Date(now + REFRESH_TTL_MS).toISOString(),
  });
  if (error) throw new Error(error.message);
  return {
    access_token: access,
    refresh_token: refresh,
    token_type: 'Bearer',
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    scope: scope || SCOPE,
  };
}

export async function refreshTokens({ refreshToken, clientId }) {
  if (!refreshToken) throw new OAuthError('invalid_request', 'refresh_token is required');
  const { data: row } = await db().from('oauth_tokens').select('*')
    .eq('refresh_hash', sha(refreshToken)).maybeSingle();
  if (!row || row.revoked_at) throw new OAuthError('invalid_grant', 'Unknown refresh token');
  if (row.refresh_expires_at && new Date(row.refresh_expires_at) < new Date()) {
    throw new OAuthError('invalid_grant', 'Refresh token expired');
  }
  if (clientId && !sameString(row.client_id, clientId)) {
    throw new OAuthError('invalid_grant', 'Refresh token was issued to another client');
  }
  // Rotate: the old row is retired as the new one is created.
  await db().from('oauth_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', row.id);
  return issueTokens({ clientId: row.client_id, userId: row.user_id, scope: row.scope });
}

// Returns { userId, clientId, scopes, expiresAt } for a valid access token.
export async function verifyAccessToken(token) {
  if (!token) return null;
  const { data: row } = await db().from('oauth_tokens').select('*')
    .eq('access_hash', sha(token)).maybeSingle();
  if (!row || row.revoked_at) return null;
  if (new Date(row.access_expires_at) < new Date()) return null;
  db().from('oauth_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', row.id)
    .then(() => {}, () => {}); // best effort
  return {
    userId: row.user_id,
    clientId: row.client_id,
    scopes: (row.scope || SCOPE).split(' '),
    expiresAt: Math.floor(new Date(row.access_expires_at).getTime() / 1000),
  };
}

export async function revokeToken(token) {
  const hash = sha(token);
  await db().from('oauth_tokens').update({ revoked_at: new Date().toISOString() })
    .or(`access_hash.eq.${hash},refresh_hash.eq.${hash}`).is('revoked_at', null);
}

// Connections a student can see and revoke in Settings.
export async function listConnections(userId) {
  const { data } = await db().from('oauth_tokens')
    .select('id, client_id, created_at, last_used_at, oauth_clients(client_name)')
    .eq('user_id', userId).is('revoked_at', null).order('created_at', { ascending: false });
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.oauth_clients?.client_name || t.client_id,
    created_at: t.created_at,
    last_used_at: t.last_used_at,
  }));
}

export async function revokeConnection(userId, id) {
  const { data } = await db().from('oauth_tokens').update({ revoked_at: new Date().toISOString() })
    .eq('id', id).eq('user_id', userId).select('id').maybeSingle();
  return Boolean(data);
}

export async function revokeAllConnections(userId) {
  await db().from('oauth_tokens').update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId).is('revoked_at', null);
}

export class OAuthError extends Error {
  constructor(code, description, status = 400) {
    super(description);
    this.code = code;
    this.status = status;
  }
  toResponse() {
    return Response.json({ error: this.code, error_description: this.message }, {
      status: this.status,
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
    });
  }
}

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, MCP-Protocol-Version',
  'Access-Control-Max-Age': '86400',
};
