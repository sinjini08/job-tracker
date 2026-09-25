'use client';

import Link from 'next/link';
import { useState } from 'react';
import Logo from '@/app/Logo';

// One press: mint a token, hand it to the extension, done.
//
// The token is never rendered, never put on the clipboard and never in the
// URL. It goes from the response straight into a message to the extension and
// is then forgotten by this page, which is the difference between this and
// telling somebody to copy a secret out of a settings screen.

export default function Connect({ ids, email }) {
  const [state, setState] = useState('ready'); // ready | working | done | fail
  const [error, setError] = useState(null);

  const pair = async () => {
    setState('working');
    setError(null);
    try {
      if (!ids.length) {
        throw new Error('This tracker has not been told which extension to trust. Whoever runs it needs to set EXTENSION_IDS.');
      }
      // chrome.runtime is only here at all because the extension's manifest
      // names this origin in externally_connectable. If it is missing, the
      // extension is not installed in this browser.
      const runtime = typeof chrome !== 'undefined' ? chrome.runtime : null;
      if (!runtime?.sendMessage) {
        throw new Error('The extension is not installed in this browser. Install it, then try again.');
      }

      const res = await fetch('/api/settings/extension', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? 'Could not make a link.');

      // Sent to each trusted id; only the one installed here answers. Every
      // other id is a no-op, which is what lets a dev build and a published
      // build both work without this page knowing which is which.
      const replies = await Promise.all(ids.map((id) => new Promise((resolve) => {
        try {
          runtime.sendMessage(id, { type: 'jt-pair', endpoint: body.url }, (reply) => {
            // A missing extension sets runtime.lastError rather than throwing.
            resolve(runtime.lastError ? null : reply);
          });
        } catch { resolve(null); }
      })));

      const ok = replies.find((r) => r?.ok);
      if (!ok) {
        const said = replies.find((r) => r?.error)?.error;
        throw new Error(said ?? 'The extension did not answer. Make sure it is installed and enabled, then try again.');
      }
      setState('done');
    } catch (e) {
      setError(e.message);
      setState('fail');
    }
  };

  return (
    <main className="legal">
      <header className="legal-head">
        <Link href="/" className="legal-mark"><Logo size={36} tone="dark" /></Link>
        <h1>Connect the extension</h1>
        <p className="legal-sub">Signed in as {email}</p>
      </header>

      {state === 'done' ? (
        <>
          <p className="legal-lede">
            Connected. Open a job posting, click the extension icon, and it will fill in what it
            can read from the page.
          </p>
          <p><Link href="/">Back to the tracker</Link></p>
        </>
      ) : (
        <>
          <p className="legal-lede">
            This lets the extension add job postings to your tracker, and see what your sheet
            tabs are called so it can ask which one to save to. It cannot read the rows already
            in your tracker, change them, or delete anything.
          </p>
          <p>
            You can disconnect it at any time from <Link href="/settings">Settings</Link>, which
            stops the extension working without touching Claude or ChatGPT.
          </p>
          {error && <p className="settings-error" role="alert">{error}</p>}
          <p className="legal-foot">
            <button className="btn primary" onClick={pair} disabled={state === 'working'}>
              {state === 'working' ? 'Connecting…' : 'Connect the extension'}
            </button>
          </p>
        </>
      )}
    </main>
  );
}
