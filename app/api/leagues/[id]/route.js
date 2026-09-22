import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { leaguesFor } from '@/lib/leagues';

export const dynamic = 'force-dynamic';

async function scope() {
  const user = await currentUser();
  if (!user) return { denied: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) };
  return { user, leagues: leaguesFor(user.sb, user.id) };
}

// The board. Nothing here decides what a member may see — league_board() does,
// and it only ever returns totals.
export async function GET(_request, { params }) {
  const { user, leagues, denied } = await scope();
  if (denied) return denied;
  const { id } = await params;
  try {
    // board() settles first, so history and months are read after it.
    const board = await leagues.board(id);
    const [history, months] = await Promise.all([leagues.history(id), leagues.months(id)]);
    return NextResponse.json({ me: user.id, board, history, months });
  } catch (e) {
    const outside = /Not a member/i.test(e.message);
    return NextResponse.json({ error: outside ? 'You are not in this league.' : e.message },
      { status: outside ? 403 : 500 });
  }
}

export async function PATCH(request, { params }) {
  const { leagues, denied } = await scope();
  if (denied) return denied;
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await leagues.update(id, body));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

// Leave — or, for the person who made it, delete the league for everyone.
export async function DELETE(_request, { params }) {
  const { leagues, denied } = await scope();
  if (denied) return denied;
  const { id } = await params;
  try {
    await leagues.leave(id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
