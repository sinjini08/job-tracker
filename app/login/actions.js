'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { COOKIE, createSession, roleForCode } from '@/lib/session';

export async function signIn(_prev, formData) {
  const role = await roleForCode(formData.get('code'));
  if (!role) {
    // Slow down guessing a little.
    await new Promise((r) => setTimeout(r, 800));
    return { error: 'That code didn’t work.' };
  }
  const { value, maxAge } = await createSession(role);
  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  });
  redirect('/');
}

export async function signOut() {
  (await cookies()).delete(COOKIE);
  redirect('/login');
}
