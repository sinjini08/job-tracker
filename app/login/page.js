'use client';

import { useActionState } from 'react';
import { sendCode, verifyCode } from './actions';

export default function LoginPage() {
  const [sent, sendAction, sending] = useActionState(sendCode, { step: 'email' });
  const [checked, verifyAction, verifying] = useActionState(verifyCode, null);
  const onCodeStep = sent?.step === 'code';
  const email = sent?.email ?? '';

  return (
    <main className="login">
      <div className="login-card">
        <div className="login-mark" aria-hidden>▦</div>
        <h1>Job Application Tracker</h1>

        {!onCodeStep ? (
          <form action={sendAction} className="login-form">
            <p>Track on-campus and off-campus applications in one spreadsheet, with charts, and let
              Claude fill it in from job postings. Sign in or create an account with your email.</p>
            <input name="email" type="email" autoComplete="email" placeholder="you@example.com"
              defaultValue={email} autoFocus required />
            <button type="submit" disabled={sending}>{sending ? 'Sending…' : 'Email me a code'}</button>
            {sent?.error && <p className="login-error" role="alert">{sent.error}</p>}
          </form>
        ) : (
          <form action={verifyAction} className="login-form">
            <p>We sent a code to <b>{email}</b>. It can take a minute; check spam too.</p>
            <input type="hidden" name="email" value={email} />
            <input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="Code"
              maxLength={10} autoFocus required className="code-input" />
            <button type="submit" disabled={verifying}>{verifying ? 'Checking…' : 'Sign in'}</button>
            {checked?.error && <p className="login-error" role="alert">{checked.error}</p>}
          </form>
        )}

        {onCodeStep && (
          <form action={sendAction} className="login-alt">
            <input type="hidden" name="email" value={email} />
            <button type="submit" className="link-btn" disabled={sending}>Send a new code</button>
            <a href="/login" className="link-btn">Use a different email</a>
          </form>
        )}
      </div>
    </main>
  );
}
