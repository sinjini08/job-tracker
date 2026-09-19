import { NextResponse } from 'next/server';
import { COOKIE, readSession } from './lib/session';

// Optimistic gate: bounce anyone without a valid session to /login. The page
// and every API route re-check the session themselves; this is not the only lock.
export async function proxy(request) {
  const role = await readSession(request.cookies.get(COOKIE)?.value);
  if (role) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
