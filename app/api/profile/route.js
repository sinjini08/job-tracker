import { NextResponse } from 'next/server';
import { currentUserWithEmail, ensureProfile } from '@/lib/auth';
import { isAvatar } from '@/lib/avatars';

export const dynamic = 'force-dynamic';

const FIELDS = 'display_name, avatar, leaderboard_detail, hidden_columns';

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

export async function PATCH(request) {
  const user = await currentUserWithEmail();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  await ensureProfile(user.id, user.email);
  const body = await request.json().catch(() => ({}));
  const patch = {};
  if ('display_name' in body) {
    patch.display_name = String(body.display_name ?? '').trim().slice(0, 40) || null;
  }
  if ('avatar' in body) {
    // Only a value from the list. Anything else clears it back to initials.
    patch.avatar = isAvatar(body.avatar) ? body.avatar : null;
  }
  if ('leaderboard_detail' in body) {
    patch.leaderboard_detail = body.leaderboard_detail === 'points' ? 'points' : 'counts';
  }
  if ('hidden_columns' in body) {
    // { sheet: [column id, ...] }. Anything else in the shape is dropped.
    const raw = body.hidden_columns;
    const out = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [sheet, ids] of Object.entries(raw)) {
        if (Array.isArray(ids)) out[sheet] = ids.filter((v) => typeof v === 'string').slice(0, 60);
      }
    }
    patch.hidden_columns = out;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  const { data, error } = await user.sb.from('profiles')
    .update(patch).eq('id', user.id).select(FIELDS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
