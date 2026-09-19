import { NextResponse } from 'next/server';
import { currentUser, newToken } from '@/lib/auth';

// POST: create (or replace) the read-only share link. DELETE: turn it off.
// Runs as the user, so RLS limits the update to their own profile row.
export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const token = newToken();
  const { error } = await user.sb.from('profiles').update({ share_token: token }).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: `${new URL(request.url).origin}/s/${token}` });
}

export async function DELETE() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { error } = await user.sb.from('profiles').update({ share_token: null }).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
