'use client';

import { useEffect, useState } from 'react';
import { OPTIONS, SHEET_KEYS, sheetLabel } from '@/lib/fields';
import { fmtDate, todayISO } from '@/lib/format';
import { CustomField, LongField, ShortField } from './Fields';

// Everything about one application beyond the seven things on its row.
//
// One component, used both by the side drawer and by a row expanded in place,
// so the two can never end up showing different fields. The row that opened it
// already says the employer, the role and the status, so none of those are
// repeated here.

// One built-in column, rendered from its own definition rather than from
// eighteen hand-written fields, so this follows lib/fields rather than
// drifting from it.
function ColField({ col, row, canEdit, onPatch }) {
  if (col.kind === 'bool') {
    return (
      <label className="field check-field">
        <span>{col.label}</span>
        <input type="checkbox" checked={Boolean(row[col.key])} disabled={!canEdit}
          onChange={(e) => onPatch({ [col.key]: e.target.checked })} />
      </label>
    );
  }
  const type = col.kind === 'date' ? 'date' : col.kind === 'number' ? 'number'
    : col.kind === 'url' ? 'url' : col.kind === 'email' ? 'email' : 'text';
  return (
    <ShortField label={col.label} value={row[col.key]} canEdit={canEdit} type={type}
      options={col.options} hint={col.hint}
      onSave={(v) => onPatch({ [col.key]: v === '' ? null : v })} />
  );
}

const KIND_LABEL = { status: 'Status', note: 'Note', interview: 'Interview', follow_up: 'Follow-up', offer: 'Offer' };

export default function Details({ row, apiBase = '/api', canEdit, custom = [], fields = [],
  sheets = SHEET_KEYS, names = {}, onPatch, onDelete }) {
  const [events, setEvents] = useState(null);
  const [note, setNote] = useState({ kind: 'note', event_date: todayISO(), detail: '' });
  const [err, setErr] = useState(null);
  const [openHistory, setOpenHistory] = useState(false);

  // Reload whenever the row changes: a status change writes an event server-side.
  useEffect(() => {
    let live = true;
    setEvents(null);
    fetch(`${apiBase}/applications/${row.id}/events`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load history'))))
      .then((d) => live && setEvents(d))
      .catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [apiBase, row.id, row.status, row.updated_at]);

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

  const mine = custom.filter((c) => c.applies === 'both' || c.applies === row.type);
  // The most recent thing that happened, so a closed History still says
  // whether anything has.
  const latest = events?.length
    ? `${fmtDate(events[0].event_date)} · ${events[0].detail}`.slice(0, 90)
    : '';

  return (
    <div className="details">
      {fields.length > 0 && (
        <section className="det-grid">
          <h3>Not on the row</h3>
          {fields.map((col) => <ColField key={col.id} col={col} row={row} canEdit={canEdit} onPatch={onPatch} />)}
        </section>
      )}

      <section className="det-grid">
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
        <ShortField label="How" value={row.outreach_method} canEdit={canEdit} options={OPTIONS.outreach_method}
          onSave={(v) => onPatch({ outreach_method: v })} />
      </section>

      {/* Columns the student added. They live on the row's custom blob, so
          saving one rewrites the blob with the rest of it intact. */}
      {mine.length > 0 && (
        <section className="det-grid">
          <h3>Your columns</h3>
          {mine.map((c) => (
            <CustomField key={c.id} def={c} value={row.custom?.[c.id]} canEdit={canEdit}
              onSave={(v) => onPatch({ custom: { ...(row.custom ?? {}), [c.id]: v } })} />
          ))}
        </section>
      )}

      {/* Folded away. Claude stores the whole posting when a student pastes
          one, up to 60,000 characters, so leaving three open text areas here
          made the panel mostly empty boxes and buried the history under
          them. */}
      <FoldedText label="Notes" value={row.notes} canEdit={canEdit} rows={3}
        onSave={(v) => onPatch({ notes: v })} />
      <FoldedText label="Key requirements" value={row.requirements} canEdit={canEdit} rows={5}
        onSave={(v) => onPatch({ requirements: v })} />
      <FoldedText label="Job description" value={row.job_description} canEdit={canEdit} rows={12}
        onSave={(v) => onPatch({ job_description: v })} />

      <Folded label="History" open={openHistory} onToggle={() => setOpenHistory(!openHistory)}
        summary={events == null ? 'Loading…' : events.length === 0 ? 'Nothing recorded yet' : latest}
        count={events?.length ? (events.length === 1 ? '1 entry' : `${events.length} entries`) : null}>
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
        {events?.length > 0 && (
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
        {events?.length === 0 && <p className="muted">No history yet.</p>}
      </Folded>

      {canEdit && (
        <div className="det-foot">
          <label className="field">
            <span>Sheet</span>
            {/* The student's own sheets, not the two built-ins: since 019 a
                sheet can be one they made, and listing the fixed pair meant a
                row on it could not be moved without being moved off it. */}
            <select value={row.type} onChange={(e) => onPatch({ type: e.target.value })}>
              {sheets.map((t) => <option key={t} value={t}>{sheetLabel(t, names)}</option>)}
            </select>
          </label>
          <button className="btn danger"
            onClick={() => { if (confirm(`Delete “${row.role || 'this application'}” and its history?`)) onDelete(); }}>
            Delete application
          </button>
        </div>
      )}
    </div>
  );
}

// A section, closed until you want it. Its summary says whether opening it is
// worth the click, which is the whole job of a collapsed thing.
function Folded({ label, summary, count, open, onToggle, children }) {
  return (
    <section className="folded">
      <button type="button" className="folded-top" aria-expanded={open} onClick={onToggle}>
        <svg className={`rowsv-chev ${open ? 'up' : ''}`} viewBox="0 0 10 6" aria-hidden>
          <path d="M1 1.5l4 3.5 4-3.5" />
        </svg>
        <b>{label}</b>
        {!open && summary && <small>{summary}</small>}
        {!open && count && <em>{count}</em>}
      </button>
      {open && children}
    </section>
  );
}

// A long text field. Shows the first line when there is one, "Empty" when
// there is not, so you know before you open it.
function FoldedText({ label, value, canEdit, rows, onSave }) {
  const [open, setOpen] = useState(false);
  const text = String(value ?? '').trim();
  const words = text ? text.split(/\s+/).length : 0;
  const peek = text.replace(/\s+/g, ' ').slice(0, 90);
  return (
    <Folded label={label} open={open} onToggle={() => setOpen(!open)}
      summary={text ? `${peek}${text.length > 90 ? '…' : ''}` : 'Empty'}
      count={words ? (words === 1 ? '1 word' : `${words} words`) : null}>
      <LongField label="" value={value} canEdit={canEdit} rows={rows} onSave={onSave} />
    </Folded>
  );
}
