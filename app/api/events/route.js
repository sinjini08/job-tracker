import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Every application's history in one call, for the Charts tab.
export async function GET() {
  const denied = await requireRole('view');
  if (denied) return denied;
  try {
    return NextResponse.json(await db().listAllEvents());
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
