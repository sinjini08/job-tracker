import { NextResponse } from 'next/server';
import { shareStore } from '@/lib/auth';

export async function GET(_request, { params }) {
  const { token, id } = await params;
  const store = await shareStore(token);
  if (!store) return NextResponse.json({ error: 'This share link is no longer active' }, { status: 404 });
  return NextResponse.json(await store.listEvents(id));
}
