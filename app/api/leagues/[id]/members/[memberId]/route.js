import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { leaguesFor } from '@/lib/leagues';

export const dynamic = 'force-dynamic';

// The league's owner removing someone. RLS is what actually enforces "owner
// only"; this route just carries the request. A removed member keeps all their
// own data and can rejoin with the code.
export async function DELETE(_request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, memberId } = await params;
  try {
    await leaguesFor(user.sb, user.id).removeMember(id, decodeURIComponent(memberId));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
