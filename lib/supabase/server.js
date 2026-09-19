import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

const env = (name) => {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} must be set`);
  return v;
};

// Signed-in student's client: every request carries their Clerk session token,
// so row-level security in the database sees who they are (Supabase third-party
// auth with Clerk; policies compare auth.jwt()->>'sub' to user_id).
export function supabaseForUser() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), {
    accessToken: async () => (await auth()).getToken(),
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Service-role client: bypasses RLS. Only for paths with no student session
// (share links, the Claude connector, account deletion), and always through
// storeFor(), which scopes every query to one user id.
let admin;
export function supabaseAdmin() {
  admin ??= createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
