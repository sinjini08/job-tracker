import { NextResponse } from 'next/server';
import { currentUser, ensureProfile } from '@/lib/auth';
import { leaguesFor } from '@/lib/leagues';

export const dynamic = 'force-dynamic';

// Join with a friend's code. The lookup happens inside join_league() in the
// database, because the joiner isn't allowed to read a league they're not in.
export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    await ensureProfile(user.id);
    const { code } = await request.json().catch(() => ({}));
    const league = await leaguesFor(user.sb, user.id).join(code);
    return NextResponse.json(league);
  } catch (e) {
    const missing = /No league has that code/i.test(e.message);
    return NextResponse.json({ error: missing ? 'No league has that code.' : e.message },
      { status: missing ? 404 : 400 });
  }
}
