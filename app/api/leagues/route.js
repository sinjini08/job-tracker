import { NextResponse } from 'next/server';
import { currentUser, ensureProfile } from '@/lib/auth';
import { leaguesFor } from '@/lib/leagues';

export const dynamic = 'force-dynamic';

async function scope() {
  const user = await currentUser();
  if (!user) return { denied: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) };
  return { user, leagues: leaguesFor(user.sb, user.id) };
}

// The leagues this student belongs to, plus what each milestone is worth.
export async function GET() {
  const { leagues, denied } = await scope();
  if (denied) return denied;
  try {
    const [mine, values] = await Promise.all([leagues.myLeagues(), leagues.pointValues()]);
    return NextResponse.json({ leagues: mine, pointValues: values });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { user, leagues, denied } = await scope();
  if (denied) return denied;
  try {
    // A league row points at the profile, so it has to exist first.
    await ensureProfile(user.id);
    const { name } = await request.json().catch(() => ({}));
    return NextResponse.json(await leagues.create(name), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
