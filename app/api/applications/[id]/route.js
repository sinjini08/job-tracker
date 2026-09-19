import { NextResponse } from 'next/server';
import { sessionStore } from '@/lib/auth';
import { pickWritable } from '@/lib/fields';

export async function PATCH(request, { params }) {
  const { store, denied } = await sessionStore();
  if (denied) return denied;
  const { id } = await params;
  const patch = pickWritable(await request.json().catch(() => ({})));
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }
  try {
    return NextResponse.json(await store.updateApplication(id, patch));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Not found' ? 404 : 400 });
  }
}

export async function DELETE(_request, { params }) {
  const { store, denied } = await sessionStore();
  if (denied) return denied;
  const { id } = await params;
  try {
    await store.deleteApplication(id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Not found' ? 404 : 400 });
  }
}
