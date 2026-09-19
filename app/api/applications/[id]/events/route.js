import { NextResponse } from 'next/server';
import { sessionStore } from '@/lib/auth';

const KINDS = new Set(['note', 'interview', 'follow_up', 'offer']);

export async function GET(_request, { params }) {
  const { store, denied } = await sessionStore();
  if (denied) return denied;
  const { id } = await params;
  try {
    return NextResponse.json(await store.listEvents(id));
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { store, denied } = await sessionStore();
  if (denied) return denied;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const detail = String(body.detail ?? '').trim();
  if (!detail) return NextResponse.json({ error: 'Note is empty' }, { status: 400 });
  try {
    const event = await store.addEvent({
      application_id: id,
      detail,
      kind: KINDS.has(body.kind) ? body.kind : 'note',
      ...(body.event_date ? { event_date: body.event_date } : {}),
    });
    return NextResponse.json(event, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Not found' ? 404 : 400 });
  }
}
