'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseForUser } from '@/lib/supabase/server';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Only ever bounce back to our own paths.
const safeNext = (v) => (typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') ? v : '/');

// Step 1: email a one-time code. New emails get an account automatically.
export async function sendCode(_prev, formData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const next = safeNext(formData.get('next'));
  if (!EMAIL.test(email)) return { step: 'email', next, error: 'Enter a valid email address.' };
  const sb = await supabaseForUser();
  const origin = (await headers()).get('origin');
  const callback = origin ? `${origin}/auth/callback?next=${encodeURIComponent(next)}` : null;
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, ...(callback ? { emailRedirectTo: callback } : {}) },
  });
  if (error) {
    const wait = /rate|security purposes|too many/i.test(error.message);
    const mail = /sending|smtp|email/i.test(error.message);
    return {
      step: 'email',
      email,
      next,
      error: wait ? 'Too many codes requested. Wait a minute and try again.'
        : mail ? 'We couldn’t send the email just now. Try again in a minute.'
        : error.message,
    };
  }
  return { step: 'code', email, next };
}

// Step 2: check the code and start the session.
export async function verifyCode(_prev, formData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const next = safeNext(formData.get('next'));
  const code = String(formData.get('code') ?? '').replace(/\D/g, '');
  if (code.length < 6) return { step: 'code', email, next, error: 'Enter the code from the email.' };
  const sb = await supabaseForUser();
  const { error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) return { step: 'code', email, next, error: 'That code is wrong or expired. Check the email or send a new one.' };
  redirect(next);
}

export async function signOut() {
  const sb = await supabaseForUser();
  await sb.auth.signOut();
  redirect('/login');
}
