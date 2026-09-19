import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { listConnections, revokeConnection } from '@/lib/oauth';

// Apps the student has connected through OAuth (Claude, and anything else).
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  return NextResponse.json(await listConnections(user.id));
}

export async function DELETE(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const ok = await revokeConnection(user.id, id);
  return ok ? new NextResponse(null, { status: 204 })
            : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
