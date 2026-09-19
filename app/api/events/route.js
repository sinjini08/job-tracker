import { NextResponse } from 'next/server';
import { sessionStore } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Every application's history in one call, for the Charts tab.
export async function GET() {
  const { store, denied } = await sessionStore();
  if (denied) return denied;
  try {
    return NextResponse.json(await store.listAllEvents());
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
