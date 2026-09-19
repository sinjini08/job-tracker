import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { pickWritable } from '@/lib/fields';

export async function PATCH(request, { params }) {
  const denied = await requireRole('edit');
  if (denied) return denied;
  const { id } = await params;
  const patch = pickWritable(await request.json().catch(() => ({})));
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }
  try {
    return NextResponse.json(await db().updateApplication(id, patch));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function DELETE(_request, { params }) {
  const denied = await requireRole('edit');
  if (denied) return denied;
  const { id } = await params;
  try {
    await db().deleteApplication(id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
