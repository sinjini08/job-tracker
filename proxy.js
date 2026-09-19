import { clerkMiddleware } from '@clerk/nextjs/server';

// Makes the Clerk session available to pages and route handlers. It deliberately
// blocks nothing: every page redirects to /sign-in itself and every API route
// answers 401, which behaves the same on localhost and on the deployed site.
// (Clerk's development instances can't finish their browser handshake before the
// first server request, and hard-blocking here turns that into a confusing 404.)
export default clerkMiddleware();

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
