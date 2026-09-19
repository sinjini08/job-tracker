import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { auth, currentUser as clerkUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { storeFor } from './db';
import { supabaseAdmin, supabaseForUser } from './supabase/server';

// The signed-in student (Clerk), or null.
export async function currentUser() {
  const { userId } = await auth();
  if (!userId) return null;
  return { id: userId, sb: supabaseForUser() };
}

// Same, plus the email address (an extra Clerk call, so only where it's shown).
export async function currentUserWithEmail() {
  const user = await clerkUser();
  if (!user) return null;
  return { id: user.id, email: user.primaryEmailAddress?.emailAddress ?? '', sb: supabaseForUser() };
}

// Every student has a profiles row; it holds their share token and the hash of
// any personal connector link, and other tables cascade from it.
export async function ensureProfile(userId, email) {
  await supabaseAdmin().from('profiles').upsert({ id: userId, ...(email ? { email } : {}) }, { onConflict: 'id' });
}

// For route handlers: { store, user } for the signed-in student, or { denied }.
export async function sessionStore() {
  const user = await currentUser();
  if (!user) return { denied: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) };
  return { user, store: storeFor(user.sb, user.id) };
}

// Share links: a random token on the owner's profile. Read-only by construction.
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

// Personal connector links (for tools that can't sign in). Only a SHA-256 hash
// is stored, so a database leak doesn't leak working links.
export const hashToken = (token) => createHash('sha256').update(token).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

export async function userIdForConnector(token) {
  if (!token || token.length < 20) return null;
  const { data } = await supabaseAdmin().from('profiles').select('id')
    .eq('mcp_token_hash', hashToken(token)).maybeSingle();
  return data?.id ?? null;
}
