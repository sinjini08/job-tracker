import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const env = (name) => {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} must be set`);
  return v;
};

// Signed-in user's client: carries their session cookie, so every query runs
// under row-level security as that user.
export async function supabaseForUser() {
  const jar = await cookies();
  return createServerClient(env('SUPABASE_URL'), env('SUPABASE_PUBLISHABLE_KEY'), {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (list) => {
        // Server components can't set cookies; proxy.js refreshes the session instead.
        try { list.forEach(({ name, value, options }) => jar.set(name, value, options)); } catch {}
      },
    },
  });
}

// Service-role client: bypasses RLS. Only for paths with no user session
// (share links, the Claude connector, account deletion), and always through
// storeFor(), which scopes every query to one user id.
let admin;
export function supabaseAdmin() {
  admin ??= createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
