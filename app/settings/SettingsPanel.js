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
  const [assistant, setAssistant] = useState('claude');
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
        <a className="brand" href="/"><Logo size={24} />Job Application Tracker</a>
        <div className="toolbar-mid" />
        <div className="toolbar-right">
          <a className="btn ghost" href="/?sheet=1">Back to my sheet</a>
        </div>
      </header>

      <main className="settings-body">
        <h1>Settings</h1>
        {error && <p className="settings-error" role="alert">{error}</p>}

        <section className="settings-card">
          <h2>Connect an assistant</h2>
          <p>Let your assistant add jobs from postings you paste, update statuses, and answer
            questions about your applications. It only ever sees <b>your</b> tracker, and you
            approve the connection with a sign-in, so there's no secret to copy.</p>

          {/* The tracker speaks one protocol; only the menus differ. */}
          <div className="assistant-pick" role="tablist" aria-label="Which assistant">
            {[['claude', 'Claude'], ['chatgpt', 'ChatGPT']].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={assistant === id}
                className={`assistant-tab ${assistant === id ? 'on' : ''}`}
                onClick={() => setAssistant(id)}>{label}</button>
            ))}
          </div>

          {assistant === 'claude' ? (
            <>
              <ol className="settings-steps">
                <li>In Claude, open <b>Settings → Connectors → Add custom connector</b>.</li>
                <li>Name it <b>Job Tracker</b> and paste this URL:</li>
              </ol>
              <CopyField value={`${origin}/api/mcp`} />
              <ol className="settings-steps" start={3}>
                <li>Click <b>Add</b>, then <b>Connect</b>. You'll land back here to approve it.</li>
                <li>In a new chat, paste a job posting and say <i>“I'm applying to this.”</i></li>
              </ol>
            </>
          ) : (
            <>
              <ol className="settings-steps">
                <li>In ChatGPT on the web, open <b>Settings → Apps &amp; Connectors → Advanced
                  settings</b> and turn on <b>Developer mode</b>.</li>
                <li>Go back to <b>Apps &amp; Connectors</b> and choose <b>Create</b>.</li>
                <li>Name it <b>Job Tracker</b> and paste this URL:</li>
              </ol>
              <CopyField value={`${origin}/api/mcp`} />
              <ol className="settings-steps" start={4}>
                <li>Pick <b>OAuth</b> for authentication, then <b>Create</b>. You'll land back here
                  to approve it.</li>
                <li>In a new chat, paste a job posting and say <i>“I'm applying to this.”</i>{' '}
                  ChatGPT asks you to confirm before anything is written.</li>
              </ol>
              <p className="settings-note">
                Custom connectors need ChatGPT Plus, Pro, Business, Enterprise or Edu. They are not
                available on the free plan. If ChatGPT won't finish the sign-in, use the personal
                link below with <b>No authentication</b> instead.
              </p>
            </>
          )}

          <p className="settings-note">
            It doesn't need a chat of its own. Paste a posting, say you're applying, and carry
            on asking about your CV or the interview — the job gets saved as you go. It shows
            you what it's about to save and waits for a yes, asks if the posting doesn't name
            the employer, and leaves anything else the posting doesn't say blank rather than
            guessing. Mention later that you heard back and it moves the status across.
          </p>

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
            {showAdvanced ? 'Hide' : 'Show'} the personal link (for tools that can't sign in)
          </button>
          {showAdvanced && (
            <div className="settings-advanced">
              <p>Some tools can't sign in, and ChatGPT's sign-in doesn't always go through. For
                those, use a personal link: paste it as the connector URL and choose <b>No
                authentication</b>. It works like a password, so prefer the sign-in method above
                where you can.</p>
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
