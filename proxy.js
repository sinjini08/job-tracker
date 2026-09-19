import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Paths that don't need a signed-in student: sign-in itself, share links, and
// anything that carries its own token (the Claude connector, OAuth endpoints).
const isPublic = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/s/(.*)',
  '/api/share/(.*)',
  '/api/mcp(.*)',
  '/oauth/(.*)',
  '/.well-known/(.*)',
]);

export default clerkMiddleware(async (auth, request) => {
  if (isPublic(request)) return;
  // Optimistic gate; pages and API routes check the session again themselves.
  await auth.protect();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
