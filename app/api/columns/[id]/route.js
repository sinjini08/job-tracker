import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { cleanColumn } from '../route';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  try {
    const body = await request.json().catch(() => ({}));
    const patch = body.position != null && body.label == null
      ? { position: Math.max(0, Math.round(Number(body.position)) || 0) }
      : cleanColumn(body);
    const { data, error } = await user.sb.from('custom_columns')
      .update(patch).eq('id', id).eq('user_id', user.id).select().single();
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

// Deleting the definition leaves the values orphaned in each row's `custom`
// blob, which is deliberate: add the column back with the same name and the
// data is gone, but nothing is destroyed by a misclick either. The blob is
// small, and an orphaned key is never read.
export async function DELETE(_request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const { error } = await user.sb.from('custom_columns')
    .delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
