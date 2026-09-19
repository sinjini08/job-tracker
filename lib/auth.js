import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { COOKIE, readSession } from './session';

export async function currentRole() {
  const jar = await cookies();
  return readSession(jar.get(COOKIE)?.value);
}

// For route handlers: returns an error response, or null when access is allowed.
export async function requireRole(needed) {
  const role = await currentRole();
  if (!role) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (needed === 'edit' && role !== 'edit') {
    return NextResponse.json({ error: 'View-only access' }, { status: 403 });
  }
  return null;
}
