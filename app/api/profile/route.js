import { NextResponse } from 'next/server';
import { currentUserWithEmail, ensureProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const FIELDS = 'display_name, leaderboard_detail, weekly_goal, monthly_goal';

// What the student shows on a leaderboard, and what they're aiming for.
export async function GET() {
  const user = await currentUserWithEmail();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  await ensureProfile(user.id, user.email);
  const { data, error } = await user.sb.from('profiles').select(FIELDS).eq('id', user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    ...data,
    // The board falls back to the same thing when no name is set.
    display_name: data?.display_name || user.email.split('@')[0] || 'Student',
    named: Boolean(data?.display_name?.trim()),
  });
}

const clampInt = (v, lo, hi, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

export async function PATCH(request) {
  const user = await currentUserWithEmail();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  await ensureProfile(user.id, user.email);
  const body = await request.json().catch(() => ({}));
  const patch = {};
  if ('display_name' in body) {
    patch.display_name = String(body.display_name ?? '').trim().slice(0, 40) || null;
  }
  if ('leaderboard_detail' in body) {
    patch.leaderboard_detail = body.leaderboard_detail === 'points' ? 'points' : 'counts';
  }
  if ('weekly_goal' in body) patch.weekly_goal = clampInt(body.weekly_goal, 0, 200, 5);
  if ('monthly_goal' in body) patch.monthly_goal = clampInt(body.monthly_goal, 0, 800, 20);
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  const { data, error } = await user.sb.from('profiles')
    .update(patch).eq('id', user.id).select(FIELDS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
