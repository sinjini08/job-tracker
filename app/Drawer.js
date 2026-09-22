'use client';

import { useEffect, useState } from 'react';
import { OPTIONS } from '@/lib/fields';
import { CHIP, fmtDate, todayISO } from '@/lib/format';

const KIND_LABEL = { status: 'Status', note: 'Note', interview: 'Interview', follow_up: 'Follow-up', offer: 'Offer' };

export default function Drawer({ row, apiBase = '/api', canEdit, onPatch, onDelete, onClose }) {
  const [events, setEvents] = useState(null);
  const [note, setNote] = useState({ kind: 'note', event_date: todayISO(), detail: '' });
  const [err, setErr] = useState(null);

  // Reload history whenever the row changes (status changes add events server-side).
  useEffect(() => {
    let live = true;
    fetch(`${apiBase}/applications/${row.id}/events`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load history'))))
      .then((d) => live && setEvents(d))
      .catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [apiBase, row.id, row.status, row.updated_at]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const addNote = async (e) => {
    e.preventDefault();
    if (!note.detail.trim()) return;
    const res = await fetch(`${apiBase}/applications/${row.id}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) return setErr(data?.error || 'Could not save note');
    setEvents((ev) => [data, ...(ev || [])].sort((a, b) =>
      b.event_date.localeCompare(a.event_date) || b.created_at.localeCompare(a.created_at)));
    setNote({ kind: 'note', event_date: todayISO(), detail: '' });
    setErr(null);
  };

  const [bg, fg] = CHIP[row.status] || [];

  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" aria-label="Application details">
        <div className="drawer-head">
          <div>
            <div className="drawer-title">{row.role || 'Untitled role'}</div>
            <div className="drawer-sub">
              {row.company || 'No company yet'} · {row.type}
              <span className="chip" style={{ background: bg, color: fg, marginLeft: 8 }}>{row.status}</span>
            </div>
          </div>
          <button className="btn ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="drawer-body">
          <section className="contact-grid">
            <h3>Contact</h3>
            <ShortField label="Name" value={row.contact} canEdit={canEdit}
              onSave={(v) => onPatch({ contact: v })} />
            <ShortField label="Email" value={row.contact_email} type="email" canEdit={canEdit}
              onSave={(v) => onPatch({ contact_email: v })} />
            <ShortField label="LinkedIn" value={row.contact_link} type="url" canEdit={canEdit}
              onSave={(v) => onPatch({ contact_link: v })}
              hint="Use this when a recruiter has no public email." />
            <ShortField label="Reached out on" value={row.reached_out_on} type="date" canEdit={canEdit}
              onSave={(v) => onPatch({ reached_out_on: v })}
              hint={`The date you sent it${row.outreach_method ? ` (via ${row.outreach_method})` : ''}. What you said goes in the history below.`} />
          </section>

          <LongField label="Notes" value={row.notes} canEdit={canEdit}
            onSave={(v) => onPatch({ notes: v })} rows={3} />
          <LongField label="Key requirements" value={row.requirements} canEdit={canEdit}
            onSave={(v) => onPatch({ requirements: v })} rows={4} />
          <LongField label="Job description" value={row.job_description} canEdit={canEdit}
            onSave={(v) => onPatch({ job_description: v })} rows={10} />

          <section>
            <h3>History</h3>
            {canEdit && (
              <form className="note-form" onSubmit={addNote}>
                <select value={note.kind} onChange={(e) => setNote({ ...note, kind: e.target.value })}>
                  <option value="note">Note</option>
                  <option value="interview">Interview</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="offer">Offer</option>
                </select>
                <input type="date" value={note.event_date}
                  onChange={(e) => setNote({ ...note, event_date: e.target.value })} />
                <input className="grow" placeholder="Add to history…" value={note.detail}
                  onChange={(e) => setNote({ ...note, detail: e.target.value })} />
                <button className="btn primary" type="submit">Add</button>
              </form>
            )}
            {err && <p className="drawer-err">{err}</p>}
            {events == null ? <p className="muted">Loading…</p> : events.length === 0 ? (
              <p className="muted">No history yet.</p>
            ) : (
              <ol className="timeline">
                {events.map((ev) => (
                  <li key={ev.id}>
                    <span className="tl-date">{fmtDate(ev.event_date)}</span>
                    <span className={`tl-kind k-${ev.kind}`}>{KIND_LABEL[ev.kind] || ev.kind}</span>
                    <span className="tl-detail">{ev.detail}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {canEdit && (
            <>
              <label className="field">
                <span>Sheet</span>
                <select value={row.type} onChange={(e) => onPatch({ type: e.target.value })}>
                  {OPTIONS.type.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <button
                className="btn danger"
                onClick={() => { if (confirm(`Delete “${row.role || 'this application'}” and its history?`)) onDelete(); }}
              >
                Delete application
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

// A one-line detail. Saves on blur, like the long fields, so typing never
// fires a request per keystroke.
function ShortField({ label, value, canEdit, onSave, type = 'text', hint }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  const shown = type === 'date' ? fmtDate(value) : value;
  return (
    <label className="field" title={hint || ''}>
      <span>{label}</span>
      {canEdit ? (
        <input
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { if ((value ?? '') !== draft) onSave(draft); }}
        />
      ) : (
        <div className="readonly-text">{shown || 'Not set'}</div>
      )}
    </label>
  );
}

function LongField({ label, value, canEdit, onSave, rows }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);
  return (
    <label className="field">
      <span>{label}</span>
      {canEdit ? (
        <textarea
          rows={rows}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { if ((value ?? '') !== draft) onSave(draft); }}
        />
      ) : (
        <div className="readonly-text">{value || 'Nothing here yet'}</div>
      )}
    </label>
  );
}
