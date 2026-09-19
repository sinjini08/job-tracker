import { NextResponse } from 'next/server';
import { shareStore } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(_request, { params }) {
  const store = await shareStore((await params).token);
  if (!store) return NextResponse.json({ error: 'This share link is no longer active' }, { status: 404 });
  return NextResponse.json(await store.listAllEvents());
}
