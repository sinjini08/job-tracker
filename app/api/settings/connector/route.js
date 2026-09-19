import { NextResponse } from 'next/server';
import { ensureProfile, currentUser, hashToken, newToken } from '@/lib/auth';

// POST: make a new personal Claude connector link (the old one stops working).
// The link is returned once; only its hash is stored. DELETE: disconnect Claude.
export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  await ensureProfile(user.id);
  const token = newToken();
  const { error } = await user.sb.from('profiles').update({ mcp_token_hash: hashToken(token) }).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: `${new URL(request.url).origin}/api/mcp/${token}` });
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { error } = await user.sb.from('profiles').update({ mcp_token_hash: null }).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
