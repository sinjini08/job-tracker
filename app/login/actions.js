'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabaseForUser } from '@/lib/supabase/server';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Step 1: email a one-time code. New emails get an account automatically.
export async function sendCode(_prev, formData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  if (!EMAIL.test(email)) return { step: 'email', error: 'Enter a valid email address.' };
  const sb = await supabaseForUser();
  const origin = (await headers()).get('origin');
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, ...(origin ? { emailRedirectTo: `${origin}/auth/callback` } : {}) },
  });
  if (error) {
    const wait = /rate|security purposes|too many/i.test(error.message);
    const mail = /sending|smtp|email/i.test(error.message);
    return {
      step: 'email',
      email,
      error: wait ? 'Too many codes requested. Wait a minute and try again.'
        : mail ? 'We couldn’t send the email just now. Try again in a minute.'
        : error.message,
    };
  }
  return { step: 'code', email };
}

// Step 2: check the code and start the session.
export async function verifyCode(_prev, formData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const code = String(formData.get('code') ?? '').replace(/\D/g, '');
  if (code.length < 6) return { step: 'code', email, error: 'Enter the code from the email.' };
  const sb = await supabaseForUser();
  const { error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) return { step: 'code', email, error: 'That code is wrong or expired. Check the email or send a new one.' };
  redirect('/');
}

export async function signOut() {
  const sb = await supabaseForUser();
  await sb.auth.signOut();
  redirect('/login');
}
