'use client';

import { Waitlist } from '@clerk/nextjs';
import Link from 'next/link';
import { useState } from 'react';
import Logo from './Logo';
import { appearance } from '@/lib/clerk-appearance';

// The front door, for anyone not signed in.
//
// Two ways through. Without a code you join the waitlist, which is Clerk's own
// component writing to Clerk's waitlist. With a code you go straight in: the
// code is checked on the server, which mints a real Clerk invitation and sends
// you to sign up with it. Clerk's access mode is Waitlist, so there is no third
// way in and nothing here is a curtain over an open door.

export default function Landing() {
  const [door, setDoor] = useState(null);

  return (
    <main className="land">
      <div className="land-inner">
        <div className="land-mark"><Logo size={64} /></div>
        {/* One line per clause. Left to wrap on its own the breaks land mid
            sentence, which fights the rhythm the three clauses are doing. */}
        <h1>
          <span>Your applications, organized.</span>
          <span>Your progress, visible.</span>
          <span>Your job hunt, more fun.</span>
        </h1>
        <p className="land-sub">
          Free for students. Paste a job posting and it files itself.
        </p>

        {door === null && (
          <>
            <div className="land-doors">
              <button className="land-btn primary" onClick={() => setDoor('code')}>
                I have a code
              </button>
              <button className="land-btn" onClick={() => setDoor('waitlist')}>
                Join the waitlist
              </button>
            </div>
            {/* A return path, not a third way in. Sign-ups are closed at Clerk,
                so this door is locked to anyone who has not already been
                through the code. Worded so it reads that way. */}
            <p className="land-foot">
              Been here before? <Link href="/sign-in">Sign in</Link>
            </p>
            <p className="land-legal">
              <Link href="/privacy">Privacy</Link>
            </p>
          </>
        )}

        {door === 'code' && <CodeDoor onBack={() => setDoor(null)} />}

        {door === 'waitlist' && (
          <div className="land-panel">
            <Waitlist appearance={appearance} />
            <button className="land-back" onClick={() => setDoor(null)}>Back</button>
          </div>
        )}
      </div>
    </main>
  );
}

function CodeDoor({ onBack }) {
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setBusy(false); return; }
      // Clerk's invitation link, which lands on /sign-up carrying the ticket.
      window.location.href = data.url;
    } catch {
      setError('Could not reach the server. Check your connection.');
      setBusy(false);
    }
  };

  return (
    <form className="land-panel land-form" onSubmit={submit}>
      <label>
        Your code
        <input value={code} onChange={(e) => setCode(e.target.value)}
          placeholder="Enter the code you were sent" autoFocus required
          autoComplete="off" spellCheck={false} />
      </label>
      <label>
        Your email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" required autoComplete="email" />
      </label>
      {error && <p className="land-error" role="alert">{error}</p>}
      <button className="land-btn primary" type="submit" disabled={busy}>
        {busy ? 'Checking…' : 'Let me in'}
      </button>
      <button className="land-back" type="button" onClick={onBack}>Back</button>
    </form>
  );
}
