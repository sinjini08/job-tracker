import { NextResponse } from 'next/server';
import { currentUser, ensureProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MAX_COLUMNS = 12;
const KINDS = ['text', 'number', 'date', 'bool', 'select'];
const APPLIES = ['both', 'On-Campus', 'Off-Campus'];

export const cleanColumn = (body) => {
  const label = String(body?.label ?? '').trim().slice(0, 40);
  if (!label) throw new Error('Give the column a name.');
  const kind = KINDS.includes(body?.kind) ? body.kind : 'text';
  return {
    label,
    kind,
    applies: APPLIES.includes(body?.applies) ? body.applies : 'both',
    // Only a list column keeps options, and only a dozen of them.
    options: kind === 'select'
      ? [...new Set(String(body?.options ?? '').split(',').map((o) => o.trim()).filter(Boolean))].slice(0, 12)
      : [],
  };
};

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { data, error } = await user.sb.from('custom_columns')
    .select('*').eq('user_id', user.id).order('position');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ columns: data ?? [] });
}

export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  try {
    await ensureProfile(user.id);
    const body = await request.json().catch(() => ({}));
    const patch = cleanColumn(body);

    const { count } = await user.sb.from('custom_columns')
      .select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    if ((count ?? 0) >= MAX_COLUMNS) {
      throw new Error(`You can have ${MAX_COLUMNS} columns of your own. Delete one first.`);
    }

    const { data, error } = await user.sb.from('custom_columns')
      .insert({ ...patch, user_id: user.id, position: count ?? 0 })
      .select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
