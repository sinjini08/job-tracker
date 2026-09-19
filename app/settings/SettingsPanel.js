'use client';

import { useState } from 'react';
import { signOut } from '../login/actions';

async function call(url, method) {
  const res = await fetch(url, { method });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

function CopyField({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="copy-field">
      <input readOnly value={value} onFocus={(e) => e.target.select()} aria-label="Link" />
      <button className="btn primary" onClick={async () => {
        try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
      }}>{copied ? 'Copied' : 'Copy'}</button>
    </div>
  );
}

export default function SettingsPanel({ email, shareToken, connectorOn: initialConnector }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const [shareUrl, setShareUrl] = useState(shareToken ? `/s/${shareToken}` : null);
  const [connectorOn, setConnectorOn] = useState(initialConnector);
  const [connectorUrl, setConnectorUrl] = useState(null); // shown once, right after creating
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const act = (name, fn) => async () => {
    setBusy(name); setError(null);
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(null); }
  };

  const fullShare = shareUrl && (shareUrl.startsWith('http') ? shareUrl : origin + shareUrl);

  return (
    <div className="settings">
      <header className="toolbar">
        <a className="brand" href="/"><span className="brand-mark" aria-hidden>▦</span>Job Application Tracker</a>
        <div className="toolbar-mid" />
        <div className="toolbar-right">
          <a className="btn ghost" href="/">Back to my sheet</a>
        </div>
      </header>

      <main className="settings-body">
        <h1>Settings</h1>
        {error && <p className="settings-error" role="alert">{error}</p>}

        <section className="settings-card">
          <h2>Connect Claude</h2>
          <p>Let Claude add jobs from postings you paste, update statuses, and answer questions
            about your applications. Claude only ever sees <b>your</b> tracker.</p>
          {connectorUrl ? (
            <>
              <p className="settings-warn">Copy this link now. For your security it won’t be shown again.
                Treat it like a password: anyone with it can edit your tracker.</p>
              <CopyField value={connectorUrl} />
              <ol className="settings-steps">
                <li>In Claude, open <b>Settings → Connectors → Add custom connector</b>.</li>
                <li>Name it <b>Job Tracker</b>, paste the link as the URL, and click <b>Add</b>.</li>
                <li>Using Claude Code instead? Run: <code>claude mcp add --transport http job-tracker &lt;link&gt;</code></li>
                <li>In a new chat, paste a job posting and say <i>“I’m applying to this.”</i></li>
              </ol>
            </>
          ) : (
            <p className="settings-status">{connectorOn ? '● Connected. A link is active.' : '○ Not connected.'}</p>
          )}
          <div className="settings-actions">
            <button className="btn primary" disabled={busy === 'conn'} onClick={act('conn', async () => {
              if (connectorOn && !confirm('Make a new link? The current one will stop working, so you’ll need to update it in Claude.')) return;
              const { url } = await call('/api/settings/connector', 'POST');
              setConnectorUrl(url); setConnectorOn(true);
            })}>{connectorOn ? 'Make a new link' : 'Create my connector link'}</button>
            {connectorOn && (
              <button className="btn ghost-dark" disabled={busy === 'conn'} onClick={act('conn', async () => {
                if (!confirm('Disconnect Claude? The link stops working immediately.')) return;
                await call('/api/settings/connector', 'DELETE');
                setConnectorOn(false); setConnectorUrl(null);
              })}>Disconnect</button>
            )}
          </div>
        </section>

        <section className="settings-card">
          <h2>Share a read-only view</h2>
          <p>Anyone with the link can see your sheets and charts (a career advisor, a friend) but can’t
            change anything. Turn it off whenever you like.</p>
          {fullShare ? <CopyField value={fullShare} /> : <p className="settings-status">○ Sharing is off.</p>}
          <div className="settings-actions">
            <button className="btn primary" disabled={busy === 'share'} onClick={act('share', async () => {
              if (shareUrl && !confirm('Make a new link? The current one will stop working.')) return;
              const { url } = await call('/api/settings/share', 'POST');
              setShareUrl(url);
            })}>{shareUrl ? 'Make a new link' : 'Create share link'}</button>
            {shareUrl && (
              <button className="btn ghost-dark" disabled={busy === 'share'} onClick={act('share', async () => {
                await call('/api/settings/share', 'DELETE');
                setShareUrl(null);
              })}>Turn off sharing</button>
            )}
          </div>
        </section>

        <section className="settings-card">
          <h2>Account</h2>
          <p>Signed in as <b>{email}</b>.</p>
          <div className="settings-actions">
            <form action={signOut}><button className="btn ghost-dark" type="submit">Sign out</button></form>
            <button className="btn danger" disabled={busy === 'del'} onClick={act('del', async () => {
              const typed = prompt('This permanently deletes your account, every application, and all history. Type DELETE to confirm.');
              if (typed !== 'DELETE') return;
              await call('/api/account', 'DELETE');
              window.location.href = '/login';
            })}>Delete my account</button>
          </div>
        </section>
      </main>
    </div>
  );
}
