import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { db } from '@/lib/db';

const KINDS = new Set(['note', 'interview', 'follow_up', 'offer']);

export async function GET(_request, { params }) {
  const denied = await requireRole('view');
  if (denied) return denied;
  const { id } = await params;
  try {
    return NextResponse.json(await db().listEvents(id));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const denied = await requireRole('edit');
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const detail = String(body.detail ?? '').trim();
  if (!detail) return NextResponse.json({ error: 'Note is empty' }, { status: 400 });
  try {
    const event = await db().addEvent({
      application_id: id,
      detail,
      kind: KINDS.has(body.kind) ? body.kind : 'note',
      ...(body.event_date ? { event_date: body.event_date } : {}),
    });
    return NextResponse.json(event, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
