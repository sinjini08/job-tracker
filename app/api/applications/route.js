import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { db } from '@/lib/db';
import { pickWritable } from '@/lib/fields';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireRole('view');
  if (denied) return denied;
  try {
    return NextResponse.json(await db().listApplications());
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const denied = await requireRole('edit');
  if (denied) return denied;
  try {
    const row = pickWritable(await request.json().catch(() => ({})));
    return NextResponse.json(await db().createApplication(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
