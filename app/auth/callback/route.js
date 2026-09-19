import { NextResponse } from 'next/server';
import { supabaseForUser } from '@/lib/supabase/server';

// The "Sign in" link in the email lands here with ?code=… (PKCE). Exchanging it
// needs the verifier cookie set when the code was requested, so the link works
// in the same browser that asked for it; otherwise the student can type the code.
export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (code) {
    const sb = await supabaseForUser();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/', url.origin));
  }
  const back = new URL('/login', url.origin);
  back.searchParams.set('link', 'failed');
  return NextResponse.redirect(back);
}
