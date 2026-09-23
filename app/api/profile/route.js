import { NextResponse } from 'next/server';
import { currentUserWithEmail, ensureProfile } from '@/lib/auth';
import { isAvatar } from '@/lib/avatars';
import { SHEET_KEYS } from '@/lib/fields';

export const dynamic = 'force-dynamic';

const FIELDS = 'display_name, avatar, leaderboard_detail, hidden_columns, sheets_enabled, sheet_names';

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
  if ('sheets_enabled' in body) {
    // Only the two known values, and never an empty list: a student with no
    // sheets at all would have nowhere to type.
    const kept = SHEET_KEYS.filter((k) => Array.isArray(body.sheets_enabled) && body.sheets_enabled.includes(k));
    patch.sheets_enabled = kept.length ? kept : SHEET_KEYS;
  }
  if ('sheet_names' in body) {
    // A label per sheet key. A blank name clears back to the built-in one.
    const raw = body.sheet_names;
    const out = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const key of SHEET_KEYS) {
        const name = String(raw[key] ?? '').trim().slice(0, 30);
        if (name && name !== key) out[key] = name;
      }
    }
    patch.sheet_names = out;
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  const { data, error } = await user.sb.from('profiles')
    .update(patch).eq('id', user.id).select(FIELDS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
