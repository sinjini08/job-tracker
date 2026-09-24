import { NextResponse } from 'next/server';
import { currentUserWithEmail, ensureProfile } from '@/lib/auth';
import { isAvatar } from '@/lib/avatars';
import { normalizeSheetPrefs } from '@/lib/fields';

export const dynamic = 'force-dynamic';

const FIELDS = 'display_name, full_name, avatar, leaderboard_detail, hidden_columns, row_columns, column_order, sheets_enabled, sheet_names';

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
  if ('full_name' in body) {
    // Blank clears it, which is how someone takes their name back off the
    // board after putting it there.
    patch.full_name = String(body.full_name ?? '').trim().slice(0, 60) || null;
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
  // Which sheets they keep and what they are called are worked out together,
  // in lib/fields so the rule has one home and can be tested on its own.
  if ('row_columns' in body) {
    // { sheet: [column key, ...] }, same shape as hidden_columns. Keys, not
    // ids, because company_on and company_off are the same column.
    const raw = body.row_columns;
    const out = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [sheet, keys] of Object.entries(raw)) {
        if (Array.isArray(keys)) out[sheet] = keys.filter((v) => typeof v === 'string').slice(0, 20);
      }
    }
    patch.row_columns = out;
  }
  if ('column_order' in body) {
    // { sheet: [column id, ...] }. Ids this time, not keys: the order is of
    // the columns as drawn, and company_on and company_off are drawn on
    // different sheets.
    const raw = body.column_order;
    const out = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      for (const [sheet, ids] of Object.entries(raw)) {
        if (Array.isArray(ids)) out[sheet] = ids.filter((v) => typeof v === 'string').slice(0, 80);
      }
    }
    patch.column_order = out;
  }
  if ('sheets_enabled' in body || 'sheet_names' in body) {
    const { enabled, names } = normalizeSheetPrefs(
      'sheets_enabled' in body ? body.sheets_enabled : undefined,
      body.sheet_names,
    );
    if (enabled) patch.sheets_enabled = enabled;
    if ('sheet_names' in body) patch.sheet_names = names;
  }

  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to change' }, { status: 400 });

  const { data, error } = await user.sb.from('profiles')
    .update(patch).eq('id', user.id).select(FIELDS).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
