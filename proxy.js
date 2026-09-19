import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Paths that carry their own token (share links, Claude connector) or are the
// sign-in page itself. Everything else needs a signed-in user.
const PUBLIC = [/^\/login/, /^\/s\//, /^\/api\/share\//, /^\/api\/mcp/, /^\/auth\//,
  /^\/\.well-known\//, /^\/oauth\//];

export async function proxy(request) {
  const path = request.nextUrl.pathname;
  if (path === '/' && request.nextUrl.searchParams.has('code')) {
    const to = new URL('/auth/callback', request.url);
    to.searchParams.set('code', request.nextUrl.searchParams.get('code'));
    return NextResponse.redirect(to);
  }
  if (PUBLIC.slice(1).some((re) => re.test(path))) return NextResponse.next();

  // Refresh the Supabase session cookie (the documented @supabase/ssr pattern).
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.SUPABASE_URL.trim(),
    process.env.SUPABASE_PUBLISHABLE_KEY.trim(),
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  // Optimistic gate only: pages and API routes check the session again.
  if (!signedIn && !PUBLIC[0].test(path)) {
    if (path.startsWith('/api/')) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', request.url));
  }
  if (signedIn && PUBLIC[0].test(path)) return NextResponse.redirect(new URL('/', request.url));
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
