import { NextResponse } from 'next/server';
import { sessionStore } from '@/lib/auth';
import { pickWritable } from '@/lib/fields';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { store, denied } = await sessionStore();
  if (denied) return denied;
  try {
    return NextResponse.json(await store.listApplications());
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  const { store, denied } = await sessionStore();
  if (denied) return denied;
  try {
    const row = pickWritable(await request.json().catch(() => ({})));
    return NextResponse.json(await store.createApplication(row), { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
