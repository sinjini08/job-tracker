import { clerkClient } from '@clerk/nextjs/server';
import { getPublicOrigin } from 'mcp-handler';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// The code door on the landing page.
//
// Clerk's access mode is Waitlist, so nobody can sign up by finding /sign-up:
// only existing users and people Clerk has invited get through. A code has to
// therefore produce a real invitation rather than just revealing a page, or it
// would be decoration over a locked door and the person would hit a wall.
//
// createInvitation with notify:false makes the invitation without emailing
// anyone. Visiting its url lands them on /sign-up with a __clerk_ticket, which
// the <SignUp /> component picks up on its own.

const bad = (message, status = 400) => NextResponse.json({ error: message }, { status });

// Length-independent comparison. The code is short and guessing is rate-limited
// by Clerk rather than by us, so this is belt and braces, but it costs nothing.
function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function POST(request) {
  const expected = process.env.INVITE_CODE?.trim();
  if (!expected) return bad('Invites are not set up yet.', 503);

  let body;
  try { body = await request.json(); } catch { return bad('Send a code and an email.'); }

  const code = String(body?.code ?? '').trim();
  const email = String(body?.email ?? '').trim().toLowerCase();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 320) {
    return bad('That email address does not look right.');
  }
  // Case and spacing are not the secret, so a code typed in caps still works.
  if (!sameSecret(code.toUpperCase(), expected.toUpperCase())) {
    return bad('That code is not right. Check it, or join the waitlist instead.');
  }

  try {
    const clerk = await clerkClient();

    // Ask first, rather than inviting and hoping Clerk objects. It does not:
    // createInvitation happily returns a ticket for an address that already
    // has an account, so the "you already have one" case has to be caught
    // here or people who are already members get handed a sign-up link.
    const existing = await clerk.users.getUserList({ emailAddress: [email], limit: 1 });
    if ((existing?.totalCount ?? existing?.data?.length ?? 0) > 0) {
      return bad('You already have an account. Sign in instead.', 409);
    }

    const invitation = await clerk.invitations.createInvitation({
      emailAddress: email,
      notify: false,
      ignoreExisting: true,
      redirectUrl: `${getPublicOrigin(request)}/sign-up`,
    });
    return NextResponse.json({ url: invitation.url });
  } catch {
    return bad('Could not create your invite. Try again in a moment.', 502);
  }
}
