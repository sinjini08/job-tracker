import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { leagueInvite } from '@/lib/leagues';

export const dynamic = 'force-dynamic';

// What the League tab shows above its Join button when somebody arrives from
// an invite link: the league's name, its host and its size. Signed in only;
// the public /join page reads the same thing on the server for everyone else.
export async function GET(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const invite = await leagueInvite(new URL(request.url).searchParams.get('code'));
  if (!invite) return NextResponse.json({ error: 'That invite link has expired.' }, { status: 404 });
  return NextResponse.json(invite);
}
