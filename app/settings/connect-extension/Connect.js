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

export default function Connect({ ids, email, initial = 'ready' }) {
  const [state, setState] = useState(initial); // ready | working | done | fail
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
    <main className="cx">
      <div className="cx-card">
        <Link href="/" className="cx-mark" aria-label="Job Application Tracker"><Logo size={30} tone="dark" /></Link>

        {state === 'done' ? (
          <>
            <p className="cx-done"><b>✓</b> Connected</p>
            <p className="cx-note">
              Open a job posting, click the extension icon, and it fills in what it can read from
              the page. Nothing is saved until you press save.
            </p>
            <p className="cx-note"><Link href="/">Back to the tracker</Link></p>
          </>
        ) : (
          <>
            <h1>Connect the extension</h1>
            <p className="cx-who">{email}</p>

            {/* What it does, in the order somebody meets it: save a posting,
                say what the row is, update it when they apply, and be told
                when they already have it. The last line is the point of all
                four. Nothing here about what it cannot do: a list of those
                reads as a warning even when it is meant as a reassurance. */}
            <ul className="cx-can">
              <li><span className="yes">✓</span> Save any job posting straight from your browser</li>
              <li><span className="yes">✓</span> As a wishlist job, or one you have already applied to</li>
              <li><span className="yes">✓</span> Mark it applied the moment you send it</li>
              <li><span className="yes">✓</span> Tells you when a job is already in your tracker</li>
              <li><span className="yes">✓</span> Keeps track on the go, with no retyping</li>
            </ul>

            <p className="cx-note">
              Anything it adds is yours to edit or delete in the sheet, like any other row.
            </p>

            <button className="btn primary cx-go" onClick={pair} disabled={state === 'working'}>
              {state === 'working' ? 'Connecting…' : 'Connect'}
            </button>

            {error && <p className="cx-err" role="alert">{error}</p>}

            <p className="cx-note">
              You can disconnect it whenever you like from <Link href="/settings">Settings</Link>.
              That stops the extension without touching Claude or ChatGPT.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
