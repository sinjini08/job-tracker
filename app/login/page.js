'use client';

import { useActionState } from 'react';
import { signIn } from './actions';

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <main className="login">
      <form action={action} className="login-card">
        <div className="login-mark" aria-hidden>▦</div>
        <h1>Job Application Tracker</h1>
        <p>Enter your access code to open the sheet.</p>
        <input
          name="code"
          type="password"
          autoComplete="current-password"
          placeholder="Access code"
          autoFocus
          required
        />
        <button type="submit" disabled={pending}>{pending ? 'Checking…' : 'Open'}</button>
        {state?.error && <p className="login-error" role="alert">{state.error}</p>}
      </form>
    </main>
  );
}
