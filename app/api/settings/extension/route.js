import { NextResponse } from 'next/server';
import { ensureProfile, currentUser, hashToken, newToken } from '@/lib/auth';

// POST: pair the browser extension, which returns a token once and stores only
// its hash. Making a new one stops the old one working, which is how somebody
// un-pairs a browser they no longer have. DELETE: un-pair everything.
//
// Deliberately separate from the connector's token. That one can read the
// whole tracker; this one only reaches /api/ext, which adds rows. Somebody who
// installs the extension on a shared machine and later regrets it should be
// able to revoke that without also disconnecting Claude.
export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  await ensureProfile(user.id);
  const token = newToken();
  const { error } = await user.sb.from('profiles')
    .update({ ext_token_hash: hashToken(token) }).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // One string rather than an address and a secret to keep together, so
  // nothing hardcodes the origin and a self-hosted copy works. The token sits
  // in the fragment on purpose: a browser never sends a fragment to a server,
  // so this link cannot turn up in an access log the way a path would.
  return NextResponse.json({ url: `${new URL(request.url).origin}/api/ext#${token}` });
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { error } = await user.sb.from('profiles')
    .update({ ext_token_hash: null }).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
