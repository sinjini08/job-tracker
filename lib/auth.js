import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { storeFor } from './db';
import { supabaseAdmin, supabaseForUser } from './supabase/server';

// The signed-in user (verified JWT), or null.
export async function currentUser() {
  const sb = await supabaseForUser();
  const { data } = await sb.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: claims.email, sb };
}

// For route handlers: { store, user } for the signed-in user, or { denied } (a 401).
export async function sessionStore() {
  const user = await currentUser();
  if (!user) return { denied: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) };
  return { user, store: storeFor(user.sb, user.id) };
}

// Share links: a random token on the owner's profile. Read-only by construction —
// callers only ever get the list/get methods.
export async function shareStore(token) {
  if (!token || token.length < 20) return null;
  const { data } = await supabaseAdmin().from('profiles').select('id').eq('share_token', token).maybeSingle();
  if (!data) return null;
  const s = storeFor(supabaseAdmin(), data.id);
  return {
    listApplications: s.listApplications,
    listAllEvents: s.listAllEvents,
    listEvents: s.listEvents,
  };
}

// Personal Claude connector tokens. Only a SHA-256 hash is stored, so a
// database leak doesn't leak working connector links.
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

export async function userIdForConnector(token) {
  if (!token || token.length < 20) return null;
  const { data } = await supabaseAdmin().from('profiles').select('id')
    .eq('mcp_token_hash', hashToken(token)).maybeSingle();
  return data?.id ?? null;
}
