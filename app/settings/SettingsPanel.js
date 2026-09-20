'use client';

import { useState } from 'react';
import { SignOutButton } from '@clerk/nextjs';
import Logo from '../Logo';

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

export default function SettingsPanel({ email, shareToken, connectorOn: initialConnector, connections: initialConnections = [] }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const [shareUrl, setShareUrl] = useState(shareToken ? `/s/${shareToken}` : null);
  const [connectorOn, setConnectorOn] = useState(initialConnector);
  const [connectorUrl, setConnectorUrl] = useState(null); // shown once, right after creating
  const [connections, setConnections] = useState(initialConnections);
  const [showAdvanced, setShowAdvanced] = useState(false);
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
        <a className="brand" href="/"><Logo size={22} />Job Application Tracker</a>
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
          <p>Let Claude add jobs from postings you paste, update statuses, and answer questions about
            your applications. Claude only ever sees <b>your</b> tracker, and you approve the connection
            with a sign-in, so there's no secret to copy.</p>
          <ol className="settings-steps">
            <li>In Claude, open <b>Settings → Connectors → Add custom connector</b>.</li>
            <li>Name it <b>Job Tracker</b> and paste this URL:</li>
          </ol>
          <CopyField value={`${origin}/api/mcp`} />
          <ol className="settings-steps" start={3}>
            <li>Click <b>Add</b>, then <b>Connect</b>. You'll land back here to approve it.</li>
            <li>In a new chat, paste a job posting and say <i>“I'm applying to this.”</i></li>
          </ol>

          <h3 className="settings-sub">Connected apps</h3>
          {connections.length === 0 ? (
            <p className="settings-status">○ Nothing connected yet.</p>
          ) : (
            <ul className="conn-list">
              {connections.map((c) => (
                <li key={c.id}>
                  <span>
                    <b>{c.name}</b>
                    <span className="conn-when">
                      connected {new Date(c.created_at).toLocaleDateString()}
                      {c.last_used_at ? ` · last used ${new Date(c.last_used_at).toLocaleDateString()}` : ' · not used yet'}
                    </span>
                  </span>
                  <button className="btn ghost-dark" disabled={busy === c.id} onClick={act(c.id, async () => {
                    if (!confirm(`Disconnect ${c.name}? It will lose access immediately.`)) return;
                    await call(`/api/settings/connections?id=${encodeURIComponent(c.id)}`, 'DELETE');
                    setConnections((list) => list.filter((x) => x.id !== c.id));
                  })}>Disconnect</button>
                </li>
              ))}
            </ul>
          )}

          <button className="link-btn advanced-toggle" onClick={() => setShowAdvanced((v) => !v)}>
            {showAdvanced ? 'Hide' : 'Show'} the old-style link (for tools without sign-in)
          </button>
          {showAdvanced && (
            <div className="settings-advanced">
              <p>Some tools can't sign in. For those, use a personal link that works like a password.
                Prefer the sign-in method above.</p>
              {connectorUrl ? (
                <>
                  <p className="settings-warn">Copy this link now. It won't be shown again, and anyone
                    with it can edit your tracker.</p>
                  <CopyField value={connectorUrl} />
                </>
              ) : (
                <p className="settings-status">{connectorOn ? '● A personal link is active.' : '○ No personal link.'}</p>
              )}
              <div className="settings-actions">
                <button className="btn ghost-dark" disabled={busy === 'conn'} onClick={act('conn', async () => {
                  if (connectorOn && !confirm('Make a new link? The current one stops working.')) return;
                  const { url } = await call('/api/settings/connector', 'POST');
                  setConnectorUrl(url); setConnectorOn(true);
                })}>{connectorOn ? 'Make a new link' : 'Create a personal link'}</button>
                {connectorOn && (
                  <button className="btn ghost-dark" disabled={busy === 'conn'} onClick={act('conn', async () => {
                    if (!confirm('Turn off the personal link?')) return;
                    await call('/api/settings/connector', 'DELETE');
                    setConnectorOn(false); setConnectorUrl(null);
                  })}>Turn it off</button>
                )}
              </div>
            </div>
          )}
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
            <SignOutButton><button className="btn ghost-dark" type="button">Sign out</button></SignOutButton>
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
