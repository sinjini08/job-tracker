'use client';

import { useEffect, useState } from 'react';
import { SignOutButton } from '@clerk/nextjs';
import Logo from '../Logo';
import { BUILTIN_SHEETS, SHEET_DEFAULTS, enabledSheets, isCustomSheet, newSheetKey } from '@/lib/fields';

async function call(url, method) {
  const res = await fetch(url, { method });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

// Which sheets you keep, and what you call them. The stored value behind a
// sheet never changes, so a rename is a label and turning one off is a hide:
// the rows are still there, and switching it back on brings them back.
function SheetSettings() {
  const [prefs, setPrefs] = useState(null);
  // What is saved, edited by the checkboxes and by adding or removing a sheet.
  const [draft, setDraft] = useState(null);
  // What is typed in the boxes on the right, which are rename fields rather
  // than name fields: blank means leave this sheet called what it is called.
  // That is the only way a sheet you made can work, because it has no built-in
  // name to fall back to, and it reads the same for both kinds.
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let live = true;
    fetch('/api/profile')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load your settings'))))
      .then((p) => {
        if (!live) return;
        const next = { enabled: enabledSheets(p.sheets_enabled), names: p.sheet_names ?? {} };
        setPrefs(next);
        setDraft(next);
      })
      .catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, []);

  if (err) return <section className="settings-card"><h2>Your sheets</h2><p className="settings-error">{err}</p></section>;
  if (!draft) return null;

  // What a sheet would be called if this were saved now: whatever is in its
  // box, else the name it already has. Null for a sheet you have just added
  // and not named, which is the one case with nothing to show.
  const nameOf = (key) => edits[key]?.trim() || draft.names[key]?.trim() || null;
  const label = (key) => nameOf(key) ?? SHEET_DEFAULTS[key]?.name ?? null;

  const on = (key) => draft.enabled.includes(key);
  const mine = draft.enabled.filter(isCustomSheet);
  // A sheet you made is only a sheet because it has a name, so an unnamed one
  // doesn't count toward the one you have to keep.
  const kept = draft.enabled.filter((k) => !isCustomSheet(k) || nameOf(k));
  const last = kept.length <= 1;
  const renamed = (key) => Boolean(nameOf(key)) && nameOf(key) !== SHEET_DEFAULTS[key]?.name;
  const dirty = JSON.stringify(draft) !== JSON.stringify(prefs)
    || Object.entries(edits).some(([k, v]) => v.trim() && v.trim() !== draft.names[k]);

  // Built-ins keep their fixed order however they are toggled, so the tab
  // strip never reshuffles under someone who just unticked and reticked one.
  const toggle = (key) => setDraft((d) => {
    const next = d.enabled.includes(key)
      ? d.enabled.filter((k) => k !== key)
      : [...d.enabled, key];
    return { ...d, enabled: [...BUILTIN_SHEETS.filter((k) => next.includes(k)), ...next.filter(isCustomSheet)] };
  });

  const rename = (key, value) => setEdits((e) => ({ ...e, [key]: value }));

  // The way back for a built-in someone renamed. A sheet you made has Remove
  // in the same place, and no default to go back to.
  // Not a hook. The old name began with "use", which made the hooks lint
  // read every call site as a hook called from inside a callback.
  const restoreDefault = (key) => {
    setEdits((e) => ({ ...e, [key]: '' }));
    setDraft((d) => {
      const names = { ...d.names };
      delete names[key];
      return { ...d, names };
    });
  };

  const addSheet = () => setDraft((d) => ({ ...d, enabled: [...d.enabled, newSheetKey()] }));

  const removeSheet = (key) => {
    setEdits((e) => { const next = { ...e }; delete next[key]; return next; });
    setDraft((d) => {
      const names = { ...d.names };
      delete names[key];
      return { enabled: d.enabled.filter((k) => k !== key), names };
    });
  };

  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      // A blank box leaves a sheet called what it is called; the server drops a
      // built-in whose name is just its own default.
      const names = {};
      for (const key of draft.enabled) {
        const name = nameOf(key);
        if (name) names[key] = name;
      }
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheets_enabled: draft.enabled, sheet_names: names }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not save');
      const next = { enabled: enabledSheets(data.sheets_enabled), names: data.sheet_names ?? {} };
      setPrefs(next);
      setDraft(next);
      setEdits({});
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const cancel = () => { setDraft(prefs); setEdits({}); };

  return (
    <section className="settings-card">
      <h2>Your sheets</h2>
      <p>Keep the sheets you use, call them whatever you like, and add sheets of your own.
        The tabs follow.</p>

      <div className="sheet-rows">
        {BUILTIN_SHEETS.map((key) => (
          <div className={`sheet-row ${on(key) ? '' : 'off'}`} key={key}>
            <label className="sheet-keep">
              <input type="checkbox" checked={on(key)} disabled={busy || (on(key) && last)}
                onChange={() => toggle(key)} />
              <span>
                <b>{label(key)}</b>
                <small>{SHEET_DEFAULTS[key].hint}</small>
              </span>
            </label>
            <input type="text" maxLength={30} disabled={busy || !on(key)}
              value={edits[key] ?? ''} placeholder="Call it something else"
              aria-label={`Rename the ${label(key)} sheet`}
              onChange={(e) => rename(key, e.target.value)} />
            {/* The third cell. Empty unless this one has been renamed and can
                go back; the grid needs it either way. See globals.css. */}
            {renamed(key) && on(key)
              ? <button className="tiny-btn" type="button" disabled={busy}
                  onClick={() => restoreDefault(key)}>Use default</button>
              : <span aria-hidden />}
          </div>
        ))}

        {mine.map((key) => {
          const name = nameOf(key);
          return (
            <div className="sheet-row own" key={key}>
              <span className="sheet-keep">
                <span>
                  {/* It goes by its name the moment it has one, the way the
                      built-ins do, and the box beside it goes back to being a
                      rename field. */}
                  <b>{name ?? 'A sheet of your own'}</b>
                  <em className="sheet-badge">Custom</em>
                  <small>Same columns to start with. Add or hide them from the Columns button.</small>
                </span>
              </span>
              <input type="text" maxLength={30} disabled={busy} autoFocus={!name}
                value={edits[key] ?? ''}
                placeholder={name ? 'Call it something else' : 'Internships, Grad schemes, Dream jobs'}
                aria-label={name ? `Rename the ${name} sheet` : 'Name this sheet'}
                onChange={(e) => rename(key, e.target.value)} />
              <button className="tiny-btn" type="button" disabled={busy}
                onClick={() => removeSheet(key)}>Remove</button>
            </div>
          );
        })}
      </div>

      <button className="btn ghost sheet-add" type="button" disabled={busy} onClick={addSheet}>
        + Add a sheet
      </button>

      <p className="settings-note">
        Turning a sheet off hides the tab. Nothing in it is deleted, and turning it back on brings
        it back, and the same goes for removing a sheet you made. You always keep at least one.
        {kept.length > 0 && <> Right now your tabs read <b>{list(kept.map(label))}</b>.</>}
      </p>

      {dirty && (
        <div className="field-actions">
          <button className="btn primary" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : 'Save sheets'}
          </button>
          <button className="tiny-btn" type="button" disabled={busy} onClick={cancel}>Cancel</button>
        </div>
      )}
    </section>
  );
}

// "A", "A and B", "A, B and C".
const list = (items) => (items.length < 3
  ? items.join(' and ')
  : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

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

// Where to install the extension. Absent until it is published, and the
// button simply is not rendered, because a dead store link is worse than no
// link: the page would be telling somebody to install something they cannot.
const EXTENSION_URL = process.env.NEXT_PUBLIC_EXTENSION_URL || '';

export default function SettingsPanel({ email, shareToken, connectorOn: initialConnector,
  extensionOn: initialExtension = false, connections: initialConnections = [] }) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const [shareUrl, setShareUrl] = useState(shareToken ? `/s/${shareToken}` : null);
  const [connectorOn, setConnectorOn] = useState(initialConnector);
  const [connectorUrl, setConnectorUrl] = useState(null); // shown once, right after creating
  const [extensionOn, setExtensionOn] = useState(initialExtension);
  const [extensionUrl, setExtensionUrl] = useState(null); // shown once, same reason
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

        <SheetSettings />

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
          <h2>Save jobs from your browser</h2>
          {/* This used to say the extension "can only add to your tracker,
              never read it", which stopped being true when it learned to
              notice a job you had already saved and to move a row to
              Applied. It still cannot read the rows themselves, which is the
              part worth promising, so that is what it says now. */}
          <p>The browser extension reads the posting you are looking at, anywhere you apply, and
            files it. Nothing is sent until you press save. It can add rows and move one to
            Applied; it cannot read the rows already in your tracker, or delete anything.</p>
          {/* The steps described pasting a link, which is now the fallback.
              Pressing Connect in the popup opens a page here and hands the
              token over without anybody copying a secret. */}
          <ol className="settings-steps">
            <li>Install the extension.</li>
            <li>Click its icon on a job posting, and press Connect to my tracker.</li>
            <li>Confirm on the page it opens. That is all.</li>
          </ol>
          {EXTENSION_URL && (
            <p className="settings-actions">
              <a className="btn primary" href={EXTENSION_URL} target="_blank" rel="noreferrer">
                Get the extension
              </a>
            </p>
          )}
          {extensionUrl ? (
            <>
              <p className="settings-warn">Copy this now. It will not be shown again, and anyone
                with it can add rows to your tracker. You only need this if Connect cannot reach
                the extension, which happens on a local build.</p>
              <CopyField value={extensionUrl} />
            </>
          ) : (
            <p className="settings-status">
              {extensionOn ? '\u25cf An extension is connected.' : '\u25cb No extension connected.'}
            </p>
          )}
          <div className="settings-actions">
            <button className="btn ghost-dark" disabled={busy === 'ext'} onClick={act('ext', async () => {
              if (extensionOn && !confirm('Make a new link? The one in your browser stops working.')) return;
              const { url } = await call('/api/settings/extension', 'POST');
              setExtensionUrl(url); setExtensionOn(true);
            })}>{extensionOn ? 'Make a new link' : 'Create a link to paste instead'}</button>
            {extensionOn && (
              <button className="btn ghost-dark" disabled={busy === 'ext'} onClick={act('ext', async () => {
                if (!confirm('Disconnect the extension?')) return;
                await call('/api/settings/extension', 'DELETE');
                setExtensionOn(false); setExtensionUrl(null);
              })}>Disconnect</button>
            )}
          </div>
          <p className="settings-note">
            Separate from the assistant connector above on purpose. This link only adds rows and
            moves one to Applied, and turning it off does not disconnect Claude or ChatGPT.
          </p>
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
