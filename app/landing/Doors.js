'use client';

import { Waitlist } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { appearance } from '@/lib/clerk-appearance';

// The two ways in, as an overlay rather than a screen of their own.
//
// On the old landing page these replaced the hero, which was fine when there
// was one screen. Now there are seven, and someone convinced at the league
// should not lose their place to type a code.
//
// Sign-ups are closed at Clerk, so neither of these is a curtain over an open
// door: without a code the waitlist is genuinely the only way through.
export default function Doors({ open, onClose }) {
  // Escape closes it, and the page behind it stops scrolling while it is up.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="tw:fixed tw:inset-0 tw:z-50 tw:flex tw:items-center tw:justify-center tw:p-5 tw:bg-ink/35 tw:backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={open === 'code' ? 'Enter your code' : 'Join the waitlist'}
    >
      <div className="tw:w-full tw:max-w-md tw:rounded-2xl tw:bg-white tw:p-7 tw:shadow-2xl tw:shadow-ink/20">
        {open === 'code' ? <CodeDoor /> : <Waitlist appearance={appearance} />}
        <button
          type="button"
          onClick={onClose}
          className="tw:mt-5 tw:w-full tw:cursor-pointer tw:border-0 tw:bg-transparent tw:text-sm tw:text-muted tw:underline tw:underline-offset-4"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// Unchanged from the old page: the code is checked on the server, which mints
// a real Clerk invitation bound to that email and hands back its link.
function CodeDoor() {
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
      window.location.href = data.url;
    } catch {
      setError('Could not reach the server. Check your connection.');
      setBusy(false);
    }
  };

  const field = 'tw:mt-1.5 tw:w-full tw:rounded-lg tw:border tw:border-line tw:bg-paper tw:px-3 tw:py-2.5 tw:text-ink tw:outline-none tw:focus:border-brand-mid';

  return (
    <form onSubmit={submit} className="tw:flex tw:flex-col tw:gap-4">
      <h2 className="tw:m-0 tw:font-[family-name:var(--landing-display)] tw:text-xl tw:tracking-[-0.02em] tw:text-ink">
        You have a code
      </h2>
      <label className="tw:block tw:text-sm tw:font-semibold tw:text-ink-2">
        Your code
        <input value={code} onChange={(e) => setCode(e.target.value)} className={field}
          placeholder="Enter the code you were sent" autoFocus required
          autoComplete="off" spellCheck={false} />
      </label>
      <label className="tw:block tw:text-sm tw:font-semibold tw:text-ink-2">
        Your email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field}
          placeholder="you@example.com" required autoComplete="email" />
      </label>
      {error && (
        <p role="alert" className="tw:m-0 tw:rounded-lg tw:bg-red-50 tw:px-3 tw:py-2 tw:text-sm tw:text-red-700">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy}
        className="tw:mt-1 tw:cursor-pointer tw:rounded-lg tw:border-0 tw:bg-brand tw:px-4 tw:py-3 tw:font-semibold tw:text-white tw:disabled:opacity-60">
        {busy ? 'Checking…' : 'Let me in'}
      </button>
    </form>
  );
}
